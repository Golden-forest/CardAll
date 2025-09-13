# CardEverything 测试策略文档

## 1. 测试目标

### 1.1 质量目标
- **代码覆盖率**：总体 ≥ 90%，关键路径 ≥ 95%
- **Bug密度**：生产环境每千行代码 < 0.5个
- **性能指标**：关键操作响应时间 < 200ms
- **兼容性**：支持 Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

### 1.2 覆盖范围
- **单元测试**：核心服务、工具函数、组件逻辑
- **集成测试**：数据库操作、API集成、状态管理
- **E2E测试**：用户操作流程、跨页面交互
- **性能测试**：响应时间、内存使用、渲染性能
- **安全测试**：数据加密、认证授权、XSS防护

## 2. 测试框架配置

### 2.1 Jest 配置优化
```typescript
// jest.config.ts 优化版本
export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/tests/__mocks__/file-mock.js',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/**/*.stories.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 90,
      statements: 90,
    },
    // 关键模块更高要求
    './src/services/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/components/card/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  testMatch: [
    '**/__tests__/**/*.{ts,tsx}',
    '**/*.{test,spec}.{ts,tsx}',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  testTimeout: 10000,
  maxWorkers: 4,
  verbose: true,
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
}
```

### 2.2 Playwright 配置增强
```typescript
// playwright.config.ts 增强版本
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 1,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'test-results.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
    timeout: 60000,
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
```

## 3. 测试目录结构

```
tests/
├── __mocks__/                    # Mock 文件
│   ├── file-mock.js
│   ├── style-mock.js
│   └── supabase-mock.js
├── fixtures/                     # 测试数据
│   ├── data-fixtures.ts          # 数据生成器
│   ├── mock-services.ts          # 服务Mock
│   └── test-utils.tsx            # 测试工具
├── unit/                         # 单元测试
│   ├── components/               # 组件测试
│   │   ├── card/
│   │   │   ├── flip-card.test.tsx
│   │   │   ├── masonry-grid.test.tsx
│   │   │   └── rich-text-editor.test.tsx
│   │   ├── folder/
│   │   │   ├── folder-tree.test.tsx
│   │   │   └── context-menu.test.tsx
│   │   └── tag/
│   │       ├── tag-panel.test.tsx
│   │       └── tag-grid.test.tsx
│   ├── services/                 # 服务测试
│   │   ├── cloud-sync.test.ts
│   │   ├── database.test.ts
│   │   ├── auth.test.ts
│   │   └── sync-queue.test.ts
│   ├── hooks/                    # Hook测试
│   │   ├── use-cards-db.test.ts
│   │   ├── use-folders-db.test.ts
│   │   └── use-screenshot.test.ts
│   └── utils/                    # 工具函数测试
│       ├── copy-utils.test.ts
│       └── validation-utils.test.ts
├── integration/                  # 集成测试
│   ├── database/
│   │   └── database-integration.test.ts
│   ├── sync/
│   │   ├── sync-system-integration.test.ts
│   │   └── conflict-resolution.test.ts
│   ├── api/
│   │   └── supabase-integration.test.ts
│   └── components/
│       └── component-interaction.test.tsx
├── e2e/                          # E2E测试
│   ├── auth/
│   │   └── authentication-flow.test.ts
│   ├── card-operations/
│   │   ├── card-creation.test.ts
│   │   ├── card-editing.test.ts
│   │   └── card-workflow.test.ts
│   ├── folder-operations/
│   │   ├── folder-management.test.ts
│   │   └── drag-drop.test.ts
│   ├── sync-workflows/
│   │   ├── offline-sync.test.ts
│   │   └── conflict-handling.test.ts
│   └── performance/
│       ├── large-dataset.test.ts
│       └── memory-usage.test.ts
├── performance/                  # 性能测试
│   ├── sync-performance.test.ts
│   ├── render-performance.test.ts
│   └── memory-leak.test.ts
├── accessibility/                # 无障碍测试
│   ├── keyboard-navigation.test.ts
│   └── screen-reader.test.ts
├── security/                     # 安全测试
│   ├── data-encryption.test.ts
│   └── auth-security.test.ts
└── test-utils.tsx               # 通用测试工具
```

