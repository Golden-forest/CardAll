# CardEverything 测试架构设计文档

## 项目概述

CardEverything 是一个复杂的 React 应用，具有实时同步、离线支持、拖拽交互等高级功能。本测试架构设计旨在为重构项目提供全面的质量保证体系，支持95%+的测试覆盖率目标。

## 测试架构总览

### 1. 测试金字塔模型

```
           ┌─────────────────┐
           │   E2E Tests    │  ← 10% (关键用户流程)
           │   (Playwright)  │
           ├─────────────────┤
           │ Integration     │  ← 30% (系统集成测试)
           │   Tests         │
           ├─────────────────┤
           │   Unit Tests    │  ← 60% (组件、服务、工具函数)
           │    (Jest)       │
           └─────────────────┘
```

### 2. 测试技术栈

#### 核心测试框架
- **Jest + Testing Library**: 单元测试和集成测试
- **Playwright**: 端到端测试和跨浏览器测试
- **MSW (Mock Service Worker)**: API 模拟和网络请求拦截
- **React Testing Library**: React 组件测试

#### 性能和监控
- **Jest Performance**: 性能基准测试
- **Memory Leak Detection**: 内存泄漏检测
- **Bundle Analyzer**: 构建包分析

#### 质量保证
- **ESLint + Prettier**: 代码质量和格式化
- **TypeScript**: 类型安全
- **Husky + lint-staged**: Git hooks 代码检查
- **SonarQube**: 代码质量分析

## 测试架构详细设计

### 1. 单元测试层 (Unit Tests)

#### 测试范围
- **组件测试**: 所有 React 组件的渲染、交互、状态管理
- **Hook 测试**: 自定义 Hook 的状态逻辑和副作用
- **服务测试**: 业务逻辑、数据转换、错误处理
- **工具函数测试**: 纯函数、算法、数据处理

#### 技术实现
```typescript
// Jest 配置增强
export const jestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '@supabase/supabase-js': '<rootDir>/src/__mocks__/supabase.js'
  },
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/services/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  }
}
```

#### 同步服务测试框架
```typescript
// 同步服务测试基础类
export abstract class SyncServiceTestBase {
  protected mockSupabase: MockSupabaseClient
  protected mockDatabase: MockDatabase
  protected syncService: CloudSyncService

  beforeEach(() => {
    this.mockSupabase = createMockSupabaseClient()
    this.mockDatabase = new MockDatabase()
    this.syncService = new CloudSyncService(this.mockSupabase, this.mockDatabase)
  })

  protected createMockSyncOperation(
    type: SyncOperationType,
    data: any
  ): SyncOperation {
    return {
      id: crypto.randomUUID(),
      type,
      entity: 'card',
      entityId: crypto.randomUUID(),
      data,
      timestamp: new Date(),
      retryCount: 0,
      priority: 'medium',
      syncVersion: 1
    }
  }
}
```

### 2. 集成测试层 (Integration Tests)

#### 测试范围
- **数据库集成**: IndexedDB 操作、事务处理
- **API 集成**: Supabase API 交互、认证流程
- **状态管理**: 全局状态、组件间通信
- **同步系统集成**: 本地-云端数据同步流程

#### 技术实现
```typescript
// 集成测试基类
export class IntegrationTestBase {
  protected container: HTMLElement
  protected mockServer: SetupServerApi

  beforeAll(() => {
    // 启动 MSW 服务器
    this.mockServer = setupServer(
      rest.get('/api/sync', (req, res, ctx) => {
        return res(ctx.json({ success: true }))
      })
    )
    this.mockServer.listen()
  })

  afterAll(() => {
    this.mockServer.close()
  })

  protected renderWithProviders(
    component: React.ReactElement,
    providers: TestProviders = {}
  ) {
    return render(
      <TestProviderWrapper {...providers}>
        {component}
      </TestProviderWrapper>
    )
  }
}
```

#### 同步系统集成测试
```typescript
describe('Sync System Integration', () => {
  let testEnv: SyncIntegrationTestEnvironment

  beforeEach(async () => {
    testEnv = await createSyncTestEnvironment()
    await testEnv.initialize()
  })

  it('should handle offline-to-online transition', async () => {
    // 模拟离线状态
    await testEnv.simulateOffline()

    // 创建本地数据
    const card = await testEnv.createLocalCard({
      title: 'Offline Card',
      content: 'Created while offline'
    })

    // 模拟恢复在线
    await testEnv.simulateOnline()

    // 验证数据同步
    await waitFor(() => {
      expect(testEnv.getCloudCards()).toContainEqual(
        expect.objectContaining({ title: 'Offline Card' })
      )
    })
  })

  it('should resolve conflicts intelligently', async () => {
    // 创建冲突场景
    const localCard = await testEnv.createLocalCard({ title: 'Original' })
    const cloudCard = await testEnv.createCloudCard({
      id: localCard.id,
      title: 'Modified in Cloud'
    })

    // 修改本地卡片
    await testEnv.updateLocalCard(localCard.id, { title: 'Modified Locally' })

    // 触发冲突解决
    const resolution = await testEnv.resolveConflict(localCard.id)

    expect(resolution.strategy).toBe('intelligent-merge')
    expect(resolution.mergedData.title).toBe('Modified Locally')
  })
})
```

