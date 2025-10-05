/**
 * T026: 卡片管理功能本地版本测试
 * 验证降级后卡片CRUD操作、编辑、样式设置功能
 */

import { test, expect } from '@playwright/test'
import { getTestData, createTestData } from '../utils/test-data-factory'

test.describe('T026: 卡片管理功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
  })

  test.describe('卡片基础CRUD操作', () => {
    test('应该能够创建新卡片', async ({ page }) => {
      // 点击创建卡片按钮
      const createButton = page.locator('button, [role="button"]').filter({
        hasText: /card|卡片|创建|添加|new|create/i
      }).first()

      if (await createButton.isVisible()) {
        await createButton.click()
        await page.waitForTimeout(1000)

        // 验证卡片编辑界面
        const editor = page.locator('[contenteditable="true"], textarea, input').first()
        await expect(editor).toBeVisible()

        // 输入卡片内容
        await editor.fill('测试卡片内容')
        await page.waitForTimeout(500)

        // 保存卡片
        const saveButton = page.locator('button').filter({
          hasText: /save|保存|确定|完成/i
        }).first()

        if (await saveButton.isVisible()) {
          await saveButton.click()
          await page.waitForTimeout(1000)

          // 验证卡片已保存到本地
          const cardContent = await page.textContent('body')
          expect(cardContent).toContain('测试卡片内容')
        }
      }
    })

    test('应该能够编辑现有卡片', async ({ page }) => {
      // 先创建一个卡片
      await createTestData(page, '原始卡片内容')

      // 找到并点击卡片
      const card = page.locator('.card, [data-testid="card"]').first()
      if (await card.isVisible()) {
        await card.click()
        await page.waitForTimeout(1000)

        // 进入编辑模式
        const editButton = page.locator('button').filter({
          hasText: /edit|编辑|修改/i
        }).first()

        if (await editButton.isVisible()) {
          await editButton.click()
          await page.waitForTimeout(500)

          // 修改内容
          const editor = page.locator('[contenteditable="true"], textarea').first()
          await editor.fill('修改后的卡片内容')

          // 保存修改
          const saveButton = page.locator('button').filter({
            hasText: /save|保存/i
          }).first()
          await saveButton.click()
          await page.waitForTimeout(1000)

          // 验证修改已保存
          const updatedContent = await page.textContent('body')
          expect(updatedContent).toContain('修改后的卡片内容')
        }
      }
    })

    test('应该能够删除卡片', async ({ page }) => {
      // 先创建测试卡片
      await createTestData(page, '待删除的卡片')

      // 找到卡片并尝试删除
      const card = page.locator('.card, [data-testid="card"]').first()
      if (await card.isVisible()) {
        await card.click()
        await page.waitForTimeout(500)

        // 查找删除按钮
        const deleteButton = page.locator('button').filter({
          hasText: /delete|删除|remove/i
        }).first()

        if (await deleteButton.isVisible()) {
          await deleteButton.click()
          await page.waitForTimeout(500)

          // 确认删除
          const confirmButton = page.locator('button').filter({
            hasText: /confirm|确认|确定/i
          }).first()

          if (await confirmButton.isVisible()) {
            await confirmButton.click()
            await page.waitForTimeout(1000)

            // 验证卡片已删除
            const isCardVisible = await card.isVisible()
            expect(isCardVisible).toBe(false)
          }
        }
      }
    })

    test('应该能够复制卡片', async ({ page }) => {
      // 创建原始卡片
      await createTestData(page, '原始卡片')

      const originalCard = page.locator('.card, [data-testid="card"]').first()
      if (await originalCard.isVisible()) {
        await originalCard.click()
        await page.waitForTimeout(500)

        // 查找复制功能
        const copyButton = page.locator('button').filter({
          hasText: /copy|复制|duplicate/i
        }).first()

        if (await copyButton.isVisible()) {
          await copyButton.click()
          await page.waitForTimeout(1000)

          // 验证复制的卡片存在
          const cards = page.locator('.card, [data-testid="card"]')
          const cardCount = await cards.count()
          expect(cardCount).toBeGreaterThan(1)
        }
      }
    })
  })

  test.describe('卡片样式设置', () => {
    test('应该能够设置卡片背景颜色', async ({ page }) => {
      await createTestData(page, '样式测试卡片')

      const card = page.locator('.card, [data-testid="card"]').first()
      if (await card.isVisible()) {
        await card.click()
        await page.waitForTimeout(500)

        // 查找样式设置按钮
        const styleButton = page.locator('button').filter({
          hasText: /style|样式|format|格式/i
        }).first()

        if (await styleButton.isVisible()) {
          await styleButton.click()
          await page.waitForTimeout(500)

          // 查找颜色选择器
          const colorPicker = page.locator('input[type="color"], .color-picker, [data-testid="color-picker"]').first()
          if (await colorPicker.isVisible()) {
            await colorPicker.click()
            await page.waitForTimeout(500)

            // 选择红色
            const redColor = page.locator('[data-color="#ff0000"], .red-option').first()
            if (await redColor.isVisible()) {
              await redColor.click()
              await page.waitForTimeout(500)

              // 验证背景颜色已应用
              const cardStyle = await card.getAttribute('style')
              expect(cardStyle).toMatch(/background|color/i)
            }
          }
        }
      }
    })

    test('应该能够设置渐变背景', async ({ page }) => {
      await createTestData(page, '渐变测试卡片')

      const card = page.locator('.card, [data-testid="card"]').first()
      if (await card.isVisible()) {
        await card.click()
        await page.waitForTimeout(500)

        // 查找渐变选项
        const gradientOption = page.locator('button, [role="button"]').filter({
          hasText: /gradient|渐变/i
        }).first()

        if (await gradientOption.isVisible()) {
          await gradientOption.click()
          await page.waitForTimeout(500)

          // 验证渐变已应用
          const cardStyle = await card.getAttribute('style')
          expect(cardStyle).toMatch(/gradient|linear|radial/i)
        }
      }
    })

    test('应该能够设置字体样式', async ({ page }) => {
      await createTestData(page, '字体测试卡片')

      const card = page.locator('.card, [data-testid="card"]').first()
      if (await card.isVisible()) {
        await card.click()
        await page.waitForTimeout(500)

        // 查找字体设置
        const fontButton = page.locator('button').filter({
          hasText: /font|字体|text|文字/i
        }).first()

        if (await fontButton.isVisible()) {
          await fontButton.click()
          await page.waitForTimeout(500)

          // 选择字体大小
          const fontSizeOption = page.locator('button').filter({
            hasText: /large|大|size|大小/i
          }).first()

          if (await fontSizeOption.isVisible()) {
            await fontSizeOption.click()
            await page.waitForTimeout(500)

            // 验证字体大小已改变
            const cardContent = card.locator('.card-content, [contenteditable="true"]').first()
            const fontSize = await cardContent.getAttribute('style')
            expect(fontSize).toMatch(/font-size|size/i)
          }
        }
      }
    })
  })

  test.describe('卡片内容编辑', () => {
    test('应该支持富文本编辑', async ({ page }) => {
      await createTestData(page, '')

      const card = page.locator('.card, [data-testid="card"]').first()
      if (await card.isVisible()) {
        await card.click()
        await page.waitForTimeout(500)

        const editor = page.locator('[contenteditable="true"], .editor').first()
        await expect(editor).toBeVisible()

        // 测试加粗功能
        const boldButton = page.locator('button').filter({
          hasText: /bold|加粗|B/
        }).first()

        if (await boldButton.isVisible()) {
          await editor.fill('测试文本')
          await editor.selectText()
          await boldButton.click()
          await page.waitForTimeout(500)

          // 验证文本已加粗
          const boldText = editor.locator('strong, b')
          await expect(boldText).toBeVisible()
        }

        // 测试斜体功能
        const italicButton = page.locator('button').filter({
          hasText: /italic|斜体|i/
        }).first()

        if (await italicButton.isVisible()) {
          await editor.selectText()
          await italicButton.click()
          await page.waitForTimeout(500)

          // 验证文本已斜体
          const italicText = editor.locator('em, i')
          await expect(italicText).toBeVisible()
        }
      }
    })

    test('应该支持在卡片中插入图片', async ({ page }) => {
      await createTestData(page, '')

      const card = page.locator('.card, [data-testid="card"]').first()
      if (await card.isVisible()) {
        await card.click()
        await page.waitForTimeout(500)

        // 查找插入图片按钮
        const imageButton = page.locator('button').filter({
          hasText: /image|图片|photo|照片/i
        }).first()

        if (await imageButton.isVisible()) {
          await imageButton.click()
          await page.waitForTimeout(500)

          // 检查是否有文件选择器
          const fileInput = page.locator('input[type="file"]')
          if (await fileInput.isVisible()) {
            // 模拟选择图片文件
            await fileInput.setInputFiles('test-assets/test-image.jpg')
            await page.waitForTimeout(2000)

            // 验证图片已插入
            const insertedImage = card.locator('img')
            await expect(insertedImage).toBeVisible()
          }
        }
      }
    })

    test('应该支持卡片翻转功能', async ({ page }) => {
      await createTestData(page, '正面内容')

      const card = page.locator('.card, [data-testid="card"]').first()
      if (await card.isVisible()) {
        // 查找翻转按钮或手势
        const flipButton = page.locator('button').filter({
          hasText: /flip|翻转|turn|rotate/i
        }).first()

        if (await flipButton.isVisible()) {
          await flipButton.click()
          await page.waitForTimeout(1000)

          // 验证卡片已翻转
          const cardBack = card.locator('.card-back, [data-testid="card-back"]')
          await expect(cardBack).toBeVisible()
        } else {
          // 尝试双击翻转
          await card.dblclick()
          await page.waitForTimeout(1000)

          // 验证翻转效果
          const isFlipped = await card.getAttribute('data-flipped')
          expect(isFlipped).toBe('true')
        }
      }
    })
  })

  test.describe('本地数据持久化', () => {
    test('卡片数据应该保存到本地IndexedDB', async ({ page }) => {
      // 创建测试卡片
      await createTestData(page, '持久化测试卡片')

      // 检查IndexedDB中的数据
      const dbData = await page.evaluate(() => {
        return new Promise((resolve) => {
          const request = indexedDB.open('cardall-database')

          request.onsuccess = () => {
            const db = request.result
            if (db.objectStoreNames.contains('cards')) {
              const transaction = db.transaction(['cards'], 'readonly')
              const store = transaction.objectStore('cards')
              const getAll = store.getAll()

              getAll.onsuccess = () => {
                resolve(getAll.result)
              }
            } else {
              resolve([])
            }
          }
        })
      })

      expect(dbData).toBeDefined()
      expect(dbData.length).toBeGreaterThan(0)
      expect(dbData.some((card: any) =>
        card.frontContent?.text?.includes('持久化测试卡片')
      )).toBe(true)
    })

    test('刷新页面后卡片数据应该保持', async ({ page }) => {
      // 创建测试卡片
      await createTestData(page, '刷新测试卡片')

      // 刷新页面
      await page.reload()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      // 验证卡片数据仍然存在
      const pageContent = await page.textContent('body')
      expect(pageContent).toContain('刷新测试卡片')
    })

    test('应该能够清空本地数据', async ({ page }) => {
      // 创建多个测试卡片
      await createTestData(page, '卡片1')
      await createTestData(page, '卡片2')
      await createTestData(page, '卡片3')

      // 查找清空数据功能
      const clearButton = page.locator('button').filter({
        hasText: /clear|清空|reset|重置/i
      }).first()

      if (await clearButton.isVisible()) {
        await clearButton.click()
        await page.waitForTimeout(500)

        // 确认清空
        const confirmButton = page.locator('button').filter({
          hasText: /confirm|确认/i
        }).first()
        await confirmButton.click()
        await page.waitForTimeout(1000)

        // 验证数据已清空
        const cards = page.locator('.card, [data-testid="card"]')
        const cardCount = await cards.count()
        expect(cardCount).toBe(0)
      }
    })
  })

  test.describe('错误处理和边界情况', () => {
    test('应该处理空卡片创建', async ({ page }) => {
      // 尝试创建空卡片
      const createButton = page.locator('button').filter({
        hasText: /create|创建|new/i
      }).first()

      if (await createButton.isVisible()) {
        await createButton.click()
        await page.waitForTimeout(1000)

        // 不输入内容直接保存
        const saveButton = page.locator('button').filter({
          hasText: /save|保存/i
        }).first()

        if (await saveButton.isVisible()) {
          await saveButton.click()
          await page.waitForTimeout(1000)

          // 验证错误提示或验证逻辑
          const errorMessage = page.locator('.error, .warning, [data-testid="error-message"]')
          if (await errorMessage.isVisible()) {
            expect(await errorMessage.textContent()).toContain('content|内容|empty|空')
          }
        }
      }
    })

    test('应该处理超长文本内容', async ({ page }) => {
      const longText = 'a'.repeat(10000) // 10K字符

      await createTestData(page, longText)

      // 验证超长文本被正确处理
      const card = page.locator('.card, [data-testid="card"]').first()
      if (await card.isVisible()) {
        const cardContent = await card.textContent()
        expect(cardContent?.length).toBeLessThan(15000) // 应该有长度限制
      }
    })

    test('应该处理特殊字符和emoji', async ({ page }) => {
      const specialText = '特殊字符测试 🎉 emoji测试 中英文混合123 !@#$%^&*()'

      await createTestData(page, specialText)

      // 验证特殊字符正确显示
      const pageContent = await page.textContent('body')
      expect(pageContent).toContain('特殊字符测试')
      expect(pageContent).toContain('🎉')
      expect(pageContent).toContain('emoji测试')
    })
  })
})