## 4. 核心功能测试用例设计

### 4.1 同步系统测试
```typescript
// tests/unit/services/cloud-sync.test.ts
describe('CloudSyncService', () => {
  describe('队列管理', () => {
    it('应该正确添加和处理同步操作', async () => {
      const operation = {
        type: 'create' as const,
        table: 'cards' as const,
        data: mockCardData,
        localId: 'test-card-id'
      }
      
      await cloudSyncService.queueOperation(operation)
      
      const queue = cloudSyncService.getSyncQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0].localId).toBe('test-card-id')
    })

    it('应该处理网络错误和重试逻辑', async () => {
      // 模拟网络错误
      mockSupabaseClient.from().upsert.mockRejectedValue(new Error('Network error'))
      
      const operation = {
        type: 'create' as const,
        table: 'cards' as const,
        data: mockCardData,
        localId: 'test-card-id'
      }
      
      await cloudSyncService.queueOperation(operation)
      
      // 验证重试机制
      expect(cloudSyncService.getRetryCount()).toBe(1)
    })
  })

  describe('冲突解决', () => {
    it('应该检测和解决数据冲突', async () => {
      const localCard = generateMockCard({
        id: 'conflict-card',
        frontContent: { title: 'Local Version' },
        updatedAt: new Date('2024-01-02')
      })
      
      const remoteCard = generateMockCard({
        id: 'conflict-card',
        frontContent: { title: 'Remote Version' },
        updatedAt: new Date('2024-01-03')
      })
      
      const resolution = await cloudSyncService.resolveConflict(localCard, remoteCard)
      
      expect(resolution.frontContent.title).toBe('Remote Version')
    })
  })

  describe('离线支持', () => {
    it('应该在离线时缓存操作', async () => {
      // 模拟离线状态
      Object.defineProperty(navigator, 'onLine', {
        get: () => false,
        configurable: true
      })
      
      const operation = {
        type: 'create' as const,
        table: 'cards' as const,
        data: mockCardData,
        localId: 'test-card-id'
      }
      
      await cloudSyncService.queueOperation(operation)
      
      const cachedOps = await cloudSyncService.getCachedOperations()
      expect(cachedOps).toHaveLength(1)
    })
  })
})
```

### 4.2 数据库集成测试
```typescript
// tests/integration/database/database-integration.test.ts
describe('Database Integration', () => {
  beforeEach(async () => {
    await db.clearAll()
  })

  describe('CRUD操作', () => {
    it('应该正确创建、读取、更新和删除卡片', async () => {
      // 创建
      const cardId = await db.createCard({
        frontContent: mockCardContent,
        backContent: mockCardContent,
        style: mockCardStyle,
        isFlipped: false
      })
      
      // 读取
      const card = await db.cards.get(cardId)
      expect(card).toBeDefined()
      expect(card?.frontContent.title).toBe(mockCardContent.title)
      
      // 更新
      await db.updateCard(cardId, {
        frontContent: { ...mockCardContent, title: 'Updated Title' }
      })
      
      const updatedCard = await db.cards.get(cardId)
      expect(updatedCard?.frontContent.title).toBe('Updated Title')
      
      // 删除
      await db.deleteCard(cardId)
      const deletedCard = await db.cards.get(cardId)
      expect(deletedCard).toBeUndefined()
    })
  })

  describe('事务处理', () => {
    it('应该在事务失败时回滚所有操作', async () => {
      await expect(db.transaction('rw', [db.cards, db.folders], async () => {
        await db.cards.add(mockCard1)
        await db.folders.add(mockFolder)
        throw new Error('Transaction failed')
      })).rejects.toThrow()
      
      const cardCount = await db.cards.count()
      const folderCount = await db.folders.count()
      expect(cardCount).toBe(0)
      expect(folderCount).toBe(0)
    })
  })

  describe('性能测试', () => {
    it('应该在大数据量下保持良好性能', async () => {
      const startTime = performance.now()
      
      // 批量插入1000条数据
      const cards = Array.from({ length: 1000 }, (_, i) => ({
        ...mockCardData,
        id: `card-${i}`
      }))
      
      await db.cards.bulkAdd(cards)
      
      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(2000) // 2秒内完成
      
      // 查询性能
      const queryStart = performance.now()
      const results = await db.cards.where('folderId').equals('test-folder').toArray()
      const queryEnd = performance.now()
      
      expect(queryEnd - queryStart).toBeLessThan(100) // 100ms内完成查询
    })
  })
})
```

