/**
 * 端到端测试辅助工具
 * 提供测试数据、Mock服务和通用测试函数
 */

import { test, expect } from '@playwright/test'

// 测试数据生成器
export class TestDataGenerator {
  static generateTestCards(count: number = 10) {
    return Array.from({ length: count }, (_, i) => ({
      id: `test-card-${i}`,
      title: `测试卡片 ${i}`,
      content: `这是第 ${i} 个测试卡片的内容，包含一些测试文本和格式。`,
      tags: [`标签${i % 5}`, `分类${i % 3}`],
      folderId: `test-folder-${i % 3}`,
      front: {
        title: `测试卡片 ${i}`,
        content: `正面内容 ${i}`,
        backgroundColor: `hsl(${i * 30}, 70%, 80%)`,
        backgroundImage: null
      },
      back: {
        content: `背面内容 ${i}`,
        tags: [`标签${i % 5}`, `分类${i % 3}`],
        notes: `备注 ${i}`
      },
      created_at: new Date(Date.now() - i * 1000 * 60).toISOString(),
      updated_at: new Date(Date.now() - i * 1000 * 60).toISOString(),
      version: 1,
      sync_status: 'synced'
    }))
  }

  static generateTestFolders(count: number = 5) {
    return Array.from({ length: count }, (_, i) => ({
      id: `test-folder-${i}`,
      name: `测试文件夹 ${i}`,
      description: `这是第 ${i} 个测试文件夹的描述`,
      color: `hsl(${i * 60}, 70%, 50%)`,
      icon: i % 3 === 0 ? '📁' : i % 3 === 1 ? '📂' : '🗂️',
      created_at: new Date(Date.now() - i * 1000 * 60 * 10).toISOString(),
      updated_at: new Date(Date.now() - i * 1000 * 60 * 10).toISOString(),
      parent_id: i > 0 ? `test-folder-${Math.floor(i / 2)}` : null,
      sort_order: i
    }))
  }

  static generateTestTags(count: number = 10) {
    return Array.from({ length: count }, (_, i) => ({
      id: `test-tag-${i}`,
      name: `标签${i}`,
      color: `hsl(${i * 36}, 70%, 60%)`,
      description: `标签${i}的描述`,
      usage_count: Math.floor(Math.random() * 50),
      created_at: new Date(Date.now() - i * 1000 * 60 * 5).toISOString()
    }))
  }

  static generateConflictData() {
    return [
      {
        id: 'conflict-card-1',
        type: 'content_conflict',
        local: {
          title: '本地版本标题',
          content: '本地版本内容',
          updated_at: new Date(Date.now() - 1000 * 60).toISOString()
        },
        remote: {
          title: '远程版本标题',
          content: '远程版本内容',
          updated_at: new Date(Date.now() - 1000 * 60 * 2).toISOString()
        },
        resolution_strategy: 'manual'
      },
      {
        id: 'conflict-card-2',
        type: 'delete_conflict',
        local: {
          deleted: false,
          title: '本地未删除的卡片',
          updated_at: new Date(Date.now() - 1000 * 60 * 3).toISOString()
        },
        remote: {
          deleted: true,
          title: '远程已删除的卡片',
          updated_at: new Date(Date.now() - 1000 * 60).toISOString()
        },
        resolution_strategy: 'keep_local'
      }
    ]
  }
}

// Mock服务配置
export class MockServiceSetup {
  static async setupAuthMocks(page) {
    // Mock认证API
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          email: 'test@example.com',
          created_at: new Date().toISOString()
        })
      })
    })

    await page.route('**/auth/v1/token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600
        })
      })
    })
  }

  static async setupDatabaseMocks(page) {
    // Mock数据库API
    await page.route('**/rest/v1/cards**', async (route) => {
      const method = route.request().method()

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(TestDataGenerator.generateTestCards())
        })
      } else if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'new-card-id',
            ...JSON.parse(route.request().postData())
          })
        })
      }
    })

    await page.route('**/rest/v1/folders**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TestDataGenerator.generateTestFolders())
      })
    })

    await page.route('**/rest/v1/tags**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TestDataGenerator.generateTestTags())
      })
    })
  }

  static async setupSyncMocks(page) {
    // Mock同步API
    await page.route('**/functions/v1/sync-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'synced',
          last_sync: new Date().toISOString(),
          pending_operations: 0,
          conflicts: []
        })
      })
    })

    await page.route('**/functions/v1/sync', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          synced_cards: 10,
          resolved_conflicts: 0,
          errors: []
        })
      })
    })
  }

  static async setupErrorMocks(page) {
    // Mock错误场景
    await page.route('**/rest/v1/cards**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal Server Error',
          message: '模拟服务器错误'
        })
      })
    })

    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Unauthorized',
          message: '认证失败'
        })
      })
    })
  }

  static async setupNetworkConditions(page, condition) {
    const context = page.context()

    if (condition.offline) {
      await context.setOffline(true)
    } else {
      await context.setOffline(false)

      // 设置网络条件（需要CDP支持）
      if (condition.downloadThroughput) {
        const client = await context.newCDPSession(page)
        await client.send('Network.emulateNetworkConditions', {
          offline: false,
          downloadThroughput: condition.downloadThroughput,
          uploadThroughput: condition.uploadThroughput || condition.downloadThroughput,
          latency: condition.latency || 0
        })
      }
    }
  }
}

