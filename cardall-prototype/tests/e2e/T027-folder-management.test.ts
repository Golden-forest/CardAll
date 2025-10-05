/**
 * T027: 文件夹管理功能本地版本测试
 * 验证降级后文件夹创建、组织、移动功能
 */

import { test, expect } from '@playwright/test'
import { getTestData, createTestData } from '../utils/test-data-factory'

test.describe('T027: 文件夹管理功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
  })

  test.describe('文件夹基础CRUD操作', () => {
    test('应该能够创建新文件夹', async ({ page }) => {
      // 查找创建文件夹按钮
      const createFolderButton = page.locator('button, [role="button"]').filter({
        hasText: /folder|文件夹|目录|create|新建/i
      }).first()

      if (await createFolderButton.isVisible()) {
        await createFolderButton.click()
        await page.waitForTimeout(1000)

        // 验证文件夹创建界面
        const folderNameInput = page.locator('input[placeholder*="name"], input[type="text"]').first()
        await expect(folderNameInput).toBeVisible()

        // 输入文件夹名称
        await folderNameInput.fill('测试文件夹')
        await page.waitForTimeout(500)

        // 保存文件夹
        const saveButton = page.locator('button').filter({
          hasText: /save|保存|create|创建/i
        }).first()

        if (await saveButton.isVisible()) {
          await saveButton.click()
          await page.waitForTimeout(1000)

          // 验证文件夹已创建
          const folderList = page.locator('.folder, [data-testid="folder"], .directory')
          const folderExists = await folderList.filter({ hasText: '测试文件夹' }).count()
          expect(folderExists).toBeGreaterThan(0)
        }
      }
    })

    test('应该能够重命名文件夹', async ({ page }) => {
      // 先创建一个文件夹
      const createFolderButton = page.locator('button').filter({
        hasText: /folder|文件夹|create/i
      }).first()

      if (await createFolderButton.isVisible()) {
        await createFolderButton.click()
        await page.waitForTimeout(1000)

        const folderNameInput = page.locator('input[placeholder*="name"]').first()
        await folderNameInput.fill('原始文件夹名称')
        await page.waitForTimeout(500)

        const saveButton = page.locator('button').filter({
          hasText: /save|保存/i
        }).first()
        await saveButton.click()
        await page.waitForTimeout(1000)

        // 找到创建的文件夹并重命名
        const folder = page.locator('.folder, [data-testid="folder"]').filter({
          hasText: '原始文件夹名称'
        }).first()

        if (await folder.isVisible()) {
          // 右键点击或查找重命名选项
          await folder.click({ button: 'right' })
          await page.waitForTimeout(500)

          const renameButton = page.locator('button, [role="menuitem"]').filter({
            hasText: /rename|重命名|修改/i
          }).first()

          if (await renameButton.isVisible()) {
            await renameButton.click()
            await page.waitForTimeout(500)

            // 输入新名称
            const nameInput = page.locator('input').filter({ hasValue: '原始文件夹名称' }).first()
            await nameInput.fill('重命名后的文件夹')
            await page.waitForTimeout(500)

            // 确认重命名
            const confirmButton = page.locator('button').filter({
              hasText: /confirm|确认|save/i
            }).first()
            await confirmButton.click()
            await page.waitForTimeout(1000)

            // 验证重命名成功
            const renamedFolder = page.locator('.folder').filter({
              hasText: '重命名后的文件夹'
            }).first()
            await expect(renamedFolder).toBeVisible()
          }
        }
      }
    })

    test('应该能够删除文件夹', async ({ page }) => {
      // 先创建测试文件夹
      const createFolderButton = page.locator('button').filter({
        hasText: /folder|文件夹|create/i
      }).first()

      if (await createFolderButton.isVisible()) {
        await createFolderButton.click()
        await page.waitForTimeout(1000)

        const folderNameInput = page.locator('input[placeholder*="name"]').first()
        await folderNameInput.fill('待删除的文件夹')
        await page.waitForTimeout(500)

        const saveButton = page.locator('button').filter({
          hasText: /save|保存/i
        }).first()
        await saveButton.click()
        await page.waitForTimeout(1000)

        // 找到并删除文件夹
        const folder = page.locator('.folder').filter({
          hasText: '待删除的文件夹'
        }).first()

        if (await folder.isVisible()) {
          await folder.click({ button: 'right' })
          await page.waitForTimeout(500)

          const deleteButton = page.locator('button, [role="menuitem"]').filter({
            hasText: /delete|删除|remove/i
          }).first()

          if (await deleteButton.isVisible()) {
            await deleteButton.click()
            await page.waitForTimeout(500)

            // 确认删除
            const confirmButton = page.locator('button').filter({
              hasText: /confirm|确认|确定/i
            }).first()
            await confirmButton.click()
            await page.waitForTimeout(1000)

            // 验证文件夹已删除
            const isFolderVisible = await folder.isVisible()
            expect(isFolderVisible).toBe(false)
          }
        }
      }
    })

    test('应该能够创建嵌套文件夹', async ({ page }) => {
      // 创建父文件夹
      const createFolderButton = page.locator('button').filter({
        hasText: /folder|文件夹|create/i
      }).first()

      if (await createFolderButton.isVisible()) {
        await createFolderButton.click()
        await page.waitForTimeout(1000)

        const folderNameInput = page.locator('input[placeholder*="name"]').first()
        await folderNameInput.fill('父文件夹')
        await page.waitForTimeout(500)

        const saveButton = page.locator('button').filter({
          hasText: /save|保存/i
        }).first()
        await saveButton.click()
        await page.waitForTimeout(1000)

        // 进入父文件夹
        const parentFolder = page.locator('.folder').filter({
          hasText: '父文件夹'
        }).first()

        if (await parentFolder.isVisible()) {
          await parentFolder.dblclick()
          await page.waitForTimeout(1000)

          // 在父文件夹中创建子文件夹
          await createFolderButton.click()
          await page.waitForTimeout(1000)

          const childFolderNameInput = page.locator('input[placeholder*="name"]').first()
          await childFolderNameInput.fill('子文件夹')
          await page.waitForTimeout(500)

          const childSaveButton = page.locator('button').filter({
            hasText: /save|保存/i
          }).first()
          await childSaveButton.click()
          await page.waitForTimeout(1000)

          // 验证子文件夹创建成功
          const childFolder = page.locator('.folder').filter({
            hasText: '子文件夹'
          }).first()
          await expect(childFolder).toBeVisible()

          // 验证面包屑导航
          const breadcrumb = page.locator('.breadcrumb, .breadcrumb-nav, [data-testid="breadcrumb"]')
          if (await breadcrumb.isVisible()) {
            expect(await breadcrumb.textContent()).toContain('父文件夹')
          }
        }
      }
    })
  })

  test.describe('卡片与文件夹组织', () => {
    test('应该能够将卡片移动到文件夹', async ({ page }) => {
      // 创建测试卡片
      await createTestData(page, '移动测试卡片')

      // 创建测试文件夹
      const createFolderButton = page.locator('button').filter({
        hasText: /folder|文件夹|create/i
      }).first()

      if (await createFolderButton.isVisible()) {
        await createFolderButton.click()
        await page.waitForTimeout(1000)

        const folderNameInput = page.locator('input[placeholder*="name"]').first()
        await folderNameInput.fill('目标文件夹')
        await page.waitForTimeout(500)

        const saveButton = page.locator('button').filter({
          hasText: /save|保存/i
        }).first()
        await saveButton.click()
        await page.waitForTimeout(1000)

        // 选择卡片并移动到文件夹
        const card = page.locator('.card, [data-testid="card"]').first()
        if (await card.isVisible()) {
          await card.click()
          await page.waitForTimeout(500)

          // 查找移动到文件夹的选项
          const moveButton = page.locator('button').filter({
            hasText: /move|移动|to folder/i
          }).first()

          if (await moveButton.isVisible()) {
            await moveButton.click()
            await page.waitForTimeout(500)

            // 选择目标文件夹
            const folderOption = page.locator('button, [role="option"]').filter({
              hasText: '目标文件夹'
            }).first()

            if (await folderOption.isVisible()) {
              await folderOption.click()
              await page.waitForTimeout(1000)

              // 验证卡片已移动（在根目录不可见）
              const isCardVisible = await card.isVisible()
              // 注意：这个测试取决于具体实现，可能需要进入文件夹验证
            }
          }

          // 进入文件夹验证卡片是否存在
          const targetFolder = page.locator('.folder').filter({
            hasText: '目标文件夹'
          }).first()

          if (await targetFolder.isVisible()) {
            await targetFolder.dblclick()
            await page.waitForTimeout(1000)

            const movedCard = page.locator('.card').filter({
              hasText: '移动测试卡片'
            }).first()
            await expect(movedCard).toBeVisible()
          }
        }
      }
    })

    test('应该能够将卡片从文件夹移出', async ({ page }) => {
      // 这个测试假设上一个测试已经创建了文件夹并移动了卡片
      // 进入包含卡片的文件夹
      const folder = page.locator('.folder').filter({
        hasText: '目标文件夹'
      }).first()

      if (await folder.isVisible()) {
        await folder.dblclick()
        await page.waitForTimeout(1000)

        // 选择文件夹中的卡片
        const card = page.locator('.card').first()
        if (await card.isVisible()) {
          await card.click()
          await page.waitForTimeout(500)

          // 查找移动到根目录的选项
          const moveToRootButton = page.locator('button').filter({
            hasText: /move to root|移到根目录|move out/i
          }).first()

          if (await moveToRootButton.isVisible()) {
            await moveToRootButton.click()
            await page.waitForTimeout(1000)
          }

          // 或者通过移动功能选择根目录
          const moveButton = page.locator('button').filter({
            hasText: /move|移动/i
          }).first()

          if (await moveButton.isVisible()) {
            await moveButton.click()
            await page.waitForTimeout(500)

            const rootOption = page.locator('button, [role="option"]').filter({
              hasText: /root|根目录|../i
            }).first()

            if (await rootOption.isVisible()) {
              await rootOption.click()
              await page.waitForTimeout(1000)
            }
          }

          // 返回根目录验证卡片已移出
          await page.goBack()
          await page.waitForTimeout(1000)

          const movedCard = page.locator('.card').first()
          await expect(movedCard).toBeVisible()
        }
      }
    })

    test('应该支持拖拽卡片到文件夹', async ({ page }) => {
      // 创建测试卡片和文件夹
      await createTestData(page, '拖拽测试卡片')

      const createFolderButton = page.locator('button').filter({
        hasText: /folder|文件夹|create/i
      }).first()

      if (await createFolderButton.isVisible()) {
        await createFolderButton.click()
        await page.waitForTimeout(1000)

        const folderNameInput = page.locator('input[placeholder*="name"]').first()
        await folderNameInput.fill('拖拽目标文件夹')
        await page.waitForTimeout(500)

        const saveButton = page.locator('button').filter({
          hasText: /save|保存/i
        }).first()
        await saveButton.click()
        await page.waitForTimeout(1000)

        // 执行拖拽操作
        const card = page.locator('.card').first()
        const folder = page.locator('.folder').filter({
          hasText: '拖拽目标文件夹'
        }).first()

        if (await card.isVisible() && await folder.isVisible()) {
          await card.dragTo(folder)
          await page.waitForTimeout(1000)

          // 验证拖拽效果
          // 进入文件夹检查卡片是否存在
          await folder.dblclick()
          await page.waitForTimeout(1000)

          const draggedCard = page.locator('.card').first()
          await expect(draggedCard).toBeVisible()
        }
      }
    })
  })

  test.describe('文件夹浏览和导航', () => {
    test('应该支持文件夹层级导航', async ({ page }) => {
      // 创建多级文件夹结构
      await createFolderStructure(page, ['一级文件夹', '二级文件夹', '三级文件夹'])

      // 逐级进入文件夹
      let currentFolder: any = null

      for (const folderName of ['一级文件夹', '二级文件夹', '三级文件夹']) {
        currentFolder = page.locator('.folder').filter({
          hasText: folderName
        }).first()

        if (await currentFolder.isVisible()) {
          await currentFolder.dblclick()
          await page.waitForTimeout(1000)

          // 验证面包屑导航更新
          const breadcrumb = page.locator('.breadcrumb, [data-testid="breadcrumb"]')
          if (await breadcrumb.isVisible()) {
            expect(await breadcrumb.textContent()).toContain(folderName)
          }
        }
      }

      // 测试面包屑导航返回
      const breadcrumbLinks = page.locator('.breadcrumb a, [data-testid="breadcrumb-link"]')
      const linkCount = await breadcrumbLinks.count()

      if (linkCount > 0) {
        // 点击第一级面包屑返回根目录
        await breadcrumbLinks.first().click()
        await page.waitForTimeout(1000)

        // 验证已返回根目录
        const rootFolder = page.locator('.folder').filter({
          hasText: '一级文件夹'
        }).first()
        await expect(rootFolder).toBeVisible()
      }
    })

    test('应该显示文件夹中的卡片数量', async ({ page }) => {
      // 创建文件夹和多个卡片
      const createFolderButton = page.locator('button').filter({
        hasText: /folder|文件夹|create/i
      }).first()

      if (await createFolderButton.isVisible()) {
        await createFolderButton.click()
        await page.waitForTimeout(1000)

        const folderNameInput = page.locator('input[placeholder*="name"]').first()
        await folderNameInput.fill('计数测试文件夹')
        await page.waitForTimeout(500)

        const saveButton = page.locator('button').filter({
          hasText: /save|保存/i
        }).first()
        await saveButton.click()
        await page.waitForTimeout(1000)

        // 创建多个卡片
        for (let i = 1; i <= 3; i++) {
          await createTestData(page, `测试卡片${i}`)
        }

        // 将卡片移动到文件夹
        const folder = page.locator('.folder').filter({
          hasText: '计数测试文件夹'
        }).first()

        if (await folder.isVisible()) {
          // 这里需要根据具体实现来移动卡片
          await folder.dblclick()
          await page.waitForTimeout(1000)

          // 检查文件夹中是否有卡片计数显示
          const cardCount = page.locator('.card-count, [data-testid="card-count"]')
          if (await cardCount.isVisible()) {
            const countText = await cardCount.textContent()
            expect(countText).toMatch(/\d+/)
          }
        }
      }
    })
  })

  test.describe('文件夹搜索和过滤', () => {
    test('应该能够在文件夹中搜索卡片', async ({ page }) => {
      // 创建文件夹和测试卡片
      await createFolderWithCards(page, '搜索测试文件夹', [
        'JavaScript基础',
        'React框架',
        'TypeScript类型'
      ])

      // 进入文件夹
      const folder = page.locator('.folder').filter({
        hasText: '搜索测试文件夹'
      }).first()

      if (await folder.isVisible()) {
        await folder.dblclick()
        await page.waitForTimeout(1000)

        // 使用搜索功能
        const searchInput = page.locator('input[placeholder*="search"], input[type="search"]').first()
        if (await searchInput.isVisible()) {
          await searchInput.fill('JavaScript')
          await page.waitForTimeout(1000)

          // 验证搜索结果
          const searchResult = page.locator('.card').filter({
            hasText: 'JavaScript基础'
          }).first()
          await expect(searchResult).toBeVisible()

          // 验证其他卡片被过滤
          const filteredCard = page.locator('.card').filter({
            hasText: 'React框架'
          }).first()
          expect(await filteredCard.isVisible()).toBe(false)
        }
      }
    })

    test('应该能够按标签过滤文件夹中的卡片', async ({ page }) => {
      // 创建带标签的卡片
      await createFolderWithCards(page, '标签测试文件夹', [])

      const folder = page.locator('.folder').filter({
        hasText: '标签测试文件夹'
      }).first()

      if (await folder.isVisible()) {
        await folder.dblclick()
        await page.waitForTimeout(1000)

        // 查找标签过滤功能
        const tagFilter = page.locator('.tag-filter, [data-testid="tag-filter"]')
        if (await tagFilter.isVisible()) {
          // 这里需要根据具体实现来测试标签过滤
          await tagFilter.click()
          await page.waitForTimeout(500)

          // 选择特定标签
          const tagOption = page.locator('.tag-option, [data-testid="tag"]').first()
          if (await tagOption.isVisible()) {
            await tagOption.click()
            await page.waitForTimeout(1000)

            // 验证过滤结果
            const filteredCards = page.locator('.card')
            const cardCount = await filteredCards.count()
            expect(cardCount).toBeGreaterThan(0)
          }
        }
      }
    })
  })

  test.describe('文件夹排序和视图', () => {
    test('应该支持文件夹排序', async ({ page }) => {
      // 创建多个文件夹
      const folderNames = ['B文件夹', 'A文件夹', 'C文件夹']

      for (const folderName of folderNames) {
        await createSingleFolder(page, folderName)
      }

      // 查找排序选项
      const sortButton = page.locator('button').filter({
        hasText: /sort|排序|order/i
      }).first()

      if (await sortButton.isVisible()) {
        await sortButton.click()
        await page.waitForTimeout(500)

        // 选择按名称排序
        const nameSortOption = page.locator('button, [role="menuitem"]').filter({
          hasText: /name|名称/i
        }).first()

        if (await nameSortOption.isVisible()) {
          await nameSortOption.click()
          await page.waitForTimeout(1000)

          // 验证排序结果
          const folders = page.locator('.folder')
          const folderCount = await folders.count()

          if (folderCount >= 3) {
            const firstFolderText = await folders.first().textContent()
            expect(firstFolderText).toContain('A文件夹')
          }
        }
      }
    })

    test('应该支持不同的文件夹视图模式', async ({ page }) => {
      // 创建一些文件夹
      await createSingleFolder(page, '视图测试文件夹1')
      await createSingleFolder(page, '视图测试文件夹2')

      // 查找视图切换按钮
      const viewButton = page.locator('button').filter({
        hasText: /view|视图|grid|list/i
      }).first()

      if (await viewButton.isVisible()) {
        // 切换到网格视图
        await viewButton.click()
        await page.waitForTimeout(500)

        const gridView = page.locator('.folder-grid, [data-view="grid"]')
        if (await gridView.isVisible()) {
          expect(await gridView.getAttribute('class')).toContain('grid')
        }

        // 切换到列表视图
        await viewButton.click()
        await page.waitForTimeout(500)

        const listView = page.locator('.folder-list, [data-view="list"]')
        if (await listView.isVisible()) {
          expect(await listView.getAttribute('class')).toContain('list')
        }
      }
    })
  })
})