### 4.3 E2E测试用例
```typescript
// tests/e2e/card-operations/card-workflow.test.ts
describe('Card Workflow E2E', () => {
  beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="dashboard"]')
  })

  test('完整的卡片创建到删除流程', async ({ page }) => {
    // 创建卡片
    await page.click('[data-testid="create-card-btn"]')
    await page.fill('[data-testid="card-title-input"]', 'Test Card')
    await page.fill('[data-testid="card-content-textarea"]', 'Test content')
    await page.click('[data-testid="save-card-btn"]')
    
    // 验证卡片创建成功
    await expect(page.locator('[data-card-id]').first()).toBeVisible()
    await expect(page.locator('text=Test Card')).toBeVisible()
    
    // 编辑卡片
    await page.click('[data-testid="edit-card-btn"]')
    await page.fill('[data-testid="card-title-input"]', 'Updated Test Card')
    await page.click('[data-testid="save-card-btn"]')
    
    // 验证编辑成功
    await expect(page.locator('text=Updated Test Card')).toBeVisible()
    
    // 翻转卡片
    await page.click('[data-testid="flip-card-btn"]')
    await expect(page.locator('[data-testid="card-back-side"]')).toBeVisible()
    
    // 复制卡片内容
    await page.click('[data-testid="copy-card-btn"]')
    // 验证剪贴板内容（需要浏览器权限）
    
    // 截图功能
    await page.click('[data-testid="screenshot-card-btn"]')
    await expect(page.locator('[data-testid="screenshot-modal"]')).toBeVisible()
    
    // 删除卡片
    await page.click('[data-testid="delete-card-btn"]')
    await page.click('[data-testid="confirm-delete-btn"]')
    
    // 验证删除成功
    await expect(page.locator('text=Updated Test Card')).not.toBeVisible()
  })

  test('文件夹管理流程', async ({ page }) => {
    // 创建文件夹
    await page.click('[data-testid="create-folder-btn"]')
    await page.fill('[data-testid="folder-name-input"]', 'Test Folder')
    await page.click('[data-testid="save-folder-btn"]')
    
    // 验证文件夹创建
    await expect(page.locator('text=Test Folder')).toBeVisible()
    
    // 拖拽卡片到文件夹
    const card = page.locator('[data-card-id]').first()
    const folder = page.locator('text=Test Folder')
    
    await card.dragTo(folder)
    
    // 验证卡片移动成功
    await folder.click()
    await expect(page.locator('[data-card-id]').first()).toBeVisible()
  })

  test('标签管理流程', async ({ page }) => {
    // 为卡片添加标签
    await page.click('[data-testid="edit-card-btn"]')
    await page.click('[data-testid="add-tag-btn"]')
    await page.fill('[data-testid="tag-input"]', 'test-tag')
    await page.press('[data-testid="tag-input"]', 'Enter')
    await page.click('[data-testid="save-card-btn"]')
    
    // 验证标签添加成功
    await expect(page.locator('[data-testid="tag-badge"]')).toHaveText('test-tag')
    
    // 使用标签筛选
    await page.click('[data-testid="tag-filter-test-tag"]')
    
    // 验证筛选结果
    const visibleCards = await page.locator('[data-card-id]').count()
    expect(visibleCards).toBeGreaterThan(0)
    
    // 验证所有可见卡片都有该标签
    const allCardsHaveTag = await page.$$eval('[data-card-id]', (cards) => {
      return cards.every(card => 
        card.querySelector('[data-testid="tag-badge"]')?.textContent === 'test-tag'
      )
    })
    expect(allCardsHaveTag).toBe(true)
  })
})
```