// 性能测试工具
export class PerformanceTestHelper {
  static async measurePageLoadTime(page, url = '/') {
    const startTime = Date.now()
    await page.goto(url, { waitUntil: 'networkidle' })
    const loadTime = Date.now() - startTime
    return loadTime
  }

  static async measureInteractionTime(page, interaction) {
    const startTime = performance.now()
    await interaction()
    const endTime = performance.now()
    return endTime - startTime
  }

  static async getMemoryUsage(page) {
    const memoryInfo = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        }
      }
      return null
    })
    return memoryInfo
  }

  static async getNetworkMetrics(page) {
    const metrics = await page.evaluate(() => {
      if (performance.getEntriesByType) {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        if (navigation) {
          return {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            firstPaint: 0,
            firstContentfulPaint: 0
          }
        }
      }
      return null
    })

    // 获取Paint指标
    const paintMetrics = await page.evaluate(() => {
      const paintEntries = performance.getEntriesByType('paint')
      const metrics = {}
      paintEntries.forEach(entry => {
        metrics[entry.name] = entry.startTime
      })
      return metrics
    })

    return { ...metrics, ...paintMetrics }
  }
}

// 数据库测试工具
export class DatabaseTestHelper {
  static async clearIndexedDB(page) {
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const databases = indexedDB.databases()
        databases.then((dbList) => {
          let pending = dbList.length
          if (pending === 0) {
            resolve()
            return
          }

          dbList.forEach((db) => {
            const deleteRequest = indexedDB.deleteDatabase(db.name)
            deleteRequest.onsuccess = deleteRequest.onerror = () => {
              pending--
              if (pending === 0) {
                resolve()
              }
            }
          })
        })
      })
    })
  }

  static async createTestData(page, data) {
    await page.evaluate((testData) => {
      return new Promise((resolve) => {
        const request = indexedDB.open('CardAllDB', 1)

        request.onupgradeneeded = (event) => {
          const db = event.target.result

          // 创建对象存储
          if (!db.objectStoreNames.contains('cards')) {
            db.createObjectStore('cards', { keyPath: 'id' })
          }
          if (!db.objectStoreNames.contains('folders')) {
            db.createObjectStore('folders', { keyPath: 'id' })
          }
          if (!db.objectStoreNames.contains('tags')) {
            db.createObjectStore('tags', { keyPath: 'id' })
          }
        }

        request.onsuccess = (event) => {
          const db = event.target.result

          // 插入测试数据
          const transactions = []

          if (testData.cards) {
            const cardTx = db.transaction(['cards'], 'readwrite')
            const cardStore = cardTx.objectStore('cards')
            testData.cards.forEach(card => cardStore.add(card))
            transactions.push(new Promise(resolve => cardTx.oncomplete = resolve))
          }

          if (testData.folders) {
            const folderTx = db.transaction(['folders'], 'readwrite')
            const folderStore = folderTx.objectStore('folders')
            testData.folders.forEach(folder => folderStore.add(folder))
            transactions.push(new Promise(resolve => folderTx.oncomplete = resolve))
          }

          if (testData.tags) {
            const tagTx = db.transaction(['tags'], 'readwrite')
            const tagStore = tagTx.objectStore('tags')
            testData.tags.forEach(tag => tagStore.add(tag))
            transactions.push(new Promise(resolve => tagTx.oncomplete = resolve))
          }

          Promise.all(transactions).then(resolve)
        }
      })
    }, data)
  }

  static async verifyDataIntegrity(page) {
    return await page.evaluate(() => {
      return new Promise((resolve) => {
        const request = indexedDB.open('CardAllDB', 1)

        request.onsuccess = (event) => {
          const db = event.target.result
          const results = {}

          const transactions = []

          // 检查卡片数据
          if (db.objectStoreNames.contains('cards')) {
            const cardTx = db.transaction(['cards'], 'readonly')
            const cardStore = cardTx.objectStore('cards')
            const cardRequest = cardStore.getAll()

            cardRequest.onsuccess = () => {
              results.cards = cardRequest.result
              results.cardCount = cardRequest.result.length
              results.corruptedCards = cardRequest.result.filter(card =>
                !card.title || !card.id || !card.created_at
              )
            }
            transactions.push(new Promise(resolve => cardTx.oncomplete = resolve))
          }

          // 检查文件夹数据
          if (db.objectStoreNames.contains('folders')) {
            const folderTx = db.transaction(['folders'], 'readonly')
            const folderStore = folderTx.objectStore('folders')
            const folderRequest = folderStore.getAll()

            folderRequest.onsuccess = () => {
              results.folders = folderRequest.result
              results.folderCount = folderRequest.result.length
              results.corruptedFolders = folderRequest.result.filter(folder =>
                !folder.name || !folder.id
              )
            }
            transactions.push(new Promise(resolve => folderTx.oncomplete = resolve))
          }

          Promise.all(transactions).then(() => resolve(results))
        }
      })
    })
  }
}