### 3. 端到端测试层 (E2E Tests)

#### 测试范围
- **用户注册和登录流程**
- **卡片创建、编辑、删除流程**
- **文件夹管理流程**
- **标签系统流程**
- **同步工作流程**
- **离线模式功能验证**
- **PWA 安装和使用流程**

#### 技术实现
```typescript
// Playwright 配置增强
export const playwrightConfig = {
  testDir: './tests/e2e',
  fullyParallel: true,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI
  }
}
```

#### E2E 测试示例
```typescript
test.describe('Card Creation Workflow', () => {
  test('should allow creating and editing cards', async ({ page }) => {
    // 导航到应用
    await page.goto('/')

    // 等待页面加载
    await page.waitForSelector('[data-testid="dashboard"]')

    // 创建新卡片
    await page.click('[data-testid="create-card-button"]')
    await page.fill('[data-testid="card-title-input"]', 'Test Card')
    await page.fill('[data-testid="card-content-input"]', 'Test Content')
    await page.click('[data-testid="save-card-button"]')

    // 验证卡片创建成功
    await expect(page.locator('[data-testid="card-title"]')).toHaveText('Test Card')

    // 编辑卡片
    await page.dblclick('[data-testid="card-title"]')
    await page.fill('[data-testid="card-title-input"]', 'Updated Card')
    await page.click('[data-testid="update-card-button"]')

    // 验证编辑成功
    await expect(page.locator('[data-testid="card-title"]')).toHaveText('Updated Card')
  })

  test('should sync cards to cloud when online', async ({ page }) => {
    // 模拟在线状态
    await page.goto('/')
    await page.evaluate(() => {
      window.navigator.onLine = true
    })

    // 创建卡片
    await createTestCard(page, 'Sync Test Card')

    // 验证同步状态
    await expect(page.locator('[data-testid="sync-status"]')).toHaveText('Synced')

    // 刷新页面验证数据持久化
    await page.reload()
    await expect(page.locator('[data-testid="card-title"]')).toHaveText('Sync Test Card')
  })
})
```

### 4. 性能测试框架

#### 测试指标
- **渲染性能**: 组件渲染时间、内存使用
- **同步性能**: 数据同步速度、带宽使用
- **网络性能**: API 响应时间、重试机制
- **内存管理**: 内存泄漏检测、垃圾回收

#### 技术实现
```typescript
// 性能测试基类
export class PerformanceTestBase {
  protected performanceMetrics: PerformanceMetrics[] = []

  protected async measureComponentRender(
    component: React.ReactElement,
    iterations: number = 100
  ): Promise<RenderPerformance> {
    const metrics: RenderMetric[] = []

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now()

      const { unmount } = render(component)
      unmount()

      const endTime = performance.now()
      metrics.push({
        iteration: i + 1,
        duration: endTime - startTime,
        memory: performance.memory?.usedJSHeapSize || 0
      })
    }

    return this.analyzePerformanceMetrics(metrics)
  }

  protected analyzePerformanceMetrics(metrics: RenderMetric[]): RenderPerformance {
    const durations = metrics.map(m => m.duration)
    const memories = metrics.map(m => m.memory)

    return {
      averageDuration: this.calculateAverage(durations),
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      p95Duration: this.calculatePercentile(durations, 95),
      averageMemory: this.calculateAverage(memories),
      memoryGrowth: memories[memories.length - 1] - memories[0]
    }
  }
}
```

#### 同步性能测试
```typescript
describe('Sync Performance', () => {
  let performanceTest: SyncPerformanceTest

  beforeEach(() => {
    performanceTest = new SyncPerformanceTest()
  })

  it('should sync 1000 cards within acceptable time', async () => {
    // 生成测试数据
    const testCards = generateTestCards(1000)

    // 测量同步性能
    const result = await performanceTest.measureSyncPerformance(testCards)

    // 验证性能指标
    expect(result.duration).toBeLessThan(30000) // 30秒内完成
    expect(result.successRate).toBeGreaterThan(0.95) // 95%成功率
    expect(result.memoryGrowth).toBeLessThan(50 * 1024 * 1024) // 内存增长小于50MB
  })

  it('should handle concurrent sync operations efficiently', async () => {
    const concurrentOperations = 50
    const results = await Promise.allSettled(
      Array.from({ length: concurrentOperations }, () =>
        performanceTest.measureSingleSyncOperation()
      )
    )

    const successfulOps = results.filter(r => r.status === 'fulfilled')
    expect(successfulOps.length).toBeGreaterThan(concurrentOperations * 0.8)
  })
})
```