## 5. 测试工具和辅助函数

### 5.1 测试数据生成器
```typescript
// tests/fixtures/data-fixtures.ts
export class TestDataGenerator {
  static generateMockCard(overrides: Partial<Card> = {}): Card {
    return {
      id: crypto.randomUUID(),
      frontContent: {
        title: `Card ${Date.now()}`,
        text: 'This is a test card content',
        images: [],
        tags: ['test-tag'],
        lastModified: new Date()
      },
      backContent: {
        title: 'Back Side',
        text: 'This is the back side content',
        images: [],
        tags: [],
        lastModified: new Date()
      },
      style: {
        type: 'solid',
        backgroundColor: '#ffffff',
        fontFamily: 'system-ui',
        fontSize: 'base',
        fontWeight: 'normal',
        textColor: '#1f2937',
        borderRadius: 'xl',
        shadow: 'md',
        borderWidth: 0
      },
      isFlipped: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    }
  }

  static generateMockFolder(overrides: Partial<Folder> = {}): Folder {
    return {
      id: crypto.randomUUID(),
      name: `Folder ${Date.now()}`,
      color: '#3b82f6',
      icon: 'Folder',
      cardIds: [],
      isExpanded: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    }
  }

  static generateMockTag(overrides: Partial<Tag> = {}): Tag {
    return {
      id: crypto.randomUUID(),
      name: `Tag ${Date.now()}`,
      color: '#10b981',
      count: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    }
  }

  static generateLargeDataset(size: number = 1000): {
    cards: Card[]
    folders: Folder[]
    tags: Tag[]
  } {
    const cards: Card[] = []
    const folders: Folder[] = []
    const tags: Tag[] = []
    
    // 生成标签
    for (let i = 0; i < 20; i++) {
      tags.push(this.generateMockTag({
        name: `Tag ${i}`,
        color: `hsl(${i * 18}, 70%, 50%)`
      }))
    }
    
    // 生成文件夹
    for (let i = 0; i < 10; i++) {
      folders.push(this.generateMockFolder({
        name: `Folder ${i}`,
        parentId: i > 0 ? folders[0].id : undefined
      }))
    }
    
    // 生成卡片
    for (let i = 0; i < size; i++) {
      const randomTags = tags
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 3) + 1)
        .map(tag => tag.name)
      
      cards.push(this.generateMockCard({
        frontContent: {
          title: `Card ${i}`,
          text: `This is card number ${i} with some content`,
          images: [],
          tags: randomTags,
          lastModified: new Date()
        },
        folderId: folders[Math.floor(Math.random() * folders.length)].id
      }))
    }
    
    return { cards, folders, tags }
  }
}
```

### 5.2 Mock服务
```typescript
// tests/fixtures/mock-services.ts
export class MockSupabaseService {
  private mockData = {
    cards: [] as Card[],
    folders: [] as Folder[],
    tags: [] as Tag[]
  }

  from(table: string) {
    return {
      select: () => this,
      insert: (data: any) => {
        this.mockData[table].push({ ...data, id: crypto.randomUUID() })
        return Promise.resolve({ data: [data], error: null })
      },
      update: (updates: any) => {
        return Promise.resolve({ data: [updates], error: null })
      },
      delete: () => {
        return Promise.resolve({ data: null, error: null })
      },
      eq: (field: string, value: any) => this,
      gte: (field: string, value: any) => this,
      upsert: (data: any) => {
        return Promise.resolve({ data: [data], error: null })
      }
    }
  }

  auth = {
    signUp: (data: any) => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null }),
    signIn: (data: any) => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null }),
    signOut: () => Promise.resolve({ error: null }),
    onAuthStateChange: (callback: Function) => {
      callback({ user: { id: 'test-user' } })
      return () => {}
    }
  }

  reset() {
    this.mockData = {
      cards: [],
      folders: [],
      tags: []
    }
  }
}

export const mockSupabaseService = new MockSupabaseService()
```