// 用户界面测试工具
export class UITestHelper {
  static async waitForElement(page, selector, timeout = 10000) {
    return await page.waitForSelector(selector, { timeout })
  }

  static async verifyAccessibility(page) {
    // 基本可访问性检查
    const accessibilityIssues = await page.checkAccessibility()

    // 检查关键元素的可访问性属性
    const checks = [
      {
        selector: '[data-testid="create-card-button"]',
        attributes: ['aria-label', 'role', 'tabindex']
      },
      {
        selector: '[data-testid="card-title-input"]',
        attributes: ['aria-label', 'placeholder', 'type']
      },
      {
        selector: '[data-testid="search-input"]',
        attributes: ['aria-label', 'placeholder', 'type']
      }
    ]

    const results = []
    for (const check of checks) {
      const element = page.locator(check.selector)
      if (await element.isVisible()) {
        const elementResults = {}
        for (const attr of check.attributes) {
          elementResults[attr] = await element.getAttribute(attr)
        }
        results.push({ selector: check.selector, attributes: elementResults })
      }
    }

    return { accessibilityIssues, elementChecks: results }
  }

  static async testResponsiveDesign(page) {
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ]

    const results = []

    for (const viewport of viewports) {
      await page.setViewportSize(viewport)

      // 检查关键元素在不同屏幕尺寸下的可见性
      const checks = {
        createButton: await page.locator('[data-testid="create-card-button"]').isVisible(),
        searchInput: await page.locator('[data-testid="search-input"]').isVisible(),
        cardList: await page.locator('[data-testid="card-list"]').isVisible(),
        navigation: await page.locator('[data-testid="navigation"]').isVisible(),
        mobileMenu: viewport.width < 768 ?
          await page.locator('[data-testid="mobile-menu-button"]').isVisible() :
          null
      }

      results.push({ viewport: viewport.name, checks })
    }

    return results
  }

  static async performKeyboardNavigation(page) {
    const keyboardTestResults = []

    // 测试Tab导航
    await page.keyboard.press('Tab')
    const firstFocusable = await page.evaluate(() => document.activeElement?.tagName)
    keyboardTestResults.push({ action: 'first-tab', element: firstFocusable })

    // 测试Enter键操作
    await page.keyboard.press('Enter')
    const enterActionResult = await page.evaluate(() => {
      const active = document.activeElement
      return {
        tagName: active?.tagName,
        type: active?.type,
        onclick: !!active?.onclick
      }
    })
    keyboardTestResults.push({ action: 'enter-key', result: enterActionResult })

    // 测试Escape键
    await page.keyboard.press('Escape')
    const escapeActionResult = await page.evaluate(() => {
      const modals = document.querySelectorAll('[role="dialog"]')
      return { modalsVisible: modals.length, anyModalOpen: modals.length > 0 }
    })
    keyboardTestResults.push({ action: 'escape-key', result: escapeActionResult })

    return keyboardTestResults
  }
}

// 日志和监控工具
export class MonitoringTestHelper {
  static async captureConsoleLogs(page) {
    const logs = []

    page.on('console', msg => {
      logs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      })
    })

    page.on('pageerror', error => {
      logs.push({
        type: 'error',
        text: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
    })

    return logs
  }

  static async captureNetworkRequests(page) {
    const requests = []

    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        timestamp: new Date().toISOString()
      })
    })

    page.on('response', response => {
      const request = requests.find(r => r.url === response.url())
      if (request) {
        request.status = response.status()
        request.statusText = response.statusText()
        request.responseHeaders = response.headers()
      }
    })

    return requests
  }

  static async generatePerformanceReport(page) {
    const metrics = await PerformanceTestHelper.getNetworkMetrics(page)
    const memory = await PerformanceTestHelper.getMemoryUsage(page)

    return {
      timestamp: new Date().toISOString(),
      metrics,
      memory,
      url: page.url(),
      userAgent: await page.evaluate(() => navigator.userAgent)
    }
  }
}