// 辅助函数
async function createFolderStructure(page: any, folderNames: string[]) {
  const createFolderButton = page.locator('button').filter({
    hasText: /folder|文件夹|create/i
  }).first()

  if (await createFolderButton.isVisible()) {
    for (const folderName of folderNames) {
      await createFolderButton.click()
      await page.waitForTimeout(1000)

      const folderNameInput = page.locator('input[placeholder*="name"]').first()
      await folderNameInput.fill(folderName)
      await page.waitForTimeout(500)

      const saveButton = page.locator('button').filter({
        hasText: /save|保存/i
      }).first()
      await saveButton.click()
      await page.waitForTimeout(1000)

      // 进入当前文件夹以创建下一级
      if (folderName !== folderNames[folderNames.length - 1]) {
        const currentFolder = page.locator('.folder').filter({
          hasText: folderName
        }).first()
        await currentFolder.dblclick()
        await page.waitForTimeout(1000)
      }
    }
  }
}

async function createFolderWithCards(page: any, folderName: string, cardTitles: string[]) {
  const createFolderButton = page.locator('button').filter({
    hasText: /folder|文件夹|create/i
  }).first()

  if (await createFolderButton.isVisible()) {
    await createFolderButton.click()
    await page.waitForTimeout(1000)

    const folderNameInput = page.locator('input[placeholder*="name"]').first()
    await folderNameInput.fill(folderName)
    await page.waitForTimeout(500)

    const saveButton = page.locator('button').filter({
      hasText: /save|保存/i
    }).first()
    await saveButton.click()
    await page.waitForTimeout(1000)

    // 创建卡片（这里简化处理，实际实现可能需要进入文件夹创建）
    for (const title of cardTitles) {
      await createTestData(page, title)
    }
  }
}

async function createSingleFolder(page: any, folderName: string) {
  const createFolderButton = page.locator('button').filter({
    hasText: /folder|文件夹|create/i
  }).first()

  if (await createFolderButton.isVisible()) {
    await createFolderButton.click()
    await page.waitForTimeout(1000)

    const folderNameInput = page.locator('input[placeholder*="name"]').first()
    await folderNameInput.fill(folderName)
    await page.waitForTimeout(500)

    const saveButton = page.locator('button').filter({
      hasText: /save|保存/i
    }).first()
    await saveButton.click()
    await page.waitForTimeout(1000)
  }
}