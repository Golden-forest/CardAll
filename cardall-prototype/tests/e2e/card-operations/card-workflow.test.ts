// 卡片操作端到端测试
import { test, expect } from '@playwright/test'

test.describe('Card Operations', () => {
  test.beforeEach(async ({ page }) => {
    // 登录并导航到仪表板
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')
  })

  test.describe('卡片创建', () => {
    test('应该能够创建文本卡片', async ({ page }) => {
      // 点击创建卡片按钮
      await page.click('[data-testid="create-card-button"]')
      
      // 等待创建模态框
      await page.waitForSelector('[data-testid="card-modal"]')
      
      // 填写卡片信息
      await page.fill('[data-testid="card-title"]', '测试卡片')
      await page.fill('[data-testid="card-content"]', '这是一个测试卡片的内容')
      
      // 选择卡片样式
      await page.click('[data-testid="style-selector"]')
      await page.click('[data-testid="style-gradient-blue"]')
      
      // 添加标签
      await page.click('[data-testid="tag-input"]')
      await page.fill('[data-testid="tag-input"]', '测试')
      await page.press('[data-testid="tag-input"]', 'Enter')
      
      // 保存卡片
      await page.click('[data-testid="save-card-button"]')
      
      // 等待卡片创建成功
      await page.waitForSelector('[data-testid="card-title"]:has-text("测试卡片")')
      
      // 验证卡片显示
      const cardTitle = await page.locator('[data-testid="card-title"]').textContent()
      expect(cardTitle).toContain('测试卡片')
      
      // 验证标签显示
      const tag = await page.locator('[data-testid="card-tag"]').textContent()
      expect(tag).toContain('测试')
    })

    test('应该能够创建带图片的卡片', async ({ page }) => {
      await page.click('[data-testid="create-card-button"]')
      await page.waitForSelector('[data-testid="card-modal"]')
      
      // 填写基本信息
      await page.fill('[data-testid="card-title"]', '图片卡片')
      await page.fill('[data-testid="card-content"]', '这是一个带图片的卡片')
      
      // 上传图片
      const fileInput = await page.locator('[data-testid="image-upload"]')
      await fileInput.setInputFiles('./tests/fixtures/test-image.jpg')
      
      // 等待图片上传完成
      await page.waitForSelector('[data-testid="image-preview"]')
      
      // 保存卡片
      await page.click('[data-testid="save-card-button"]')
      
      // 验证卡片创建成功
      await page.waitForSelector('[data-testid="card-title"]:has-text("图片卡片")')
      
      // 验证图片显示
      const image = await page.locator('[data-testid="card-image"]')
      await expect(image).toBeVisible()
    })

    test('应该能够创建任务列表卡片', async ({ page }) => {
      await page.click('[data-testid="create-card-button"]')
      await page.waitForSelector('[data-testid="card-modal"]')
      
      // 填写基本信息
      await page.fill('[data-testid="card-title"]', '购物清单')
      
      // 切换到任务列表模式
      await page.click('[data-testid="task-list-mode"]')
      
      // 添加任务项
      await page.fill('[data-testid="task-input"]', '牛奶')
      await page.press('[data-testid="task-input"]', 'Enter')
      
      await page.fill('[data-testid="task-input"]', '面包')
      await page.press('[data-testid="task-input"]', 'Enter')
      
      await page.fill('[data-testid="task-input"]', '鸡蛋')
      await page.press('[data-testid="task-input"]', 'Enter')
      
      // 保存卡片
      await page.click('[data-testid="save-card-button"]')
      
      // 验证卡片创建成功
      await page.waitForSelector('[data-testid="card-title"]:has-text("购物清单")')
      
      // 验证任务项显示
      const tasks = await page.locator('[data-testid="task-item"]')
      await expect(tasks).toHaveCount(3)
    })
  })

  test.describe('卡片编辑', () => {
    test('应该能够编辑卡片内容', async ({ page }) => {
      // 先创建一个卡片
      await createTestCard(page)
      
      // 双击卡片进行编辑
      await page.dblclick('[data-testid="card-title"]')
      
      // 等待编辑模态框
      await page.waitForSelector('[data-testid="card-modal"]')
      
      // 修改标题和内容
      await page.fill('[data-testid="card-title"]', '修改后的标题')
      await page.fill('[data-testid="card-content"]', '修改后的内容')
      
      // 保存更改
      await page.click('[data-testid="save-card-button"]')
      
      // 验证更新成功
      await page.waitForSelector('[data-testid="card-title"]:has-text("修改后的标题")')
      
      const cardTitle = await page.locator('[data-testid="card-title"]').textContent()
      expect(cardTitle).toContain('修改后的标题')
    })

    test('应该能够添加和删除标签', async ({ page }) => {
      await createTestCard(page)
      
      // 编辑卡片
      await page.dblclick('[data-testid="card-title"]')
      await page.waitForSelector('[data-testid="card-modal"]')
      
      // 添加新标签
      await page.click('[data-testid="tag-input"]')
      await page.fill('[data-testid="tag-input"]', '新标签')
      await page.press('[data-testid="tag-input"]', 'Enter')
      
      // 删除现有标签
      await page.click('[data-testid="remove-tag"]:first-child')
      
      // 保存更改
      await page.click('[data-testid="save-card-button"]')
      
      // 验证标签更新
      await expect(page.locator('[data-testid="card-tag"]:has-text("新标签")')).toBeVisible()
      await expect(page.locator('[data-testid="card-tag"]:has-text("测试")')).not.toBeVisible()
    })

    test('应该能够更换卡片样式', async ({ page }) => {
      await createTestCard(page)
      
      // 编辑卡片
      await page.dblclick('[data-testid="card-title"]')
      await page.waitForSelector('[data-testid="card-modal"]')
      
      // 选择新样式
      await page.click('[data-testid="style-selector"]')
      await page.click('[data-testid="style-gradient-green"]')
      
      // 保存更改
      await page.click('[data-testid="save-card-button"]')
      
      // 验证样式更改
      const card = await page.locator('[data-testid="card"]')
      await expect(card).toHaveClass(/gradient-green/)
    })
  })

  test.describe('卡片操作', () => {
    test('应该能够翻转卡片查看背面', async ({ page }) => {
      await createTestCard(page)
      
      // 添加背面内容
      await page.dblclick('[data-testid="card-title"]')
      await page.waitForSelector('[data-testid="card-modal"]')
      
      await page.click('[data-testid="back-content-tab"]')
      await page.fill('[data-testid="card-back-content"]', '这是背面的补充内容')
      await page.click('[data-testid="save-card-button"]')
      
      // 翻转卡片
      await page.click('[data-testid="flip-card-button"]')
      
      // 等待翻转动画完成
      await page.waitForTimeout(500)
      
      // 验证背面内容显示
      const backContent = await page.locator('[data-testid="card-back-content"]').textContent()
      expect(backContent).toContain('背面的补充内容')
    })

    test('应该能够复制卡片内容', async ({ page }) => {
      await createTestCard(page)
      
      // 点击复制按钮
      await page.click('[data-testid="copy-card-button"]')
      
      // 等待复制成功提示
      await page.waitForSelector('[data-testid="copy-success-toast"]')
      
      // 验证剪贴板内容（需要特殊权限，这里主要验证UI响应）
      const toastMessage = await page.locator('[data-testid="copy-success-toast"]').textContent()
      expect(toastMessage).toContain('Copied to clipboard')
    })

    test('应该能够截图卡片', async ({ page }) => {
      await createTestCard(page)
      
      // 点击截图按钮
      await page.click('[data-testid="screenshot-card-button"]')
      
      // 等待截图完成
      await page.waitForSelector('[data-testid="screenshot-success-toast"]')
      
      // 验证截图成功提示
      const toastMessage = await page.locator('[data-testid="screenshot-success-toast"]').textContent()
      expect(toastMessage).toContain('Screenshot saved')
    })

    test('应该能够分享卡片', async ({ page }) => {
      await createTestCard(page)
      
      // 点击分享按钮
      await page.click('[data-testid="share-card-button"]')
      
      // 等待分享模态框
      await page.waitForSelector('[data-testid="share-modal"]')
      
      // 选择分享方式
      await page.click('[data-testid="share-link"]')
      
      // 复制分享链接
      await page.click('[data-testid="copy-share-link"]')
      
      // 验证复制成功
      await page.waitForSelector('[data-testid="share-success-toast"]')
      
      const toastMessage = await page.locator('[data-testid="share-success-toast"]').textContent()
      expect(toastMessage).toContain('Share link copied')
    })
  })

  test.describe('卡片删除', () => {
    test('应该能够删除卡片', async ({ page }) => {
      await createTestCard(page)
      
      // 点击删除按钮
      await page.click('[data-testid="delete-card-button"]')
      
      // 确认删除
      await page.waitForSelector('[data-testid="delete-confirm-modal"]')
      await page.click('[data-testid="confirm-delete-button"]')
      
      // 验证卡片删除成功
      await expect(page.locator('[data-testid="card-title"]')).not.toBeVisible()
    })

    test('应该能够取消删除操作', async ({ page }) => {
      await createTestCard(page)
      
      // 点击删除按钮
      await page.click('[data-testid="delete-card-button"]')
      
      // 取消删除
      await page.waitForSelector('[data-testid="delete-confirm-modal"]')
      await page.click('[data-testid="cancel-delete-button"]')
      
      // 验证卡片仍然存在
      await expect(page.locator('[data-testid="card-title"]')).toBeVisible()
    })
  })

  test.describe('卡片搜索和筛选', () => {
    test.beforeEach(async ({ page }) => {
      // 创建多个测试卡片
      await createTestCard(page, { title: 'React 学习笔记', tags: ['前端', 'React'] })
      await createTestCard(page, { title: 'TypeScript 教程', tags: ['前端', 'TypeScript'] })
      await createTestCard(page, { title: 'Node.js 后端开发', tags: ['后端', 'Node.js'] })
    })

    test('应该能够按关键词搜索卡片', async ({ page }) => {
      // 输入搜索关键词
      await page.fill('[data-testid="search-input"]', 'React')
      
      // 验证搜索结果
      await expect(page.locator('[data-testid="card-title"]:has-text("React 学习笔记")')).toBeVisible()
      await expect(page.locator('[data-testid="card-title"]:has-text("TypeScript 教程")')).not.toBeVisible()
      await expect(page.locator('[data-testid="card-title"]:has-text("Node.js 后端开发")')).not.toBeVisible()
    })

    test('应该能够按标签筛选卡片', async ({ page }) => {
      // 点击标签筛选
      await page.click('[data-testid="tag-filter"]:has-text("前端")')
      
      // 验证筛选结果
      await expect(page.locator('[data-testid="card-title"]:has-text("React 学习笔记")')).toBeVisible()
      await expect(page.locator('[data-testid="card-title"]:has-text("TypeScript 教程")')).toBeVisible()
      await expect(page.locator('[data-testid="card-title"]:has-text("Node.js 后端开发")')).not.toBeVisible()
    })

    test('应该能够组合搜索和筛选', async ({ page }) => {
      // 输入搜索关键词
      await page.fill('[data-testid="search-input"]', '开发')
      
      // 点击标签筛选
      await page.click('[data-testid="tag-filter"]:has-text("后端")')
      
      // 验证组合筛选结果
      await expect(page.locator('[data-testid="card-title"]:has-text("Node.js 后端开发")')).toBeVisible()
      await expect(page.locator('[data-testid="card-title"]:has-text("React 学习笔记")')).not.toBeVisible()
      await expect(page.locator('[data-testid="card-title"]:has-text("TypeScript 教程")')).not.toBeVisible()
    })

    test('应该能够清除筛选条件', async ({ page }) => {
      // 应用筛选
      await page.fill('[data-testid="search-input"]', 'React')
      await page.click('[data-testid="tag-filter"]:has-text("前端")')
      
      // 清除筛选
      await page.click('[data-testid="clear-filters"]')
      
      // 验证所有卡片都显示
      await expect(page.locator('[data-testid="card-title"]')).toHaveCount(3)
    })
  })

  test.describe('卡片拖拽和排序', () => {
    test.beforeEach(async ({ page }) => {
      // 创建多个测试卡片
      await createTestCard(page, { title: '卡片 1' })
      await createTestCard(page, { title: '卡片 2' })
      await createTestCard(page, { title: '卡片 3' })
    })

    test('应该能够拖拽排序卡片', async ({ page }) => {
      const card1 = page.locator('[data-testid="card"]:has-text("卡片 1")')
      const card2 = page.locator('[data-testid="card"]:has-text("卡片 2")')
      
      // 获取初始位置
      const initialPosition1 = await card1.boundingBox()
      const initialPosition2 = await card2.boundingBox()
      
      // 拖拽卡片1到卡片2的位置
      await card1.dragTo(card2)
      
      // 等待拖拽完成
      await page.waitForTimeout(500)
      
      // 验证位置交换
      const finalPosition1 = await card1.boundingBox()
      const finalPosition2 = await card2.boundingBox()
      
      expect(finalPosition1.y).toBe(initialPosition2.y)
      expect(finalPosition2.y).toBe(initialPosition1.y)
    })

    test('应该能够将卡片拖拽到文件夹', async ({ page }) => {
      // 创建文件夹
      await page.click('[data-testid="create-folder-button"]')
      await page.fill('[data-testid="folder-name"]', '测试文件夹')
      await page.click('[data-testid="save-folder-button"]')
      
      // 拖拽卡片到文件夹
      const card = page.locator('[data-testid="card"]:first-child')
      const folder = page.locator('[data-testid="folder"]:has-text("测试文件夹")')
      
      await card.dragTo(folder)
      
      // 验证卡片移动到文件夹
      await page.click('[data-testid="folder"]:has-text("测试文件夹")')
      await expect(page.locator('[data-testid="card"]')).toBeVisible()
    })
  })

  test.describe('卡片磁性吸附', () => {
    test('应该能够磁性吸附卡片', async ({ page }) => {
      await createTestCard(page, { title: '卡片 1' })
      await createTestCard(page, { title: '卡片 2' })
      
      const card1 = page.locator('[data-testid="card"]:first-child')
      const card2 = page.locator('[data-testid="card"]:nth-child(2)')
      
      // 将卡片2拖拽到卡片1的边缘
      const card1Box = await card1.boundingBox()
      
      await card2.hover()
      await page.mouse.down()
      await page.mouse.move(card1Box.x + card1Box.width + 10, card1Box.y + card1Box.height / 2)
      await page.mouse.up()
      
      // 等待吸附动画
      await page.waitForTimeout(500)
      
      // 验证卡片吸附成功
      await expect(page.locator('[data-testid="magnetic-group"]')).toBeVisible()
    })
  })

  test.describe('响应式设计', () => {
    test('应该在移动端正常工作', async ({ page }) => {
      // 设置移动端视口
      await page.setViewportSize({ width: 375, height: 667 })
      
      await createTestCard(page)
      
      // 验证移动端布局
      const card = page.locator('[data-testid="card"]')
      await expect(card).toHaveClass(/mobile-optimized/)
      
      // 测试触摸操作
      await card.tap({ force: true })
      await page.waitForTimeout(300)
      await expect(card).toHaveClass(/flipped/)
    })

    test('应该在桌面端正常工作', async ({ page }) => {
      // 设置桌面端视口
      await page.setViewportSize({ width: 1920, height: 1080 })
      
      await createTestCard(page)
      
      // 验证桌面端布局
      const card = page.locator('[data-testid="card"]')
      await expect(card).toHaveClass(/desktop-optimized/)
      
      // 测试鼠标操作
      await card.dblclick()
      await page.waitForSelector('[data-testid="card-modal"]')
    })
  })
})

// 辅助函数：创建测试卡片
async function createTestCard(page, options = {}) {
  const defaultOptions = {
    title: '测试卡片',
    content: '这是一个测试卡片',
    tags: ['测试']
  }
  
  const finalOptions = { ...defaultOptions, ...options }
  
  await page.click('[data-testid="create-card-button"]')
  await page.waitForSelector('[data-testid="card-modal"]')
  
  await page.fill('[data-testid="card-title"]', finalOptions.title)
  await page.fill('[data-testid="card-content"]', finalOptions.content)
  
  // 添加标签
  for (const tag of finalOptions.tags) {
    await page.click('[data-testid="tag-input"]')
    await page.fill('[data-testid="tag-input"]', tag)
    await page.press('[data-testid="tag-input"]', 'Enter')
  }
  
  await page.click('[data-testid="save-card-button"]')
  await page.waitForSelector('[data-testid="card-title"]:has-text("' + finalOptions.title + '")')
}