### 5. Mock 和 Stub 系统

#### 数据库 Mock
```typescript
// IndexedDB Mock
export class MockIndexedDB {
  private databases: Map<string, MockDatabase> = new Map()

  async open(name: string, version?: number): Promise<MockDatabase> {
    if (!this.databases.has(name)) {
      this.databases.set(name, new MockDatabase(name, version))
    }
    return this.databases.get(name)!
  }

  async deleteDatabase(name: string): Promise<void> {
    this.databases.delete(name)
  }
}

export class MockDatabase {
  private tables: Map<string, MockTable> = new Map()

  constructor(public name: string, public version: number) {
    this.initializeTables()
  }

  private initializeTables() {
    const tableNames = ['cards', 'folders', 'tags', 'images', 'syncQueue']
    tableNames.forEach(name => {
      this.tables.set(name, new MockTable(name))
    })
  }

  table(name: string): MockTable {
    return this.tables.get(name) || new MockTable(name)
  }
}
```

#### Supabase Mock
```typescript
// Supabase Client Mock
export const createMockSupabaseClient = () => ({
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      data: [],
      error: null
    }),
    insert: jest.fn().mockResolvedValue({
      data: null,
      error: null
    }),
    update: jest.fn().mockResolvedValue({
      data: null,
      error: null
    }),
    delete: jest.fn().mockResolvedValue({
      error: null
    })
  }),
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null
    }),
    signIn: jest.fn().mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null
    }),
    signOut: jest.fn().mockResolvedValue({ error: null })
  },
  storage: {
    from: jest.fn().mockReturnValue({
      upload: jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null
      })
    })
  }
})
```

### 6. 测试数据管理

#### 测试数据生成器
```typescript
export class TestDataGenerator {
  static generateCardData(options: Partial<CardData> = {}): CardData {
    return {
      id: options.id || crypto.randomUUID(),
      frontContent: {
        title: options.frontContent?.title || 'Test Card',
        text: options.frontContent?.text || 'Test content',
        tags: options.frontContent?.tags || ['test']
      },
      backContent: {
        title: options.backContent?.title || 'Back Side',
        text: options.backContent?.text || 'Back content',
        tags: options.backContent?.tags || ['back']
      },
      style: options.style || {
        type: 'solid',
        colors: ['#ffffff']
      },
      folderId: options.folderId || crypto.randomUUID(),
      createdAt: options.createdAt || new Date(),
      updatedAt: options.updatedAt || new Date(),
      syncVersion: options.syncVersion || 1,
      pendingSync: options.pendingSync || false
    }
  }

  static generateLargeDataset(size: number = 1000): CardData[] {
    return Array.from({ length: size }, (_, i) =>
      this.generateCardData({
        frontContent: {
          title: `Card ${i + 1}`,
          text: `Content for card ${i + 1}`,
          tags: [`batch-${Math.floor(i / 100)}`, 'large-dataset']
        }
      })
    )
  }
}
```

#### 测试夹具 (Fixtures)
```typescript
// 测试夹具管理
export class TestFixtures {
  private static instance: TestFixtures
  private fixtures: Map<string, any> = new Map()

  static getInstance(): TestFixtures {
    if (!TestFixtures.instance) {
      TestFixtures.instance = new TestFixtures()
    }
    return TestFixtures.instance
  }

  async loadFixture(name: string): Promise<any> {
    if (this.fixtures.has(name)) {
      return this.fixtures.get(name)
    }

    const fixture = await this.loadFixtureFromFile(name)
    this.fixtures.set(name, fixture)
    return fixture
  }

  private async loadFixtureFromFile(name: string): Promise<any> {
    const fixturePath = path.join(__dirname, 'fixtures', `${name}.json`)
    const fixtureData = await fs.readFile(fixturePath, 'utf-8')
    return JSON.parse(fixtureData)
  }

  clear(): void {
    this.fixtures.clear()
  }
}
```

### 7. 测试报告和分析