### 5.3 性能测试工具
```typescript
// tests/utils/performance-utils.ts
export class PerformanceUtils {
  static async measureExecutionTime<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; executionTime: number }> {
    const start = performance.now()
    const result = await fn()
    const end = performance.now()
    
    const executionTime = end - start
    console.log(`${name} executed in ${executionTime.toFixed(2)}ms`)
    
    return { result, executionTime }
  }

  static async measureMemoryUsage(
    name: string,
    fn: () => Promise<void>
  ): Promise<void> {
    const before = performance.memory
    await fn()
    const after = performance.memory
    
    const usedJSHeapSize = after.usedJSHeapSize - before.usedJSHeapSize
    const totalJSHeapSize = after.totalJSHeapSize - before.totalJSHeapSize
    
    console.log(`${name} memory usage:`)
    console.log(`  Used JS Heap: ${(usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  Total JS Heap: ${(totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
  }

  static async benchmarkOperation<T>(
    name: string,
    fn: () => Promise<T>,
    iterations: number = 100
  ): Promise<{ averageTime: number; minTime: number; maxTime: number }> {
    const times: number[] = []
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      await fn()
      const end = performance.now()
      times.push(end - start)
    }
    
    const averageTime = times.reduce((a, b) => a + b, 0) / times.length
    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)
    
    console.log(`${name} benchmark (${iterations} iterations):`)
    console.log(`  Average: ${averageTime.toFixed(2)}ms`)
    console.log(`  Min: ${minTime.toFixed(2)}ms`)
    console.log(`  Max: ${maxTime.toFixed(2)}ms`)
    
    return { averageTime, minTime, maxTime }
  }
}
```

## 6. 质量保证体系

### 6.1 代码质量门禁
```yaml
# .github/workflows/quality-gate.yml
name: Quality Gate

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18, 20]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run ESLint
      run: npm run lint
    
    - name: Run unit tests
      run: npm test -- --coverage --watchAll=false
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Run E2E tests
      run: npm run test:e2e
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella
    
    - name: Build application
      run: npm run build
    
    - name: Performance test
      run: npm run test:performance
    
    - name: Security audit
      run: npm audit --audit-level moderate
```

### 6.2 测试覆盖率报告
```typescript
// 覆盖率检查脚本
const coverage = require('./coverage/coverage-summary.json')

const thresholds = {
  global: {
    lines: 90,
    functions: 90,
    branches: 85,
    statements: 90
  },
  critical: {
    lines: 95,
    functions: 95,
    branches: 90,
    statements: 95
  }
}

function checkCoverage() {
  const globalCoverage = coverage.total
  const criticalCoverage = {
    'src/services/': coverage['src/services/'],
    'src/components/card/': coverage['src/components/card/']
  }
  
  let failed = false
  
  // 检查全局覆盖率
  Object.entries(thresholds.global).forEach(([metric, threshold]) => {
    const actual = globalCoverage[metric].pct
    if (actual < threshold) {
      console.error(`❌ Global ${metric} coverage: ${actual}% (threshold: ${threshold}%)`)
      failed = true
    } else {
      console.log(`✅ Global ${metric} coverage: ${actual}%`)
    }
  })
  
  // 检查关键路径覆盖率
  Object.entries(criticalCoverage).forEach(([path, pathCoverage]) => {
    Object.entries(thresholds.critical).forEach(([metric, threshold]) => {
      const actual = pathCoverage[metric].pct
      if (actual < threshold) {
        console.error(`❌ ${path} ${metric} coverage: ${actual}% (threshold: ${threshold}%)`)
        failed = true
      } else {
        console.log(`✅ ${path} ${metric} coverage: ${actual}%`)
      }
    })
  })
  
  if (failed) {
    process.exit(1)
  } else {
    console.log('✅ All coverage thresholds met!')
  }
}

checkCoverage()
```

### 6.3 性能监控
```typescript
// 性能监控服务
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()
  
  static trackOperation(name: string, startTime: number) {
    const endTime = performance.now()
    const duration = endTime - startTime
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    
    this.metrics.get(name)!.push(duration)
  }
  
  static getMetrics() {
    const result: Record<string, any> = {}
    
    this.metrics.forEach((durations, name) => {
      result[name] = {
        count: durations.length,
        average: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        p95: this.percentile(durations, 95),
        p99: this.percentile(durations, 99)
      }
    })
    
    return result
  }
  
  private static percentile(sortedArray: number[], p: number): number {
    const index = Math.ceil((p / 100) * sortedArray.length) - 1
    return sortedArray[index]
  }
  
  static reset() {
    this.metrics.clear()
  }
}
```

## 7. 测试自动化流程

### 7.1 CI/CD 集成
```yaml
# .github/workflows/test-automation.yml
name: Test Automation

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # 每天凌晨2点运行

jobs:
  automated-testing:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-type: [unit, integration, e2e, performance]
        
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: 18
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run ${{ matrix.test-type }} tests
      run: npm run test:${{ matrix.test-type }}
    
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-results-${{ matrix.test-type }}
        path: test-results/
```

### 7.2 测试报告生成
```typescript
// 测试报告生成器
export class TestReportGenerator {
  static async generateReport() {
    const unitCoverage = await this.getCoverageReport()
    const e2eResults = await this.getE2EResults()
    const performanceMetrics = await this.getPerformanceMetrics()
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: e2eResults.total + unitCoverage.total,
        passedTests: e2eResults.passed + unitCoverage.passed,
        failedTests: e2eResults.failed + unitCoverage.failed,
        coverage: unitCoverage.coverage
      },
      details: {
        unitTests: unitCoverage,
        e2eTests: e2eResults,
        performance: performanceMetrics
      },
      recommendations: this.generateRecommendations(unitCoverage, e2eResults, performanceMetrics)
    }
    
    await this.saveReport(report)
    return report
  }
  
  private static generateRecommendations(unitCoverage, e2eResults, performanceMetrics) {
    const recommendations = []
    
    if (unitCoverage.coverage.lines < 90) {
      recommendations.push('Increase unit test coverage to at least 90%')
    }
    
    if (e2eResults.failed > 0) {
      recommendations.push(`Fix ${e2eResults.failed} failing E2E tests`)
    }
    
    if (performanceMetrics.averageResponseTime > 200) {
      recommendations.push('Optimize performance to reduce response time below 200ms')
    }
    
    return recommendations
  }
}
```

## 8. 测试维护策略

### 8.1 测试定期审查
- 每周审查新添加的测试用例
- 每月进行测试覆盖率分析
- 每季度进行测试架构优化

### 8.2 测试数据管理
- 定期清理过期测试数据
- 维护测试数据的版本控制
- 建立测试数据生成和恢复机制

### 8.3 测试文档维护
- 保持测试文档与代码同步
- 记录测试用例的变更历史
- 提供测试用例的执行指南

## 9. 实施计划

### 阶段1：基础设施搭建（1-2周）
- 完善Jest和Playwright配置
- 建立测试目录结构
- 创建测试工具和Mock服务

### 阶段2：核心功能测试（2-3周）
- 同步系统测试
- 数据库集成测试
- 核心组件测试

### 阶段3：E2E测试（2-3周）
- 用户操作流程测试
- 跨页面交互测试
- 性能和兼容性测试

### 阶段4：质量保证（1-2周）
- CI/CD集成
- 代码质量门禁
- 测试报告系统

### 阶段5：持续优化（长期）
- 测试覆盖率监控
- 性能基准测试
- 测试用例维护

## 10. 成功指标

### 10.1 质量指标
- 代码覆盖率 ≥ 90%
- 测试通过率 ≥ 95%
- 生产环境bug率降低 50%

### 10.2 性能指标
- 关键操作响应时间 < 200ms
- 测试执行时间 < 5分钟
- 内存使用量减少 20%

### 10.3 开发效率
- 新功能测试覆盖率 ≥ 80%
- 测试用例编写时间减少 30%
- 缺陷修复时间减少 40%

通过这个全面的测试策略，CardEverything项目将建立完整的质量保证体系，确保代码质量、性能表现和用户体验达到生产级别标准。