#### 覆盖率报告
```typescript
// 覆盖率报告生成器
export class CoverageReporter {
  static generateReport(coverageData: CoverageData): CoverageReport {
    return {
      summary: {
        totalLines: coverageData.lines.total,
        coveredLines: coverageData.lines.covered,
        lineCoverage: (coverageData.lines.covered / coverageData.lines.total) * 100,
        totalFunctions: coverageData.functions.total,
        coveredFunctions: coverageData.functions.covered,
        functionCoverage: (coverageData.functions.covered / coverageData.functions.total) * 100
      },
      files: Object.entries(coverageData.files).map(([file, data]) => ({
        path: file,
        coverage: this.calculateFileCoverage(data)
      })),
      recommendations: this.generateRecommendations(coverageData)
    }
  }

  private static generateRecommendations(data: CoverageData): string[] {
    const recommendations: string[] = []

    if (data.lines.covered / data.lines.total < 0.8) {
      recommendations.push('增加代码行覆盖率')
    }

    if (data.functions.covered / data.functions.total < 0.8) {
      recommendations.push('增加函数覆盖率')
    }

    return recommendations
  }
}
```

#### 性能报告
```typescript
export class PerformanceReporter {
  static generatePerformanceReport(
    results: PerformanceTestResult[]
  ): PerformanceReport {
    return {
      summary: {
        totalTests: results.length,
        passedTests: results.filter(r => r.passed).length,
        averageDuration: this.calculateAverageDuration(results),
        slowestTest: this.findSlowestTest(results),
        memoryUsage: this.calculateMemoryUsage(results)
      },
      details: results.map(result => ({
        name: result.name,
        duration: result.duration,
        memoryUsage: result.memoryUsage,
        passed: result.passed,
        metrics: result.metrics
      })),
      recommendations: this.generatePerformanceRecommendations(results)
    }
  }
}
```

## 测试运行策略

### 1. 开发环境测试
```bash
# 快速单元测试
npm run test:unit -- --watch

# 组件测试
npm run test:components -- --watch

# 集成测试
npm run test:integration
```

### 2. CI/CD 环境测试
```bash
# 完整测试套件
npm run test:ci

# 并行运行测试
npm run test:parallel

# 性能测试
npm run test:performance
```

### 3. 生产环境监控
```typescript
// 生产环境测试监控
export class ProductionTestMonitor {
  static async runHealthChecks(): Promise<HealthCheckResult> {
    const checks = await Promise.allSettled([
      this.checkDatabaseConnection(),
      this.checkApiEndpoints(),
      this.checkSyncStatus(),
      this.checkMemoryUsage()
    ])

    return {
      healthy: checks.every(c => c.status === 'fulfilled'),
      details: checks.map((check, index) => ({
        name: ['Database', 'API', 'Sync', 'Memory'][index],
        status: check.status === 'fulfilled' ? 'healthy' : 'unhealthy',
        error: check.status === 'rejected' ? check.reason.message : null
      }))
    }
  }
}
```

## 测试基础设施配置

### 1. 目录结构
```
tests/
├── __tests__/                    # Jest 自动发现的测试
│   ├── unit/                     # 单元测试
│   │   ├── components/          # 组件测试
│   │   ├── services/           # 服务测试
│   │   ├── hooks/              # Hook 测试
│   │   └── utils/              # 工具函数测试
│   ├── integration/             # 集成测试
│   │   ├── sync/               # 同步集成测试
│   │   ├── database/           # 数据库集成测试
│   │   └── api/                # API 集成测试
│   ├── performance/             # 性能测试
│   └── e2e/                     # 端到端测试
├── fixtures/                    # 测试数据夹具
├── mocks/                       # Mock 对象
├── utils/                       # 测试工具函数
├── setup/                       # 测试设置文件
└── reports/                     # 测试报告
```

### 2. 配置文件
```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/**/*.stories.{ts,tsx}'
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
}

// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173'
  }
})
```

## 质量保证流程

### 1. 代码提交检查
```yaml
# .github/workflows/test.yml
name: Test and Quality Check

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:ci
      - run: npm run build
      - run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### 2. 测试门禁策略
- **单元测试覆盖率**: 必须 ≥ 90%
- **集成测试覆盖率**: 必须 ≥ 80%
- **E2E 测试**: 核心流程必须 100% 通过
- **性能测试**: 关键指标必须在阈值范围内
- **安全测试**: 必须 0 高危漏洞

### 3. 测试报告和监控
- **实时测试报告**: HTML 格式的详细测试报告
- **覆盖率趋势**: 覆盖率变化趋势监控
- **性能监控**: 性能指标历史记录
- **失败告警**: 测试失败自动通知

## 总结

本测试架构设计为 CardEverything 项目提供了全面的质量保证体系，支持重构项目的需求：

1. **全面覆盖**: 从单元测试到E2E测试的完整测试金字塔
2. **高性能**: 支持大规模数据集和并发测试
3. **高质量**: 严格的覆盖率要求和代码质量检查
4. **可维护**: 清晰的测试结构和工具链
5. **可扩展**: 支持未来功能扩展和性能优化

该架构将确保重构过程中的代码质量和功能稳定性，为项目的长期发展奠定坚实基础。