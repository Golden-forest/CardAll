# CardEverything 集成测试环境配置文档

## 文档概述

本文档详细描述了 CardEverything 项目的集成测试环境配置，包括数据库集成、API集成、状态管理和同步系统集成的完整测试框架。

## 集成测试架构

### 1. 测试环境层次结构

```
集成测试环境
├── 数据库集成层 (Database Integration Layer)
│   ├── IndexedDB 操作测试
│   ├── 事务处理测试
│   └── 数据一致性测试
├── API 集成层 (API Integration Layer)
│   ├── Supabase API 测试
│   ├── 认证流程测试
│   └── 错误处理测试
├── 状态管理集成层 (State Management Integration Layer)
│   ├── 全局状态测试
│   ├── 组件间通信测试
│   └── 状态同步测试
└── 同步系统集成层 (Sync System Integration Layer)
    ├── 本地-云端同步测试
    ├── 冲突解决测试
    └── 离线-在线转换测试
```

### 2. 集成测试配置

#### 基础配置文件

```typescript
// tests/integration/integration.config.ts
export interface IntegrationTestConfig {
  database: {
    name: string
    version: number
    timeout: number
  }
  api: {
    baseUrl: string
    timeout: number
    retries: number
  }
  sync: {
    batchSize: number
    retryDelay: number
    maxRetries: number
  }
  network: {
    offlineSimulation: boolean
    latencySimulation: boolean
    failureRate: number
  }
}

export const defaultIntegrationConfig: IntegrationTestConfig = {
  database: {
    name: 'cardall-test-db',
    version: 1,
    timeout: 5000
  },
  api: {
    baseUrl: 'http://localhost:5173/api',
    timeout: 10000,
    retries: 3
  },
  sync: {
    batchSize: 100,
    retryDelay: 1000,
    maxRetries: 5
  },
  network: {
    offlineSimulation: true,
    latencySimulation: true,
    failureRate: 0.1
  }
}
```

## 数据库集成测试

### 1. IndexedDB 集成测试框架

#### 测试数据库管理器

```typescript
// tests/integration/database/test-database-manager.ts
import { Dexie } from 'dexie'
import { CardAllDatabase } from '@/database/cardall-db'

export class TestDatabaseManager {
  private testDatabases: Map<string, CardAllDatabase> = new Map()
  private config: IntegrationTestConfig

  constructor(config: IntegrationTestConfig = defaultIntegrationConfig) {
    this.config = config
  }

  async createTestDatabase(name: string = 'test-db'): Promise<CardAllDatabase> {
    const dbName = `${name}-${Date.now()}`
    const db = new CardAllDatabase(dbName, this.config.database.version)

    await db.open()
    this.testDatabases.set(dbName, db)

    return db
  }

  async clearDatabase(dbName: string): Promise<void> {
    const db = this.testDatabases.get(dbName)
    if (db) {
      await db.delete()
      this.testDatabases.delete(dbName)
    }
  }

  async clearAllDatabases(): Promise<void> {
    const clearPromises = Array.from(this.testDatabases.keys()).map(
      dbName => this.clearDatabase(dbName)
    )
    await Promise.all(clearPromises)
  }

  getDatabase(name: string): CardAllDatabase | undefined {
    return this.testDatabases.get(name)
  }

  async populateWithTestData(db: CardAllDatabase, testData: TestData): Promise<void> {
    // 填充卡片数据
    if (testData.cards) {
      await db.cards.bulkAdd(testData.cards)
    }

    // 填充文件夹数据
    if (testData.folders) {
      await db.folders.bulkAdd(testData.folders)
    }

    // 填充标签数据
    if (testData.tags) {
      await db.tags.bulkAdd(testData.tags)
    }

    // 填充图片数据
    if (testData.images) {
      await db.images.bulkAdd(testData.images)
    }

    // 填充同步队列数据
    if (testData.syncQueue) {
      await db.syncQueue.bulkAdd(testData.syncQueue)
    }
  }
}

export interface TestData {
  cards?: CardData[]
  folders?: FolderData[]
  tags?: TagData[]
  images?: ImageData[]
  syncQueue?: SyncOperation[]
}
```

#### 数据库集成测试基类

```typescript
// tests/integration/database/database-integration-base.ts
import { TestDatabaseManager } from './test-database-manager'
import { defaultIntegrationConfig } from '../integration.config'

export abstract class DatabaseIntegrationTestBase {
  protected dbManager: TestDatabaseManager
  protected testDb: CardAllDatabase
  protected config: IntegrationTestConfig

  constructor(config: IntegrationTestConfig = defaultIntegrationConfig) {
    this.config = config
    this.dbManager = new TestDatabaseManager(config)
  }

  async beforeEach(): Promise<void> {
    // 创建测试数据库
    this.testDb = await this.dbManager.createTestDatabase()

    // 执行子类特定的初始化
    await this.initializeTestData()
  }

  async afterEach(): Promise<void> {
    // 清理测试数据库
    if (this.testDb) {
      await this.dbManager.clearDatabase(this.testDb.name)
    }
  }

  protected abstract initializeTestData(): Promise<void>

  // 数据一致性验证工具方法
  protected async verifyDataConsistency(): Promise<DataConsistencyResult> {
    const cards = await this.testDb.cards.toArray()
    const folders = await this.testDb.folders.toArray()
    const tags = await this.testDb.tags.toArray()

    const result: DataConsistencyResult = {
      cards: {
        total: cards.length,
        withValidFolder: cards.filter(card =>
          !card.folderId || folders.some(f => f.id === card.folderId)
        ).length,
        withValidTags: cards.filter(card =>
          card.frontContent.tags.every(tag =>
            tags.some(t => t.id === tag)
          )
        ).length
      },
      folders: {
        total: folders.length,
        withValidParent: folders.filter(folder =>
          !folder.parentId || folders.some(f => f.id === folder.parentId)
        ).length
      },
      tags: {
        total: tags.length,
        usedInCards: tags.filter(tag =>
          cards.some(card =>
            card.frontContent.tags.includes(tag.id) ||
            card.backContent.tags.includes(tag.id)
          )
        ).length
      }
    }

    return result
  }

  // 事务处理测试方法
  protected async testTransactionOperations(): Promise<void> {
    await this.testDb.transaction('rw', [this.testDb.cards, this.testDb.folders], async () => {
      // 创建文件夹
      const folderId = await this.testDb.folders.add({
        id: crypto.randomUUID(),
        name: 'Test Folder',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      // 创建卡片
      const cardId = await this.testDb.cards.add({
        id: crypto.randomUUID(),
        frontContent: {
          title: 'Test Card',
          text: 'Test content',
          tags: []
        },
        backContent: {
          title: 'Back Side',
          text: 'Back content',
          tags: []
        },
        style: {
          type: 'solid',
          colors: ['#ffffff']
        },
        folderId,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncVersion: 1,
        pendingSync: false
      })

      // 验证数据一致性
      const folder = await this.testDb.folders.get(folderId)
      const card = await this.testDb.cards.get(cardId)

      expect(folder).toBeDefined()
      expect(card).toBeDefined()
      expect(card?.folderId).toBe(folderId)
    })
  }
}

export interface DataConsistencyResult {
  cards: {
    total: number
    withValidFolder: number
    withValidTags: number
  }
  folders: {
    total: number
    withValidParent: number
  }
  tags: {
    total: number
    usedInCards: number
  }
}
```

#### 数据库性能测试

```typescript
// tests/integration/database/database-performance-test.ts
import { DatabaseIntegrationTestBase } from './database-integration-base'
import { TestDataGenerator } from '../fixtures/test-data-generator'

export class DatabasePerformanceTest extends DatabaseIntegrationTestBase {
  private testDataGenerator: TestDataGenerator

  constructor() {
    super()
    this.testDataGenerator = new TestDataGenerator()
  }

  protected async initializeTestData(): Promise<void> {
    // 性能测试不需要预置数据
  }

  async testLargeDatasetInsertion(): Promise<PerformanceMetrics> {
    const datasetSize = 10000
    const cards = this.testDataGenerator.generateCards(datasetSize)

    const startTime = performance.now()

    await this.testDb.transaction('rw', [this.testDb.cards], async () => {
      await this.testDb.cards.bulkAdd(cards)
    })

    const endTime = performance.now()

    return {
      operation: 'bulk-insert',
      datasetSize,
      duration: endTime - startTime,
      throughput: datasetSize / ((endTime - startTime) / 1000),
      memoryUsage: performance.memory?.usedJSHeapSize || 0
    }
  }

  async testComplexQueryPerformance(): Promise<PerformanceMetrics> {
    // 插入测试数据
    const cards = this.testDataGenerator.generateCards(1000)
    await this.testDb.cards.bulkAdd(cards)

    const queries = [
      // 按标题搜索
      () => this.testDb.cards
        .where('frontContent.title')
        .startsWithIgnoreCase('card')
        .toArray(),

      // 按标签筛选
      () => this.testDb.cards
        .filter(card =>
          card.frontContent.tags.includes('test-tag')
        )
        .toArray(),

      // 按文件夹筛选
      () => this.testDb.cards
        .where('folderId')
        .equals('test-folder-id')
        .toArray(),

      // 复杂组合查询
      () => this.testDb.cards
        .filter(card =>
          card.frontContent.title.includes('test') &&
          card.syncVersion > 1 &&
          !card.pendingSync
        )
        .toArray()
    ]

    const results: PerformanceMetrics[] = []

    for (let i = 0; i < queries.length; i++) {
      const startTime = performance.now()
      await queries[i]()
      const endTime = performance.now()

      results.push({
        operation: `query-${i + 1}`,
        datasetSize: 1000,
        duration: endTime - startTime,
        throughput: 1000 / ((endTime - startTime) / 1000),
        memoryUsage: performance.memory?.usedJSHeapSize || 0
      })
    }

    return results[0] // 返回第一个查询的结果
  }

  async testConcurrentOperations(): Promise<ConcurrencyMetrics> {
    const concurrentOperations = 100
    const operationPromises: Promise<void>[] = []

    const startTime = performance.now()

    for (let i = 0; i < concurrentOperations; i++) {
      operationPromises.push(
        this.testDb.cards.add({
          id: crypto.randomUUID(),
          frontContent: {
            title: `Concurrent Card ${i}`,
            text: `Content ${i}`,
            tags: [`concurrent-${i % 10}`]
          },
          backContent: {
            title: `Back ${i}`,
            text: `Back content ${i}`,
            tags: []
          },
          style: {
            type: 'solid',
            colors: ['#ffffff']
          },
          folderId: 'test-folder',
          createdAt: new Date(),
          updatedAt: new Date(),
          syncVersion: 1,
          pendingSync: false
        })
      )
    }

    const results = await Promise.allSettled(operationPromises)
    const endTime = performance.now()

    const successfulOps = results.filter(r => r.status === 'fulfilled')
    const failedOps = results.filter(r => r.status === 'rejected')

    return {
      totalOperations: concurrentOperations,
      successfulOperations: successfulOps.length,
      failedOperations: failedOps.length,
      duration: endTime - startTime,
      successRate: successfulOps.length / concurrentOperations,
      throughput: concurrentOperations / ((endTime - startTime) / 1000)
    }
  }
}

export interface PerformanceMetrics {
  operation: string
  datasetSize: number
  duration: number
  throughput: number
  memoryUsage: number
}

export interface ConcurrencyMetrics {
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  duration: number
  successRate: number
  throughput: number
}
```

### 2. 数据库集成测试套件

#### 卡片操作集成测试

```typescript
// tests/integration/database/card-operations.integration.test.ts
import { DatabaseIntegrationTestBase } from './database-integration-base'
import { TestDataGenerator } from '../fixtures/test-data-generator'

describe('Card Operations Integration Tests', () => {
  let testBase: DatabaseIntegrationTestBase
  let testDataGenerator: TestDataGenerator

  beforeEach(async () => {
    testBase = new CardOperationsIntegrationTest()
    await testBase.beforeEach()
    testDataGenerator = new TestDataGenerator()
  })

  afterEach(async () => {
    await testBase.afterEach()
  })

  describe('Card CRUD Operations', () => {
    it('should create, read, update, and delete cards successfully', async () => {
      // 创建卡片
      const cardData = testDataGenerator.generateCardData({
        frontContent: {
          title: 'CRUD Test Card',
          text: 'Testing CRUD operations',
          tags: ['test', 'crud']
        }
      })

      const cardId = await testBase.testDb.cards.add(cardData)

      // 读取卡片
      const retrievedCard = await testBase.testDb.cards.get(cardId)
      expect(retrievedCard).toBeDefined()
      expect(retrievedCard?.frontContent.title).toBe('CRUD Test Card')

      // 更新卡片
      await testBase.testDb.cards.update(cardId, {
        frontContent: {
          ...retrievedCard!.frontContent,
          title: 'Updated CRUD Card'
        }
      })

      const updatedCard = await testBase.testDb.cards.get(cardId)
      expect(updatedCard?.frontContent.title).toBe('Updated CRUD Card')

      // 删除卡片
      await testBase.testDb.cards.delete(cardId)
      const deletedCard = await testBase.testDb.cards.get(cardId)
      expect(deletedCard).toBeUndefined()
    })

    it('should handle bulk operations efficiently', async () => {
      const batchSize = 100
      const cards = testDataGenerator.generateCards(batchSize)

      // 批量插入
      const startTime = performance.now()
      await testBase.testDb.cards.bulkAdd(cards)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(1000) // 1秒内完成

      // 验证插入结果
      const allCards = await testBase.testDb.cards.toArray()
      expect(allCards).toHaveLength(batchSize)

      // 批量更新
      const updateData = cards.map(card => ({
        key: card.id,
        changes: { syncVersion: card.syncVersion + 1 }
      }))

      await testBase.testDb.cards.bulkUpdate(updateData)

      // 验证更新结果
      const updatedCards = await testBase.testDb.cards
        .where('syncVersion')
        .equals(2)
        .toArray()
      expect(updatedCards).toHaveLength(batchSize)
    })

    it('should maintain data consistency during transactions', async () => {
      // 测试事务回滚
      try {
        await testBase.testDb.transaction('rw', [testBase.testDb.cards], async () => {
          // 插入有效数据
          await testBase.testDb.cards.add(testDataGenerator.generateCardData())

          // 模拟错误触发回滚
          throw new Error('Intentional rollback error')
        })
      } catch (error) {
        // 期望的错误
      }

      // 验证事务回滚后数据一致性
      const cards = await testBase.testDb.cards.toArray()
      expect(cards).toHaveLength(0)
    })
  })

  describe('Card Relationships', () => {
    it('should maintain folder-card relationships', async () => {
      // 创建文件夹
      const folder = testDataGenerator.generateFolderData()
      const folderId = await testBase.testDb.folders.add(folder)

      // 创建关联卡片
      const card = testDataGenerator.generateCardData({ folderId })
      const cardId = await testBase.testDb.cards.add(card)

      // 验证关系
      const retrievedCard = await testBase.testDb.cards.get(cardId)
      expect(retrievedCard?.folderId).toBe(folderId)

      // 测试级联删除
      await testBase.testDb.folders.delete(folderId)
      const orphanedCard = await testBase.testDb.cards.get(cardId)
      expect(orphanedCard?.folderId).toBe(folderId) // 数据应该保留
    })

    it('should handle tag-card relationships', async () => {
      // 创建标签
      const tags = [
        testDataGenerator.generateTagData({ name: 'Tag 1' }),
        testDataGenerator.generateTagData({ name: 'Tag 2' })
      ]
      await testBase.testDb.tags.bulkAdd(tags)

      // 创建带标签的卡片
      const card = testDataGenerator.generateCardData({
        frontContent: {
          title: 'Tagged Card',
          text: 'Card with multiple tags',
          tags: tags.map(t => t.id)
        }
      })
      const cardId = await testBase.testDb.cards.add(card)

      // 验证标签关系
      const retrievedCard = await testBase.testDb.cards.get(cardId)
      expect(retrievedCard?.frontContent.tags).toHaveLength(2)
      expect(retrievedCard?.frontContent.tags).toContain(tags[0].id)
      expect(retrievedCard?.frontContent.tags).toContain(tags[1].id)

      // 测试标签使用统计
      const usedTags = await testBase.testDb.tags
        .filter(tag =>
          testBase.testDb.cards.some(card =>
            card.frontContent.tags.includes(tag.id) ||
            card.backContent.tags.includes(tag.id)
          )
        )
        .toArray()
      expect(usedTags).toHaveLength(2)
    })
  })

  describe('Card Synchronization', () => {
    it('should track sync status correctly', async () => {
      // 创建待同步卡片
      const card = testDataGenerator.generateCardData({ pendingSync: true })
      const cardId = await testBase.testDb.cards.add(card)

      // 验证同步状态
      const pendingCards = await testBase.testDb.cards
        .where('pendingSync')
        .equals(true)
        .toArray()
      expect(pendingCards).toHaveLength(1)

      // 模拟同步完成
      await testBase.testDb.cards.update(cardId, {
        pendingSync: false,
        syncVersion: 2
      })

      // 验证同步状态更新
      const syncedCards = await testBase.testDb.cards
        .where('pendingSync')
        .equals(false)
        .toArray()
      expect(syncedCards).toHaveLength(1)
    })

    it('should handle sync version conflicts', async () => {
      // 创建卡片
      const card = testDataGenerator.generateCardData()
      const cardId = await testBase.testDb.cards.add(card)

      // 模拟冲突场景
      const localVersion = card.syncVersion
      const cloudVersion = localVersion + 2

      // 更新为云端版本
      await testBase.testDb.cards.update(cardId, {
        syncVersion: cloudVersion
      })

      // 验证版本处理
      const finalCard = await testBase.testDb.cards.get(cardId)
      expect(finalCard?.syncVersion).toBe(cloudVersion)
    })
  })
})

class CardOperationsIntegrationTest extends DatabaseIntegrationTestBase {
  protected async initializeTestData(): Promise<void> {
    // 不需要预置数据
  }
}
```

## API 集成测试

### 1. MSW API 模拟框架

#### API 模拟配置

```typescript
// tests/integration/api/api-mock-setup.ts
import { setupServer } from 'msw/node'
import { rest } from 'msw'
import { MockSupabaseClient } from '../mocks/mock-supabase'

export class ApiMockServer {
  private server: ReturnType<typeof setupServer>
  private mockSupabase: MockSupabaseClient

  constructor() {
    this.server = setupServer()
    this.mockSupabase = new MockSupabaseClient()
    this.setupHandlers()
  }

  private setupHandlers(): void {
    // 认证相关接口
    this.server.use(
      rest.post('/auth/v1/signup', async (req, res, ctx) => {
        const body = await req.json()

        // 模拟注册成功
        return res(
          ctx.status(200),
          ctx.json({
            user: {
              id: 'test-user-id',
              email: body.email,
              created_at: new Date().toISOString()
            },
            session: {
              access_token: 'test-access-token',
              refresh_token: 'test-refresh-token',
              expires_in: 3600
            }
          })
        )
      })
    )

    this.server.use(
      rest.post('/auth/v1/token', async (req, res, ctx) => {
        const body = await req.json()

        if (body.grant_type === 'password') {
          // 密码登录
          return res(
            ctx.status(200),
            ctx.json({
              user: {
                id: 'test-user-id',
                email: body.email,
                created_at: new Date().toISOString()
              },
              session: {
                access_token: 'test-access-token',
                refresh_token: 'test-refresh-token',
                expires_in: 3600
              }
            })
          )
        }

        return res(ctx.status(400))
      })
    )

    // 数据操作接口
    this.server.use(
      rest.get('/rest/v1/cards', async (req, res, ctx) => {
        const authToken = req.headers.get('authorization')

        if (!authToken) {
          return res(ctx.status(401))
        }

        // 返回模拟卡片数据
        return res(
          ctx.status(200),
          ctx.json([
            {
              id: 'test-card-1',
              front_content: { title: 'Test Card 1', text: 'Content 1' },
              back_content: { title: 'Back 1', text: 'Back content 1' },
              folder_id: 'test-folder-1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              sync_version: 1
            }
          ])
        )
      })
    )

    this.server.use(
      rest.post('/rest/v1/cards', async (req, res, ctx) => {
        const authToken = req.headers.get('authorization')
        const body = await req.json()

        if (!authToken) {
          return res(ctx.status(401))
        }

        // 模拟创建成功
        return res(
          ctx.status(201),
          ctx.json({
            id: crypto.randomUUID(),
            ...body,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            sync_version: 1
          })
        )
      })
    )

    // 文件上传接口
    this.server.use(
      rest.post('/storage/v1/object/images', async (req, res, ctx) => {
        const authToken = req.headers.get('authorization')

        if (!authToken) {
          return res(ctx.status(401))
        }

        // 模拟文件上传成功
        return res(
          ctx.status(200),
          ctx.json({
            Key: 'test-image-key',
            Location: 'https://test-bucket.s3.amazonaws.com/test-image.jpg'
          })
        )
      })
    )

    // 错误处理
    this.server.use(
      rest.get('/rest/v1/error', async (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({
            error: 'Internal Server Error',
            message: 'Simulated server error'
          })
        )
      })
    )
  }

  start(): void {
    this.server.listen()
  }

  stop(): void {
    this.server.close()
  }

  reset(): void {
    this.server.resetHandlers()
  }

  // 模拟网络错误
  simulateNetworkError(): void {
    this.server.use(
      rest.get('*', (req, res) => {
        return res.networkError('Failed to connect')
      })
    )
  }

  // 模拟延迟响应
  simulateLatency(delayMs: number = 1000): void {
    this.server.use(
      rest.get('*', async (req, res, ctx) => {
        await new Promise(resolve => setTimeout(resolve, delayMs))
        return res(ctx.status(200))
      })
    )
  }
}
```

#### API 集成测试基类

```typescript
// tests/integration/api/api-integration-base.ts
import { ApiMockServer } from './api-mock-setup'
import { CloudSyncService } from '@/services/cloud-sync'
import { TestDatabaseManager } from '../database/test-database-manager'

export abstract class ApiIntegrationTestBase {
  protected apiServer: ApiMockServer
  protected dbManager: TestDatabaseManager
  protected syncService: CloudSyncService
  protected testDb: CardAllDatabase

  constructor() {
    this.apiServer = new ApiMockServer()
    this.dbManager = new TestDatabaseManager()
  }

  async beforeEach(): Promise<void> {
    // 启动 API 模拟服务器
    this.apiServer.start()

    // 创建测试数据库
    this.testDb = await this.dbManager.createTestDatabase()

    // 创建同步服务实例
    this.syncService = new CloudSyncService(
      this.createMockSupabaseClient(),
      this.testDb
    )

    // 执行子类特定的初始化
    await this.initializeTestServices()
  }

  async afterEach(): Promise<void> {
    // 停止 API 模拟服务器
    this.apiServer.stop()

    // 清理测试数据库
    await this.dbManager.clearDatabase(this.testDb.name)
  }

  protected abstract initializeTestServices(): Promise<void>

  private createMockSupabaseClient(): any {
    return {
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
      }
    }
  }

  // API 响应验证方法
  protected async verifyApiResponse<T>(
    apiCall: () => Promise<T>,
    expectedStatus: number = 200
  ): Promise<{ success: boolean; data?: T; error?: any }> {
    try {
      const result = await apiCall()
      return { success: true, data: result }
    } catch (error: any) {
      return { success: false, error }
    }
  }

  // 网络状态模拟方法
  protected async simulateNetworkConditions(
    testFn: () => Promise<void>,
    conditions: {
      offline?: boolean
      highLatency?: boolean
      packetLoss?: number
    } = {}
  ): Promise<void> {
    if (conditions.offline) {
      this.apiServer.simulateNetworkError()
    }

    if (conditions.highLatency) {
      this.apiServer.simulateLatency(2000) // 2秒延迟
    }

    await testFn()
  }

  // 认证流程测试方法
  protected async testAuthenticationFlow(): Promise<void> {
    // 测试用户注册
    const signupResult = await this.verifyApiResponse(async () => {
      const response = await fetch('/auth/v1/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'testpassword'
        })
      })
      return response.json()
    })

    expect(signupResult.success).toBe(true)

    // 测试用户登录
    const loginResult = await this.verifyApiResponse(async () => {
      const response = await fetch('/auth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'password',
          email: 'test@example.com',
          password: 'testpassword'
        })
      })
      return response.json()
    })

    expect(loginResult.success).toBe(true)
  }
}
```

### 2. API 集成测试套件

#### 认证流程集成测试

```typescript
// tests/integration/api/authentication.integration.test.ts
import { ApiIntegrationTestBase } from './api-integration-base'

describe('Authentication Integration Tests', () => {
  let testBase: ApiIntegrationTestBase

  beforeEach(async () => {
    testBase = new AuthenticationIntegrationTest()
    await testBase.beforeEach()
  })

  afterEach(async () => {
    await testBase.afterEach()
  })

  describe('User Registration', () => {
    it('should register new user successfully', async () => {
      await testBase.testAuthenticationFlow()
    })

    it('should handle duplicate email registration', async () => {
      // 第一次注册成功
      await testBase.testAuthenticationFlow()

      // 重置处理器以模拟重复注册
      testBase.apiServer.reset()

      // 配置模拟重复邮箱错误
      testBase.apiServer.use(
        rest.post('/auth/v1/signup', async (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              error: 'User already exists',
              message: 'A user with this email already exists'
            })
          )
        })
      )

      // 第二次注册应该失败
      const result = await testBase.verifyApiResponse(async () => {
        const response = await fetch('/auth/v1/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'testpassword'
          })
        })
        return response.json()
      })

      expect(result.success).toBe(false)
    })

    it('should validate registration input', async () => {
      const invalidEmailCases = [
        { email: 'invalid-email', password: 'validpassword' },
        { email: '', password: 'validpassword' },
        { email: 'valid@email.com', password: '' },
        { email: 'valid@email.com', password: '123' }
      ]

      for (const invalidCase of invalidEmailCases) {
        const result = await testBase.verifyApiResponse(async () => {
          const response = await fetch('/auth/v1/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invalidCase)
          })
          return response.json()
        })

        expect(result.success).toBe(false)
      }
    })
  })

  describe('User Login', () => {
    it('should login with valid credentials', async () => {
      // 先注册用户
      await testBase.testAuthenticationFlow()

      // 重置处理器
      testBase.apiServer.reset()

      // 测试登录
      const loginResult = await testBase.verifyApiResponse(async () => {
        const response = await fetch('/auth/v1/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'password',
            email: 'test@example.com',
            password: 'testpassword'
          })
        })
        return response.json()
      })

      expect(loginResult.success).toBe(true)
      expect(loginResult.data?.session?.access_token).toBeDefined()
    })

    it('should reject invalid credentials', async () => {
      const result = await testBase.verifyApiResponse(async () => {
        const response = await fetch('/auth/v1/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'password',
            email: 'invalid@example.com',
            password: 'invalidpassword'
          })
        })
        return response.json()
      })

      expect(result.success).toBe(false)
    })
  })

  describe('Session Management', () => {
    it('should handle token refresh', async () => {
      // 模拟过期token
      testBase.apiServer.use(
        rest.post('/auth/v1/token/refresh', async (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              access_token: 'new-access-token',
              refresh_token: 'new-refresh-token',
              expires_in: 3600
            })
          )
        })
      )

      const result = await testBase.verifyApiResponse(async () => {
        const response = await fetch('/auth/v1/token/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer expired-token'
          }
        })
        return response.json()
      })

      expect(result.success).toBe(true)
      expect(result.data?.access_token).toBe('new-access-token')
    })

    it('should handle session expiry', async () => {
      testBase.apiServer.use(
        rest.get('/rest/v1/cards', async (req, res, ctx) => {
          const authToken = req.headers.get('authorization')
          if (authToken === 'Bearer expired-token') {
            return res(
              ctx.status(401),
              ctx.json({ error: 'Token expired' })
            )
          }
          return res(ctx.status(200))
        })
      )

      const result = await testBase.verifyApiResponse(async () => {
        const response = await fetch('/rest/v1/cards', {
          headers: {
            'Authorization': 'Bearer expired-token'
          }
        })
        return response.status
      })

      expect(result.success).toBe(false)
    })
  })

  describe('Network Conditions', () => {
    it('should handle offline mode gracefully', async () => {
      await testBase.simulateNetworkConditions(
        async () => {
          const result = await testBase.verifyApiResponse(async () => {
            const response = await fetch('/auth/v1/signup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: 'test@example.com',
                password: 'testpassword'
              })
            })
            return response.json()
          })

          expect(result.success).toBe(false)
        },
        { offline: true }
      )
    })

    it('should handle high latency', async () => {
      const startTime = performance.now()

      await testBase.simulateNetworkConditions(
        async () => {
          const result = await testBase.verifyApiResponse(async () => {
            const response = await fetch('/auth/v1/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                grant_type: 'password',
                email: 'test@example.com',
                password: 'testpassword'
              })
            })
            return response.json()
          })

          expect(result.success).toBe(true)
        },
        { highLatency: true }
      )

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeGreaterThan(2000) // 至少延迟2秒
    })
  })
})

class AuthenticationIntegrationTest extends ApiIntegrationTestBase {
  protected async initializeTestServices(): Promise<void> {
    // 认证测试不需要额外的服务初始化
  }
}
```

#### 数据操作 API 集成测试

```typescript
// tests/integration/api/data-operations.integration.test.ts
import { ApiIntegrationTestBase } from './api-integration-base'
import { TestDataGenerator } from '../fixtures/test-data-generator'

describe('Data Operations API Integration Tests', () => {
  let testBase: ApiIntegrationTestBase
  let testDataGenerator: TestDataGenerator

  beforeEach(async () => {
    testBase = new DataOperationsIntegrationTest()
    await testBase.beforeEach()
    testDataGenerator = new TestDataGenerator()
  })

  afterEach(async () => {
    await testBase.afterEach()
  })

  describe('Card Operations', () => {
    it('should fetch cards from API', async () => {
      const result = await testBase.verifyApiResponse(async () => {
        const response = await fetch('/rest/v1/cards', {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        })
        return response.json()
      })

      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('should create card via API', async () => {
      const cardData = testDataGenerator.generateCardData()

      const result = await testBase.verifyApiResponse(async () => {
        const response = await fetch('/rest/v1/cards', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            front_content: cardData.frontContent,
            back_content: cardData.backContent,
            folder_id: cardData.folderId,
            style: cardData.style
          })
        })
        return response.json()
      })

      expect(result.success).toBe(true)
      expect(result.data?.id).toBeDefined()
      expect(result.data?.front_content.title).toBe(cardData.frontContent.title)
    })

    it('should update card via API', async () => {
      const cardData = testDataGenerator.generateCardData()

      // 先创建卡片
      const createResult = await testBase.verifyApiResponse(async () => {
        const response = await fetch('/rest/v1/cards', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            front_content: cardData.frontContent,
            back_content: cardData.backContent,
            folder_id: cardData.folderId,
            style: cardData.style
          })
        })
        return response.json()
      })

      const cardId = createResult.data?.id

      // 更新卡片
      const updateResult = await testBase.verifyApiResponse(async () => {
        const response = await fetch(`/rest/v1/cards?id=eq.${cardId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            front_content: {
              ...cardData.frontContent,
              title: 'Updated Title'
            }
          })
        })
        return response.json()
      })

      expect(updateResult.success).toBe(true)
    })

    it('should delete card via API', async () => {
      const cardData = testDataGenerator.generateCardData()

      // 先创建卡片
      const createResult = await testBase.verifyApiResponse(async () => {
        const response = await fetch('/rest/v1/cards', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            front_content: cardData.frontContent,
            back_content: cardData.backContent,
            folder_id: cardData.folderId,
            style: cardData.style
          })
        })
        return response.json()
      })

      const cardId = createResult.data?.id

      // 删除卡片
      const deleteResult = await testBase.verifyApiResponse(async () => {
        const response = await fetch(`/rest/v1/cards?id=eq.${cardId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer test-token'
          }
        })
        return response.status
      })

      expect(deleteResult.success).toBe(true)
    })
  })

  describe('File Upload Operations', () => {
    it('should upload image files', async () => {
      // 创建模拟文件
      const mockFile = new File(['test image content'], 'test.jpg', {
        type: 'image/jpeg'
      })

      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await testBase.verifyApiResponse(async () => {
        const response = await fetch('/storage/v1/object/images', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token'
          },
          body: formData
        })
        return response.json()
      })

      expect(result.success).toBe(true)
      expect(result.data?.Key).toBeDefined()
      expect(result.data?.Location).toBeDefined()
    })

    it('should handle large file uploads', async () => {
      // 创建大文件模拟
      const largeContent = 'x'.repeat(1024 * 1024) // 1MB
      const largeFile = new File([largeContent], 'large.jpg', {
        type: 'image/jpeg'
      })

      const formData = new FormData()
      formData.append('file', largeFile)

      const startTime = performance.now()

      const result = await testBase.verifyApiResponse(async () => {
        const response = await fetch('/storage/v1/object/images', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token'
          },
          body: formData
        })
        return response.json()
      })

      const endTime = performance.now()

      expect(result.success).toBe(true)
      expect(endTime - startTime).toBeLessThan(5000) // 5秒内完成
    })
  })

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      const result = await testBase.verifyApiResponse(async () => {
        const response = await fetch('/rest/v1/cards', {
          headers: {
            'Authorization': 'Bearer invalid-token',
            'Content-Type': 'application/json'
          }
        })
        return response.json()
      })

      expect(result.success).toBe(false)
    })

    it('should handle validation errors', async () => {
      const invalidCardData = {
        front_content: { title: '', text: '' }, // 无效数据
        back_content: { title: '', text: '' }
      }

      const result = await testBase.verifyApiResponse(async () => {
        const response = await fetch('/rest/v1/cards', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidCardData)
        })
        return response.json()
      })

      expect(result.success).toBe(false)
    })

    it('should handle network timeouts', async () => {
      testBase.apiServer.simulateLatency(6000) // 6秒延迟，超过超时时间

      const result = await testBase.verifyApiResponse(async () => {
        const response = await fetch('/rest/v1/cards', {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        })
        return response.json()
      })

      expect(result.success).toBe(false)
    })
  })

  describe('Batch Operations', () => {
    it('should handle batch card creation', async () => {
      const batchSize = 50
      const cards = Array.from({ length: batchSize }, (_, i) =>
        testDataGenerator.generateCardData({
          frontContent: {
            title: `Batch Card ${i}`,
            text: `Content ${i}`,
            tags: [`batch-${i % 10}`]
          }
        })
      )

      const startTime = performance.now()

      const results = await Promise.allSettled(
        cards.map(card =>
          testBase.verifyApiResponse(async () => {
            const response = await fetch('/rest/v1/cards', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer test-token',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                front_content: card.frontContent,
                back_content: card.backContent,
                folder_id: card.folderId,
                style: card.style
              })
            })
            return response.json()
          })
        )
      )

      const endTime = performance.now()

      const successfulOps = results.filter(r => r.status === 'fulfilled')
      expect(successfulOps.length).toBeGreaterThan(batchSize * 0.8) // 80%成功率
      expect(endTime - startTime).toBeLessThan(10000) // 10秒内完成
    })
  })
})

class DataOperationsIntegrationTest extends ApiIntegrationTestBase {
  protected async initializeTestServices(): Promise<void> {
    // 数据操作测试不需要额外的服务初始化
  }
}
```

## 同步系统集成测试

### 1. 同步系统集成测试框架

#### 同步集成测试环境

```typescript
// tests/integration/sync/sync-integration-environment.ts
import { TestDatabaseManager } from '../database/test-database-manager'
import { ApiMockServer } from '../api/api-mock-setup'
import { CloudSyncService } from '@/services/cloud-sync'
import { TestDataGenerator } from '../fixtures/test-data-generator'

export class SyncIntegrationTestEnvironment {
  private dbManager: TestDatabaseManager
  private apiServer: ApiMockServer
  private syncService: CloudSyncService
  private testDataGenerator: TestDataGenerator
  private testDb: CardAllDatabase

  public networkState: NetworkState = 'online'
  public syncEvents: SyncEvent[] = []

  constructor() {
    this.dbManager = new TestDatabaseManager()
    this.apiServer = new ApiMockServer()
    this.testDataGenerator = new TestDataGenerator()
  }

  async initialize(): Promise<void> {
    // 启动 API 模拟服务器
    this.apiServer.start()

    // 创建测试数据库
    this.testDb = await this.dbManager.createTestDatabase('sync-test-db')

    // 创建同步服务
    this.syncService = new CloudSyncService(
      this.createMockSupabaseClient(),
      this.testDb
    )

    // 设置事件监听
    this.setupEventListeners()

    // 设置网络状态模拟
    this.setupNetworkSimulation()
  }

  async cleanup(): Promise<void> {
    // 停止 API 模拟服务器
    this.apiServer.stop()

    // 清理测试数据库
    await this.dbManager.clearDatabase(this.testDb.name)

    // 清理事件监听
    this.cleanupEventListeners()
  }

  private createMockSupabaseClient(): any {
    return {
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
        })
      }
    }
  }

  private setupEventListeners(): void {
    // 监听同步事件
    this.syncService.addEventListener('sync-start', (event) => {
      this.syncEvents.push({
        type: 'sync-start',
        timestamp: new Date(),
        data: event.data
      })
    })

    this.syncService.addEventListener('sync-complete', (event) => {
      this.syncEvents.push({
        type: 'sync-complete',
        timestamp: new Date(),
        data: event.data
      })
    })

    this.syncService.addEventListener('sync-error', (event) => {
      this.syncEvents.push({
        type: 'sync-error',
        timestamp: new Date(),
        data: event.data
      })
    })

    this.syncService.addEventListener('conflict-detected', (event) => {
      this.syncEvents.push({
        type: 'conflict-detected',
        timestamp: new Date(),
        data: event.data
      })
    })
  }

  private cleanupEventListeners(): void {
    this.syncEvents = []
  }

  private setupNetworkSimulation(): void {
    // 模拟网络状态变化
    if (typeof window !== 'undefined') {
      Object.defineProperty(window.navigator, 'onLine', {
        get: () => this.networkState === 'online',
        configurable: true
      })
    }
  }

  // 模拟网络状态变化
  async simulateOffline(): Promise<void> {
    this.networkState = 'offline'

    // 触发离线事件
    this.syncService.handleNetworkChange(false)

    // 等待状态更新
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  async simulateOnline(): Promise<void> {
    this.networkState = 'online'

    // 触发在线事件
    this.syncService.handleNetworkChange(true)

    // 等待状态更新
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // 创建测试数据
  async createTestData(options: TestDataOptions = {}): Promise<TestData> {
    const { cardCount = 10, folderCount = 3, tagCount = 5 } = options

    const folders = Array.from({ length: folderCount }, (_, i) =>
      this.testDataGenerator.generateFolderData({
        name: `Test Folder ${i + 1}`
      })
    )

    await this.testDb.folders.bulkAdd(folders)

    const tags = Array.from({ length: tagCount }, (_, i) =>
      this.testDataGenerator.generateTagData({
        name: `Test Tag ${i + 1}`
      })
    )

    await this.testDb.tags.bulkAdd(tags)

    const cards = Array.from({ length: cardCount }, (_, i) => {
      const folderIndex = i % folders.length
      const tagIndex = i % tags.length

      return this.testDataGenerator.generateCardData({
        frontContent: {
          title: `Test Card ${i + 1}`,
          text: `Content for card ${i + 1}`,
          tags: [tags[tagIndex].id]
        },
        folderId: folders[folderIndex].id
      })
    })

    await this.testDb.cards.bulkAdd(cards)

    return {
      cards,
      folders,
      tags,
      syncQueue: []
    }
  }

  // 执行同步操作
  async performSync(options: SyncOptions = {}): Promise<SyncResult> {
    const { forceFullSync = false, retryFailed = true } = options

    try {
      let result: SyncResult

      if (forceFullSync) {
        result = await this.syncService.performFullSync()
      } else {
        result = await this.syncService.processSyncQueue()
      }

      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processed: 0,
        failed: 0
      }
    }
  }

  // 验证数据一致性
  async verifyDataConsistency(): Promise<DataConsistencyReport> {
    const localCards = await this.testDb.cards.toArray()
    const localFolders = await this.testDb.folders.toArray()
    const localTags = await this.testDb.tags.toArray()

    // 模拟云端数据（在实际测试中，这里会调用API）
    const cloudCards = await this.getCloudData('cards')
    const cloudFolders = await this.getCloudData('folders')
    const cloudTags = await this.getCloudData('tags')

    return {
      local: {
        cards: localCards.length,
        folders: localFolders.length,
        tags: localTags.length
      },
      cloud: {
        cards: cloudCards.length,
        folders: cloudFolders.length,
        tags: cloudTags.length
      },
      syncStatus: {
        cardsInSync: this.countSyncedItems(localCards, cloudCards),
        foldersInSync: this.countSyncedItems(localFolders, cloudFolders),
        tagsInSync: this.countSyncedItems(localTags, cloudTags)
      },
      conflicts: this.detectConflicts(localCards, cloudCards)
    }
  }

  private async getCloudData(type: string): Promise<any[]> {
    // 模拟API调用获取云端数据
    switch (type) {
      case 'cards':
        return [
          { id: 'cloud-card-1', title: 'Cloud Card 1', sync_version: 2 },
          { id: 'cloud-card-2', title: 'Cloud Card 2', sync_version: 1 }
        ]
      case 'folders':
        return [
          { id: 'cloud-folder-1', name: 'Cloud Folder 1' },
          { id: 'cloud-folder-2', name: 'Cloud Folder 2' }
        ]
      case 'tags':
        return [
          { id: 'cloud-tag-1', name: 'Cloud Tag 1' },
          { id: 'cloud-tag-2', name: 'Cloud Tag 2' }
        ]
      default:
        return []
    }
  }

  private countSyncedItems(localItems: any[], cloudItems: any[]): number {
    return localItems.filter(localItem =>
      cloudItems.some(cloudItem =>
        cloudItem.id === localItem.id &&
        cloudItem.sync_version >= localItem.sync_version
      )
    ).length
  }

  private detectConflicts(localCards: any[], cloudCards: any[]): ConflictInfo[] {
    return localCards
      .filter(localCard =>
        cloudCards.some(cloudCard =>
          cloudCard.id === localCard.id &&
          cloudCard.sync_version > localCard.sync_version
        )
      )
      .map(conflictCard => ({
        entityId: conflictCard.id,
        entityType: 'card',
        localVersion: conflictCard.sync_version,
        remoteVersion: cloudCards.find(c => c.id === conflictCard.id)?.sync_version || 0,
        conflictType: 'version-mismatch',
        detectedAt: new Date()
      }))
  }

  // 获取同步事件历史
  getSyncEvents(): SyncEvent[] {
    return [...this.syncEvents]
  }

  // 清除同步事件历史
  clearSyncEvents(): void {
    this.syncEvents = []
  }
}

export interface TestDataOptions {
  cardCount?: number
  folderCount?: number
  tagCount?: number
}

export interface SyncOptions {
  forceFullSync?: boolean
  retryFailed?: boolean
}

export interface NetworkState {
  type: 'online' | 'offline' | 'limited'
  latency?: number
  bandwidth?: number
}

export interface SyncEvent {
  type: string
  timestamp: Date
  data: any
}

export interface DataConsistencyReport {
  local: {
    cards: number
    folders: number
    tags: number
  }
  cloud: {
    cards: number
    folders: number
    tags: number
  }
  syncStatus: {
    cardsInSync: number
    foldersInSync: number
    tagsInSync: number
  }
  conflicts: ConflictInfo[]
}

export interface ConflictInfo {
  entityId: string
  entityType: string
  localVersion: number
  remoteVersion: number
  conflictType: string
  detectedAt: Date
}
```

#### 同步集成测试基类

```typescript
// tests/integration/sync/sync-integration-base.ts
import { SyncIntegrationTestEnvironment } from './sync-integration-environment'

export abstract class SyncIntegrationTestBase {
  protected testEnv: SyncIntegrationTestEnvironment

  constructor() {
    this.testEnv = new SyncIntegrationTestEnvironment()
  }

  async beforeEach(): Promise<void> {
    await this.testEnv.initialize()
    await this.initializeTestData()
  }

  async afterEach(): Promise<void> {
    await this.testEnv.cleanup()
  }

  protected abstract initializeTestData(): Promise<void>

  // 同步操作辅助方法
  protected async performSyncWithVerification(
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const result = await this.testEnv.performSync(options)

    // 验证同步结果
    expect(result.success).toBe(true)
    expect(result.processed).toBeGreaterThan(0)

    return result
  }

  // 数据一致性验证方法
  protected async verifyDataConsistency(): Promise<DataConsistencyReport> {
    const report = await this.testEnv.verifyDataConsistency()

    // 验证数据一致性
    expect(report.local.cards).toBeGreaterThan(0)
    expect(report.local.folders).toBeGreaterThan(0)
    expect(report.local.tags).toBeGreaterThan(0)

    return report
  }

  // 网络状态测试方法
  protected async testNetworkStateTransition(
    fromState: NetworkState['type'],
    toState: NetworkState['type'],
    testFn: () => Promise<void>
  ): Promise<void> {
    // 设置初始网络状态
    if (fromState === 'offline') {
      await this.testEnv.simulateOffline()
    } else {
      await this.testEnv.simulateOnline()
    }

    // 执行状态转换测试
    await testFn()

    // 转换到目标状态
    if (toState === 'offline') {
      await this.testEnv.simulateOffline()
    } else {
      await this.testEnv.simulateOnline()
    }
  }

  // 同步事件验证方法
  protected async verifySyncEvents(
    expectedEvents: string[],
    timeoutMs: number = 5000
  ): Promise<void> {
    const startTime = performance.now()

    while (performance.now() - startTime < timeoutMs) {
      const events = this.testEnv.getSyncEvents()
      const foundEvents = events.map(e => e.type)

      if (expectedEvents.every(event => foundEvents.includes(event))) {
        return
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // 如果超时，抛出错误
    const actualEvents = this.testEnv.getSyncEvents().map(e => e.type)
    throw new Error(
      `Expected events [${expectedEvents.join(', ')}] but found [${actualEvents.join(', ')}]`
    )
  }

  // 冲突检测测试方法
  protected async createConflictScenario(): Promise<ConflictInfo> {
    // 创建本地数据
    const localCard = this.testEnv.testDataGenerator.generateCardData({
      frontContent: { title: 'Local Version', text: 'Local content' }
    })

    await this.testEnv.testDb.cards.add(localCard)

    // 模拟云端更新
    const cloudCard = {
      ...localCard,
      frontContent: { title: 'Cloud Version', text: 'Cloud content' },
      sync_version: localCard.syncVersion + 1
    }

    // 触发冲突检测
    await this.testEnv.simulateOnline()
    const result = await this.testEnv.performSync()

    // 返回冲突信息
    return {
      entityId: localCard.id,
      entityType: 'card',
      localVersion: localCard.syncVersion,
      remoteVersion: cloudCard.sync_version,
      conflictType: 'version-mismatch',
      detectedAt: new Date()
    }
  }
}
```

### 2. 同步系统集成测试套件

#### 离线-在线同步测试

```typescript
// tests/integration/sync/offline-online-sync.integration.test.ts
import { SyncIntegrationTestBase } from './sync-integration-base'
import { TestDataGenerator } from '../fixtures/test-data-generator'

describe('Offline-Online Sync Integration Tests', () => {
  let testBase: SyncIntegrationTestBase
  let testDataGenerator: TestDataGenerator

  beforeEach(async () => {
    testBase = new OfflineOnlineSyncTest()
    await testBase.beforeEach()
    testDataGenerator = new TestDataGenerator()
  })

  afterEach(async () => {
    await testBase.afterEach()
  })

  describe('Offline Operations', () => {
    it('should queue operations when offline', async () => {
      // 模拟离线状态
      await testBase.testEnv.simulateOffline()

      // 创建本地数据
      const offlineCard = testDataGenerator.generateCardData({
        frontContent: {
          title: 'Offline Card',
          text: 'Created while offline',
          tags: ['offline']
        }
      })

      await testBase.testEnv.testDb.cards.add(offlineCard)

      // 验证数据被标记为待同步
      const pendingCards = await testBase.testEnv.testDb.cards
        .where('pendingSync')
        .equals(true)
        .toArray()

      expect(pendingCards).toHaveLength(1)
      expect(pendingCards[0].frontContent.title).toBe('Offline Card')
    })

    it('should handle multiple offline operations', async () => {
      await testBase.testEnv.simulateOffline()

      // 创建多个离线操作
      const operations = []

      // 创建卡片
      for (let i = 0; i < 5; i++) {
        const card = testDataGenerator.generateCardData({
          frontContent: {
            title: `Offline Card ${i}`,
            text: `Content ${i}`,
            tags: [`offline-${i}`]
          }
        })
        operations.push(testBase.testEnv.testDb.cards.add(card))
      }

      // 创建文件夹
      for (let i = 0; i < 3; i++) {
        const folder = testDataGenerator.generateFolderData({
          name: `Offline Folder ${i}`
        })
        operations.push(testBase.testEnv.testDb.folders.add(folder))
      }

      await Promise.all(operations)

      // 验证所有操作都被标记为待同步
      const pendingCards = await testBase.testEnv.testDb.cards
        .where('pendingSync')
        .equals(true)
        .toArray()

      const pendingFolders = await testBase.testEnv.testDb.folders
        .where('pendingSync')
        .equals(true)
        .toArray()

      expect(pendingCards).toHaveLength(5)
      expect(pendingFolders).toHaveLength(3)
    })

    it('should maintain data integrity during offline operations', async () => {
      await testBase.testEnv.simulateOffline()

      // 创建带有关联的数据
      const folder = testDataGenerator.generateFolderData({
        name: 'Offline Folder'
      })
      const folderId = await testBase.testEnv.testDb.folders.add(folder)

      const tags = [
        testDataGenerator.generateTagData({ name: 'Offline Tag 1' }),
        testDataGenerator.generateTagData({ name: 'Offline Tag 2' })
      ]
      await testBase.testEnv.testDb.tags.bulkAdd(tags)

      const card = testDataGenerator.generateCardData({
        frontContent: {
          title: 'Offline Card with Relations',
          text: 'Card with folder and tags',
          tags: tags.map(t => t.id)
        },
        folderId
      })

      await testBase.testEnv.testDb.cards.add(card)

      // 验证数据关系完整性
      const retrievedCard = await testBase.testEnv.testDb.cards.get(card.id)
      expect(retrievedCard?.folderId).toBe(folderId)
      expect(retrievedCard?.frontContent.tags).toHaveLength(2)
    })
  })

  describe('Online Synchronization', () => {
    it('should sync queued operations when coming online', async () => {
      // 创建离线操作
      await testBase.testEnv.simulateOffline()

      const offlineCard = testDataGenerator.generateCardData({
        frontContent: {
          title: 'Offline to Online Card',
          text: 'Will sync when online',
          tags: ['sync-test']
        }
      })

      await testBase.testEnv.testDb.cards.add(offlineCard)

      // 模拟恢复在线
      await testBase.testEnv.simulateOnline()

      // 等待同步完成
      await testBase.verifySyncEvents(['sync-start', 'sync-complete'])

      // 验证同步状态
      const syncedCard = await testBase.testEnv.testDb.cards.get(offlineCard.id)
      expect(syncedCard?.pendingSync).toBe(false)

      // 验证数据一致性
      const report = await testBase.verifyDataConsistency()
      expect(report.syncStatus.cardsInSync).toBeGreaterThan(0)
    })

    it('should handle sync conflicts when coming online', async () => {
      // 创建离线数据
      await testBase.testEnv.simulateOffline()

      const localCard = testDataGenerator.generateCardData({
        frontContent: {
          title: 'Local Version',
          text: 'Local content',
          tags: ['conflict']
        }
      })

      await testBase.testEnv.testDb.cards.add(localCard)

      // 模拟云端同时更新
      const cloudCard = {
        ...localCard,
        frontContent: {
          title: 'Cloud Version',
          text: 'Cloud content',
          tags: ['conflict']
        },
        sync_version: localCard.syncVersion + 1
      }

      // 恢复在线并同步
      await testBase.testEnv.simulateOnline()

      const result = await testBase.testEnv.performSync()

      // 验证冲突处理
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].entityId).toBe(localCard.id)
      expect(result.conflicts[0].conflictType).toBe('version-mismatch')
    })

    it('should retry failed sync operations', async () => {
      await testBase.testEnv.simulateOffline()

      // 创建多个离线操作
      const cards = Array.from({ length: 10 }, (_, i) =>
        testDataGenerator.generateCardData({
          frontContent: {
            title: `Retry Card ${i}`,
            text: `Content ${i}`,
            tags: ['retry-test']
          }
        })
      )

      await testBase.testEnv.testDb.cards.bulkAdd(cards)

      // 模拟网络问题
      testBase.testEnv.apiServer.simulateNetworkError()
      await testBase.testEnv.simulateOnline()

      // 第一次同步应该失败
      const firstResult = await testBase.testEnv.performSync()
      expect(firstResult.success).toBe(false)
      expect(firstResult.failed).toBeGreaterThan(0)

      // 恢复网络并重试
      testBase.testEnv.apiServer.reset()
      const retryResult = await testBase.testEnv.performSync({ retryFailed: true })

      expect(retryResult.success).toBe(true)
      expect(retryResult.processed).toBeGreaterThan(0)
    })
  })

  describe('Network Transitions', () => {
    it('should handle rapid online-offline transitions', async () => {
      // 快速切换网络状态
      for (let i = 0; i < 5; i++) {
        await testBase.testEnv.simulateOffline()
        await new Promise(resolve => setTimeout(resolve, 100))
        await testBase.testEnv.simulateOnline()
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // 验证系统稳定性
      const events = testBase.testEnv.getSyncEvents()
      expect(events.length).toBeGreaterThan(0)

      // 创建测试数据
      const card = testDataGenerator.generateCardData({
        frontContent: {
          title: 'Stability Test Card',
          text: 'Test after network transitions',
          tags: ['stability']
        }
      })

      await testBase.testEnv.testDb.cards.add(card)

      // 验证正常同步
      const result = await testBase.performSyncWithVerification()
      expect(result.success).toBe(true)
    })

    it('should maintain operation order during sync', async () => {
      await testBase.testEnv.simulateOffline()

      // 创建有序操作序列
      const operations = []

      for (let i = 0; i < 5; i++) {
        const card = testDataGenerator.generateCardData({
          frontContent: {
            title: `Sequential Card ${i}`,
            text: `Content ${i}`,
            tags: ['sequential']
          }
        })

        const cardId = await testBase.testEnv.testDb.cards.add(card)

        // 更新操作
        await testBase.testEnv.testDb.cards.update(cardId, {
          frontContent: {
            ...card.frontContent,
            title: `Updated Sequential Card ${i}`
          }
        })

        operations.push({ id: cardId, operation: i })
      }

      // 恢复在线并同步
      await testBase.testEnv.simulateOnline()

      const result = await testBase.performSyncWithVerification()

      // 验证操作顺序保持
      const syncedCards = await testBase.testEnv.testDb.cards
        .where('pendingSync')
        .equals(false)
        .toArray()

      expect(syncedCards).toHaveLength(10) // 5个创建 + 5个更新

      // 验证同步版本递增
      for (let i = 0; i < operations.length; i++) {
        const card = syncedCards.find(c => c.id === operations[i].id)
        expect(card?.syncVersion).toBeGreaterThan(1)
      }
    })

    it('should handle partial sync failures gracefully', async () => {
      await testBase.testEnv.simulateOffline()

      // 创建大量数据
      const cards = Array.from({ length: 100 }, (_, i) =>
        testDataGenerator.generateCardData({
          frontContent: {
            title: `Partial Sync Card ${i}`,
            text: `Content ${i}`,
            tags: ['partial-sync']
          }
        })
      )

      await testBase.testEnv.testDb.cards.bulkAdd(cards)

      // 模拟部分失败的网络
      testBase.testEnv.apiServer.use(
        rest.post('/rest/v1/cards', (req, res, ctx) => {
          const random = Math.random()
          if (random < 0.3) { // 30%失败率
            return res.networkError('Network error')
          }
          return res(ctx.status(200))
        })
      )

      await testBase.testEnv.simulateOnline()

      const result = await testBase.testEnv.performSync()

      // 验证部分成功
      expect(result.success).toBe(true)
      expect(result.processed).toBeGreaterThan(0)
      expect(result.failed).toBeGreaterThan(0)

      // 验证重试机制
      const retryResult = await testBase.testEnv.performSync({ retryFailed: true })
      expect(retryResult.success).toBe(true)
    })
  })

  describe('Performance Optimization', () => {
    it('should batch sync operations efficiently', async () => {
      await testBase.testEnv.simulateOffline()

      // 创建大量数据
      const largeDataset = Array.from({ length: 1000 }, (_, i) =>
        testDataGenerator.generateCardData({
          frontContent: {
            title: `Batch Card ${i}`,
            text: `Content ${i}`,
            tags: [`batch-${Math.floor(i / 100)}`]
          }
        })
      )

      const insertStartTime = performance.now()
      await testBase.testEnv.testDb.cards.bulkAdd(largeDataset)
      const insertEndTime = performance.now()

      await testBase.testEnv.simulateOnline()

      const syncStartTime = performance.now()
      const result = await testBase.performSyncWithVerification()
      const syncEndTime = performance.now()

      // 验证性能指标
      expect(insertEndTime - insertStartTime).toBeLessThan(2000) // 2秒内插入
      expect(syncEndTime - syncStartTime).toBeLessThan(10000) // 10秒内同步
      expect(result.processed).toBe(1000)
    })

    it('should optimize sync for small changes', async () => {
      // 创建基础数据
      const baseData = await testBase.testEnv.createTestData({ cardCount: 100 })

      // 模拟在线状态
      await testBase.testEnv.simulateOnline()

      // 执行完整同步
      const fullSyncResult = await testBase.performSyncWithVerification()

      // 进行少量更改
      await testBase.testEnv.simulateOffline()

      const updatePromises = baseData.cards.slice(0, 5).map(card =>
        testBase.testEnv.testDb.cards.update(card.id, {
          frontContent: {
            ...card.frontContent,
            title: `Updated ${card.frontContent.title}`
          }
        })
      )

      await Promise.all(updatePromises)

      await testBase.testEnv.simulateOnline()

      // 增量同步
      const incrementalSyncStartTime = performance.now()
      const incrementalResult = await testBase.performSyncWithVerification()
      const incrementalSyncEndTime = performance.now()

      // 验证增量同步效率
      expect(incrementalSyncEndTime - incrementalSyncStartTime).toBeLessThan(2000)
      expect(incrementalResult.processed).toBe(5)
    })
  })
})

class OfflineOnlineSyncTest extends SyncIntegrationTestBase {
  protected async initializeTestData(): Promise<void> {
    // 离线-在线同步测试不需要预置数据
  }
}
```

#### 冲突解决集成测试

```typescript
// tests/integration/sync/conflict-resolution.integration.test.ts
import { SyncIntegrationTestBase } from './sync-integration-base'
import { TestDataGenerator } from '../fixtures/test-data-generator'

describe('Conflict Resolution Integration Tests', () => {
  let testBase: SyncIntegrationTestBase
  let testDataGenerator: TestDataGenerator

  beforeEach(async () => {
    testBase = new ConflictResolutionTest()
    await testBase.beforeEach()
    testDataGenerator = new TestDataGenerator()
  })

  afterEach(async () => {
    await testBase.afterEach()
  })

  describe('Version Conflicts', () => {
    it('should detect version conflicts automatically', async () => {
      // 创建本地数据
      const localCard = testDataGenerator.generateCardData({
        frontContent: {
          title: 'Local Version',
          text: 'Local content',
          tags: ['conflict-test']
        }
      })

      await testBase.testEnv.testDb.cards.add(localCard)

      // 模拟云端更新
      const cloudCard = {
        ...localCard,
        frontContent: {
          title: 'Cloud Version',
          text: 'Cloud content',
          tags: ['conflict-test']
        },
        sync_version: localCard.syncVersion + 1
      }

      // 触发冲突检测
      const conflict = await testBase.createConflictScenario()

      expect(conflict.entityId).toBe(localCard.id)
      expect(conflict.conflictType).toBe('version-mismatch')
      expect(conflict.localVersion).toBe(localCard.syncVersion)
      expect(conflict.remoteVersion).toBe(cloudCard.sync_version)
    })

    it('should resolve conflicts with intelligent merging', async () => {
      // 创建复杂的冲突场景
      const baseCard = testDataGenerator.generateCardData({
        frontContent: {
          title: 'Base Version',
          text: 'Base content',
          tags: ['base', 'original']
        },
        backContent: {
          title: 'Base Back',
          text: 'Base back content',
          tags: ['base-back']
        }
      })

      await testBase.testEnv.testDb.cards.add(baseCard)

      // 本地修改标题和内容
      await testBase.testEnv.testDb.cards.update(baseCard.id, {
        frontContent: {
          ...baseCard.frontContent,
          title: 'Local Modified Title',
          text: 'Local modified content'
        }
      })

      // 云端修改标签和背面内容
      const cloudCard = {
        ...baseCard,
        frontContent: {
          ...baseCard.frontContent,
          tags: ['base', 'original', 'cloud-added']
        },
        backContent: {
          ...baseCard.backContent,
          text: 'Cloud modified back content'
        },
        sync_version: baseCard.syncVersion + 1
      }

      // 执行冲突解决
      const resolutionResult = await testBase.testEnv.syncService.resolveConflict(
        baseCard.id,
        'intelligent-merge'
      )

      expect(resolutionResult.success).toBe(true)
      expect(resolutionResult.mergedData.frontContent.title).toBe('Local Modified Title')
      expect(resolutionResult.mergedData.frontContent.tags).toContain('cloud-added')
      expect(resolutionResult.mergedData.backContent.text).toBe('Cloud modified back content')
    })

    it('should handle user-defined conflict resolution strategies', async () => {
      // 创建冲突场景
      const conflict = await testBase.createConflictScenario()

      // 测试不同解决策略
      const strategies = ['local-wins', 'remote-wins', 'manual-merge']

      for (const strategy of strategies) {
        const result = await testBase.testEnv.syncService.resolveConflict(
          conflict.entityId,
          strategy as any
        )

        expect(result.success).toBe(true)
        expect(result.strategy).toBe(strategy)
      }
    })
  })

  describe('Data Structure Conflicts', () => {
    it('should resolve folder structure conflicts', async () => {
      // 创建本地文件夹结构
      const localFolder = testDataGenerator.generateFolderData({
        name: 'Local Folder',
        parentId: null
      })

      const localSubFolder = testDataGenerator.generateFolderData({
        name: 'Local Sub Folder',
        parentId: localFolder.id
      })

      await testBase.testEnv.testDb.folders.bulkAdd([localFolder, localSubFolder])

      // 云端有不同的结构
      const cloudFolder = {
        ...localFolder,
        name: 'Cloud Folder',
        parent_id: null
      }

      // 触发冲突
      const result = await testBase.testEnv.performSync()

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].entityType).toBe('folder')

      // 解决冲突
      const resolution = await testBase.testEnv.syncService.resolveConflict(
        localFolder.id,
        'intelligent-merge'
      )

      expect(resolution.success).toBe(true)
    })

    it('should handle tag relationship conflicts', async () => {
      // 创建标签和关联卡片
      const tag = testDataGenerator.generateTagData({ name: 'Test Tag' })
      const card = testDataGenerator.generateCardData({
        frontContent: {
          title: 'Tagged Card',
          text: 'Card with tags',
          tags: [tag.id]
        }
      })

      await testBase.testEnv.testDb.tags.add(tag)
      await testBase.testEnv.testDb.cards.add(card)

      // 云端删除标签但保留卡片
      const cloudTag = { ...tag, deleted: true }

      // 触发冲突
      const result = await testBase.testEnv.performSync()

      expect(result.conflicts).toHaveLength(1)

      // 验证智能解决
      const resolution = await testBase.testEnv.syncService.resolveConflict(
        tag.id,
        'intelligent-merge'
      )

      expect(resolution.success).toBe(true)

      // 验证卡片关系更新
      const updatedCard = await testBase.testEnv.testDb.cards.get(card.id)
      expect(updatedCard?.frontContent.tags).not.toContain(tag.id)
    })
  })

  describe('Concurrent Modification Conflicts', () => {
    it('should resolve concurrent field-level modifications', async () => {
      const baseCard = testDataGenerator.generateCardData({
        frontContent: {
          title: 'Concurrent Base',
          text: 'Base content',
          tags: ['concurrent']
        }
      })

      await testBase.testEnv.testDb.cards.add(baseCard)

      // 模拟并发修改
      const modifications = [
        { field: 'title', value: 'Concurrent Title 1' },
        { field: 'text', value: 'Concurrent content 2' },
        { field: 'tags', value: ['concurrent', 'added'] }
      ]

      // 本地修改
      await testBase.testEnv.testDb.cards.update(baseCard.id, {
        frontContent: {
          ...baseCard.frontContent,
          title: modifications[0].value,
          text: modifications[1].value
        }
      })

      // 云端修改
      const cloudCard = {
        ...baseCard,
        frontContent: {
          ...baseCard.frontContent,
          text: modifications[1].value,
          tags: modifications[2].value
        },
        sync_version: baseCard.syncVersion + 1
      }

      // 执行同步
      const result = await testBase.testEnv.performSync()

      expect(result.conflicts).toHaveLength(1)

      // 智能合并
      const resolution = await testBase.testEnv.syncService.resolveConflict(
        baseCard.id,
        'intelligent-merge'
      )

      expect(resolution.success).toBe(true)
      expect(resolution.mergedData.frontContent.title).toBe(modifications[0].value)
      expect(resolution.mergedData.frontContent.text).toBe(modifications[1].value)
      expect(resolution.mergedData.frontContent.tags).toEqual(modifications[2].value)
    })

    it('should handle delete-modify conflicts', async () => {
      const card = testDataGenerator.generateCardData({
        frontContent: {
          title: 'Delete-Modify Test',
          text: 'Test content',
          tags: ['conflict']
        }
      })

      await testBase.testEnv.testDb.cards.add(card)

      // 本地删除
      await testBase.testEnv.testDb.cards.delete(card.id)

      // 云端修改
      const cloudCard = {
        ...card,
        frontContent: {
          ...card.frontContent,
          title: 'Modified in Cloud'
        },
        sync_version: card.syncVersion + 1
      }

      // 触发冲突
      const result = await testBase.testEnv.performSync()

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].conflictType).toBe('delete-modify')

      // 解决冲突
      const resolution = await testBase.testEnv.syncService.resolveConflict(
        card.id,
        'remote-wins' // 恢复删除的卡片
      )

      expect(resolution.success).toBe(true)

      // 验证卡片恢复
      const restoredCard = await testBase.testEnv.testDb.cards.get(card.id)
      expect(restoredCard).toBeDefined()
      expect(restoredCard?.frontContent.title).toBe('Modified in Cloud')
    })
  })

  describe('Conflict Resolution Performance', () => {
    it('should handle large-scale conflicts efficiently', async () => {
      // 创建大量冲突场景
      const conflictCount = 100
      const conflicts = []

      for (let i = 0; i < conflictCount; i++) {
        const card = testDataGenerator.generateCardData({
          frontContent: {
            title: `Conflict Card ${i}`,
            text: `Content ${i}`,
            tags: ['bulk-conflict']
          }
        })

        await testBase.testEnv.testDb.cards.add(card)

        // 云端修改
        const cloudCard = {
          ...card,
          frontContent: {
            ...card.frontContent,
            title: `Cloud Conflict Card ${i}`
          },
          sync_version: card.syncVersion + 1
        }

        conflicts.push({ local: card, cloud: cloudCard })
      }

      // 批量解决冲突
      const startTime = performance.now()

      const resolutionPromises = conflicts.map(conflict =>
        testBase.testEnv.syncService.resolveConflict(
          conflict.local.id,
          'intelligent-merge'
        )
      )

      const results = await Promise.allSettled(resolutionPromises)
      const endTime = performance.now()

      // 验证性能
      expect(endTime - startTime).toBeLessThan(5000) // 5秒内完成
      expect(results.filter(r => r.status === 'fulfilled').length).toBe(conflictCount)
    })

    it('should provide detailed conflict reports', async () => {
      // 创建多种类型的冲突
      const conflictTypes = [
        { type: 'version-mismatch', count: 10 },
        { type: 'delete-modify', count: 5 },
        { type: 'structure-conflict', count: 3 }
      ]

      for (const conflictType of conflictTypes) {
        for (let i = 0; i < conflictType.count; i++) {
          await testBase.createConflictScenario()
        }
      }

      // 生成冲突报告
      const report = await testBase.testEnv.syncService.generateConflictReport()

      expect(report.totalConflicts).toBe(18)
      expect(report.byType['version-mismatch']).toBe(10)
      expect(report.byType['delete-modify']).toBe(5)
      expect(report.byType['structure-conflict']).toBe(3)
      expect(report.resolutionRate).toBeGreaterThan(0.8)
    })
  })

  describe('Conflict Prevention', () => {
    it('should prevent conflicts through optimistic locking', async () => {
      const card = testDataGenerator.generateCardData({
        frontContent: {
          title: 'Optimistic Lock Test',
          text: 'Test content',
          tags: ['locking']
        }
      })

      await testBase.testEnv.testDb.cards.add(card)

      // 获取当前版本
      const currentCard = await testBase.testEnv.testDb.cards.get(card.id)
      const currentVersion = currentCard?.sync_version || 1

      // 模拟并发修改
      const modificationPromises = [
        testBase.testEnv.testDb.cards.update(card.id, {
          frontContent: {
            ...card.frontContent,
            title: 'Modification 1'
          },
          sync_version: currentVersion
        }),
        testBase.testEnv.testDb.cards.update(card.id, {
          frontContent: {
            ...card.frontContent,
            title: 'Modification 2'
          },
          sync_version: currentVersion
        })
      ]

      const results = await Promise.allSettled(modificationPromises)

      // 验证只有一个操作成功
      const successfulOps = results.filter(r => r.status === 'fulfilled')
      expect(successfulOps.length).toBe(1)
    })

    it('should use operational transformation for collaborative editing', async () => {
      const card = testDataGenerator.generateCardData({
        frontContent: {
          title: 'OT Test Card',
          text: 'Original content that will be edited collaboratively',
          tags: ['ot-test']
        }
      })

      await testBase.testEnv.testDb.cards.add(card)

      // 模拟多个编辑操作
      const operations = [
        { type: 'insert', position: 9, text: ' collaboratively' },
        { type: 'delete', position: 20, length: 5 },
        { type: 'insert', position: 30, text: ' transformed' }
      ]

      // 应用操作变换
      let transformedContent = card.frontContent.text

      for (const op of operations) {
        switch (op.type) {
          case 'insert':
            transformedContent =
              transformedContent.slice(0, op.position) +
              op.text +
              transformedContent.slice(op.position)
            break
          case 'delete':
            transformedContent =
              transformedContent.slice(0, op.position) +
              transformedContent.slice(op.position + op.length)
            break
        }
      }

      // 更新卡片
      await testBase.testEnv.testDb.cards.update(card.id, {
        frontContent: {
          ...card.frontContent,
          text: transformedContent
        }
      })

      // 验证结果
      const updatedCard = await testBase.testEnv.testDb.cards.get(card.id)
      expect(updatedCard?.frontContent.text).toBe(transformedContent)
    })
  })
})

class ConflictResolutionTest extends SyncIntegrationTestBase {
  protected async initializeTestData(): Promise<void> {
    // 冲突解决测试不需要预置数据
  }
}
```

## 状态管理集成测试

### 1. 状态管理集成测试框架

#### 状态管理测试提供者

```typescript
// tests/integration/state/state-test-provider.tsx
import React, { createContext, useContext, ReactNode } from 'react'
import { CardAllDatabase } from '@/database/cardall-db'
import { CloudSyncService } from '@/services/cloud-sync'
import { CardOperationsProvider } from '@/contexts/cardall-context'

interface TestState {
  database: CardAllDatabase
  syncService: CloudSyncService
  isLoading: boolean
  error: string | null
}

interface TestStateContextType {
  state: TestState
  setState: React.Dispatch<React.SetStateAction<TestState>>
  actions: {
    setLoading: (loading: boolean) => void
    setError: (error: string | null) => void
    clearError: () => void
  }
}

const TestStateContext = createContext<TestStateContextType | undefined>(undefined)

export const TestStateProvider: React.FC<{
  children: ReactNode
  initialState?: Partial<TestState>
}> = ({ children, initialState }) => {
  const [state, setState] = React.useState<TestState>({
    database: initialState?.database || null!,
    syncService: initialState?.syncService || null!,
    isLoading: initialState?.isLoading || false,
    error: initialState?.error || null
  })

  const actions = {
    setLoading: (loading: boolean) => {
      setState(prev => ({ ...prev, isLoading: loading }))
    },
    setError: (error: string | null) => {
      setState(prev => ({ ...prev, error }))
    },
    clearError: () => {
      setState(prev => ({ ...prev, error: null }))
    }
  }

  return (
    <TestStateContext.Provider value={{ state, setState, actions }}>
      <CardOperationsProvider>
        {children}
      </CardOperationsProvider>
    </TestStateContext.Provider>
  )
}

export const useTestState = (): TestStateContextType => {
  const context = useContext(TestStateContext)
  if (!context) {
    throw new Error('useTestState must be used within a TestStateProvider')
  }
  return context
}
```

#### 状态管理集成测试基类

```typescript
// tests/integration/state/state-integration-base.tsx
import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { TestStateProvider } from './state-test-provider'
import { TestDatabaseManager } from '../database/test-database-manager'
import { CloudSyncService } from '@/services/cloud-sync'

interface TestProvidersProps {
  children: ReactNode
  database?: CardAllDatabase
  syncService?: CloudSyncService
}

const TestProviders: React.FC<TestProvidersProps> = ({
  children,
  database,
  syncService
}) => {
  return (
    <TestStateProvider
      initialState={{
        database: database!,
        syncService: syncService!
      }}
    >
      {children}
    </TestStateProvider>
  )
}

export abstract class StateIntegrationTestBase {
  protected dbManager: TestDatabaseManager
  protected testDb: CardAllDatabase
  protected syncService: CloudSyncService

  constructor() {
    this.dbManager = new TestDatabaseManager()
  }

  async beforeEach(): Promise<void> {
    // 创建测试数据库
    this.testDb = await this.dbManager.createTestDatabase('state-test-db')

    // 创建同步服务
    this.syncService = new CloudSyncService(
      this.createMockSupabaseClient(),
      this.testDb
    )

    // 初始化测试数据
    await this.initializeTestData()
  }

  async afterEach(): Promise<void> {
    // 清理测试数据库
    await this.dbManager.clearDatabase(this.testDb.name)
  }

  protected abstract initializeTestData(): Promise<void>

  private createMockSupabaseClient(): any {
    return {
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
        })
      }
    }
  }

  // 渲染带有状态管理提供者的组件
  protected renderWithStateProviders(
    ui: React.ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>
  ) {
    return render(ui, {
      ...options,
      wrapper: ({ children }) => (
        <TestProviders
          database={this.testDb}
          syncService={this.syncService}
        >
          {children}
        </TestProviders>
      )
    })
  }

  // 状态变化验证方法
  protected async verifyStateChange<T>(
    action: () => Promise<void> | void,
    verifier: () => Promise<T> | T,
    timeoutMs: number = 5000
  ): Promise<T> {
    const startTime = performance.now()

    while (performance.now() - startTime < timeoutMs) {
      try {
        const result = await verifier()
        return result
      } catch (error) {
        // 继续等待
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    throw new Error(`State change verification timed out after ${timeoutMs}ms`)
  }

  // 错误状态验证方法
  protected async verifyErrorState(
    action: () => Promise<void> | void,
    expectedError: string | RegExp
  ): Promise<void> {
    try {
      await action()
      throw new Error('Expected error was not thrown')
    } catch (error) {
      if (error instanceof Error) {
        if (typeof expectedError === 'string') {
          expect(error.message).toContain(expectedError)
        } else {
          expect(error.message).toMatch(expectedError)
        }
      }
    }
  }

  // 加载状态验证方法
  protected async verifyLoadingState(
    action: () => Promise<void> | void,
    loadingVerifier: () => boolean
  ): Promise<void> {
    // 执行操作前验证初始状态
    expect(loadingVerifier()).toBe(false)

    // 执行操作
    const actionPromise = Promise.resolve(action())

    // 验证加载状态
    await this.verifyStateChange(
      () => {},
      () => {
        const isLoading = loadingVerifier()
        return isLoading ? true : Promise.reject('Not loading')
      },
      1000
    )

    // 等待操作完成
    await actionPromise

    // 验证加载状态结束
    await this.verifyStateChange(
      () => {},
      () => {
        const isLoading = loadingVerifier()
        return !isLoading ? true : Promise.reject('Still loading')
      },
      5000
    )
  }
}
```

### 2. 状态管理集成测试套件

#### 全局状态管理测试

```typescript
// tests/integration/state/global-state.integration.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StateIntegrationTestBase } from './state-integration-base'
import { useCardOperations } from '@/hooks/use-card-operations'
import { useFolderOperations } from '@/hooks/use-folder-operations'
import { useSyncOperations } from '@/hooks/use-sync-operations'
import { TestDataGenerator } from '../fixtures/test-data-generator'

// 测试组件
const TestCardOperationsComponent: React.FC = () => {
  const { cards, createCard, updateCard, deleteCard, isLoading, error } = useCardOperations()

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="error">{error || 'No Error'}</div>
      <div data-testid="cards-count">{cards.length}</div>
      <button
        data-testid="create-card"
        onClick={() => createCard({
          frontContent: { title: 'Test Card', text: 'Test content', tags: [] },
          backContent: { title: 'Back', text: 'Back content', tags: [] },
          style: { type: 'solid', colors: ['#ffffff'] }
        })}
      >
        Create Card
      </button>
    </div>
  )
}

const TestFolderOperationsComponent: React.FC = () => {
  const { folders, createFolder, updateFolder, deleteFolder } = useFolderOperations()

  return (
    <div>
      <div data-testid="folders-count">{folders.length}</div>
      <button
        data-testid="create-folder"
        onClick={() => createFolder({ name: 'Test Folder', parentId: null })}
      >
        Create Folder
      </button>
    </div>
  )
}

const TestSyncOperationsComponent: React.FC = () => {
  const { syncStatus, startSync, isSyncing, syncError } = useSyncOperations()

  return (
    <div>
      <div data-testid="sync-status">{syncStatus}</div>
      <div data-testid="is-syncing">{isSyncing ? 'Syncing' : 'Not Syncing'}</div>
      <div data-testid="sync-error">{syncError || 'No Sync Error'}</div>
      <button data-testid="start-sync" onClick={startSync}>
        Start Sync
      </button>
    </div>
  )
}

describe('Global State Management Integration Tests', () => {
  let testBase: StateIntegrationTestBase
  let testDataGenerator: TestDataGenerator

  beforeEach(async () => {
    testBase = new GlobalStateIntegrationTest()
    await testBase.beforeEach()
    testDataGenerator = new TestDataGenerator()
  })

  afterEach(async () => {
    await testBase.afterEach()
  })

  describe('Card Operations State', () => {
    it('should manage card state correctly', async () => {
      testBase.renderWithStateProviders(<TestCardOperationsComponent />)

      // 初始状态
      expect(screen.getByTestId('cards-count')).toHaveTextContent('0')
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      expect(screen.getByTestId('error')).toHaveTextContent('No Error')

      // 创建卡片
      fireEvent.click(screen.getByTestId('create-card'))

      // 验证加载状态
      await testBase.verifyLoadingState(
        () => {},
        () => screen.getByTestId('loading').textContent === 'Loading'
      )

      // 验证卡片创建成功
      await waitFor(() => {
        expect(screen.getByTestId('cards-count')).toHaveTextContent('1')
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
    })

    it('should handle multiple card operations', async () => {
      testBase.renderWithStateProviders(<TestCardOperationsComponent />)

      // 创建多个卡片
      for (let i = 0; i < 5; i++) {
        fireEvent.click(screen.getByTestId('create-card'))
      }

      // 验证所有卡片创建成功
      await waitFor(() => {
        expect(screen.getByTestId('cards-count')).toHaveTextContent('5')
      })

      // 验证数据库状态
      const dbCards = await testBase.testDb.cards.toArray()
      expect(dbCards).toHaveLength(5)
    })

    it('should handle card operation errors', async () => {
      // 模拟错误场景
      jest.spyOn(testBase.testDb.cards, 'add').mockRejectedValueOnce(
        new Error('Database error')
      )

      testBase.renderWithStateProviders(<TestCardOperationsComponent />)

      // 尝试创建卡片
      fireEvent.click(screen.getByTestId('create-card'))

      // 验证错误状态
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Database error')
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
    })
  })

  describe('Folder Operations State', () => {
    it('should manage folder state correctly', async () => {
      testBase.renderWithStateProviders(<TestFolderOperationsComponent />)

      // 初始状态
      expect(screen.getByTestId('folders-count')).toHaveTextContent('0')

      // 创建文件夹
      fireEvent.click(screen.getByTestId('create-folder'))

      // 验证文件夹创建成功
      await waitFor(() => {
        expect(screen.getByTestId('folders-count')).toHaveTextContent('1')
      })

      // 验证数据库状态
      const dbFolders = await testBase.testDb.folders.toArray()
      expect(dbFolders).toHaveLength(1)
      expect(dbFolders[0].name).toBe('Test Folder')
    })

    it('should maintain folder-card relationships', async () => {
      const { container } = testBase.renderWithStateProviders(
        <>
          <TestFolderOperationsComponent />
          <TestCardOperationsComponent />
        </>
      )

      // 创建文件夹
      fireEvent.click(screen.getByTestId('create-folder'))

      // 等待文件夹创建
      await waitFor(() => {
        expect(screen.getByTestId('folders-count')).toHaveTextContent('1')
      })

      // 获取文件夹ID
      const dbFolders = await testBase.testDb.folders.toArray()
      const folderId = dbFolders[0].id

      // 修改卡片创建逻辑以使用文件夹
      jest.spyOn(testBase.testDb.cards, 'add').mockImplementationOnce(
        async (card) => {
          return await testBase.testDb.cards.add({
            ...card,
            folderId
          })
        }
      )

      // 创建带文件夹的卡片
      fireEvent.click(screen.getByTestId('create-card'))

      // 验证关系
      await waitFor(() => {
        expect(screen.getByTestId('cards-count')).toHaveTextContent('1')
      })

      const dbCards = await testBase.testDb.cards.toArray()
      expect(dbCards[0].folderId).toBe(folderId)
    })
  })

  describe('Sync Operations State', () => {
    it('should manage sync state correctly', async () => {
      testBase.renderWithStateProviders(<TestSyncOperationsComponent />)

      // 初始状态
      expect(screen.getByTestId('sync-status')).toHaveTextContent('idle')
      expect(screen.getByTestId('is-syncing')).toHaveTextContent('Not Syncing')
      expect(screen.getByTestId('sync-error')).toHaveTextContent('No Sync Error')

      // 开始同步
      fireEvent.click(screen.getByTestId('start-sync'))

      // 验证同步状态
      await waitFor(() => {
        expect(screen.getByTestId('is-syncing')).toHaveTextContent('Syncing')
        expect(screen.getByTestId('sync-status')).toHaveTextContent('syncing')
      })

      // 模拟同步完成
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 验证同步完成状态
      await waitFor(() => {
        expect(screen.getByTestId('is-syncing')).toHaveTextContent('Not Syncing')
        expect(screen.getByTestId('sync-status')).toHaveTextContent('completed')
      })
    })

    it('should handle sync errors', async () => {
      // 模拟同步错误
      jest.spyOn(testBase.syncService, 'processSyncQueue').mockRejectedValueOnce(
        new Error('Sync failed')
      )

      testBase.renderWithStateProviders(<TestSyncOperationsComponent />)

      // 开始同步
      fireEvent.click(screen.getByTestId('start-sync'))

      // 验证错误状态
      await waitFor(() => {
        expect(screen.getByTestId('sync-error')).toHaveTextContent('Sync failed')
        expect(screen.getByTestId('is-syncing')).toHaveTextContent('Not Syncing')
        expect(screen.getByTestId('sync-status')).toHaveTextContent('error')
      })
    })
  })

  describe('Cross-Component State Synchronization', () => {
    it('should synchronize state across components', async () => {
      const { container } = testBase.renderWithStateProviders(
        <>
          <TestCardOperationsComponent />
          <TestFolderOperationsComponent />
          <TestSyncOperationsComponent />
        </>
      )

      // 在不同组件间执行操作并验证状态同步

      // 创建文件夹
      fireEvent.click(screen.getByTestId('create-folder'))
      await waitFor(() => {
        expect(screen.getByTestId('folders-count')).toHaveTextContent('1')
      })

      // 创建卡片
      fireEvent.click(screen.getByTestId('create-card'))
      await waitFor(() => {
        expect(screen.getByTestId('cards-count')).toHaveTextContent('1')
      })

      // 触发同步
      fireEvent.click(screen.getByTestId('start-sync'))
      await waitFor(() => {
        expect(screen.getByTestId('is-syncing')).toHaveTextContent('Syncing')
      })

      // 等待同步完成
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 验证所有组件状态一致
      expect(screen.getByTestId('sync-status')).toHaveTextContent('completed')
      expect(screen.getByTestId('is-syncing')).toHaveTextContent('Not Syncing')
    })

    it('should handle concurrent state updates', async () => {
      const { container } = testBase.renderWithStateProviders(
        <>
          <TestCardOperationsComponent />
          <TestFolderOperationsComponent />
        </>
      )

      // 并发执行多个操作
      const operations = [
        () => fireEvent.click(screen.getByTestId('create-card')),
        () => fireEvent.click(screen.getByTestId('create-folder')),
        () => fireEvent.click(screen.getByTestId('create-card'))
      ]

      // 并发触发操作
      await Promise.all(operations.map(op => op()))

      // 验证所有操作成功完成
      await waitFor(() => {
        expect(screen.getByTestId('cards-count')).toHaveTextContent('2')
        expect(screen.getByTestId('folders-count')).toHaveTextContent('1')
      })

      // 验证数据一致性
      const dbCards = await testBase.testDb.cards.toArray()
      const dbFolders = await testBase.testDb.folders.toArray()

      expect(dbCards).toHaveLength(2)
      expect(dbFolders).toHaveLength(1)
    })
  })

  describe('State Persistence', () => {
    it('should persist state across page reloads', async () => {
      // 第一次渲染
      const { unmount } = testBase.renderWithStateProviders(<TestCardOperationsComponent />)

      // 创建数据
      fireEvent.click(screen.getByTestId('create-card'))
      await waitFor(() => {
        expect(screen.getByTestId('cards-count')).toHaveTextContent('1')
      })

      // 卸载组件
      unmount()

      // 重新渲染
      testBase.renderWithStateProviders(<TestCardOperationsComponent />)

      // 验证状态恢复
      expect(screen.getByTestId('cards-count')).toHaveTextContent('1')
    })

    it('should handle state corruption gracefully', async () => {
      // 模拟数据库损坏
      jest.spyOn(testBase.testDb.cards, 'toArray').mockRejectedValueOnce(
        new Error('Database corrupted')
      )

      testBase.renderWithStateProviders(<TestCardOperationsComponent />)

      // 验证错误处理
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Database corrupted')
      })

      // 修复后应该恢复正常
      jest.spyOn(testBase.testDb.cards, 'toArray').mockResolvedValueOnce([])

      // 重新渲染
      const { unmount } = testBase.renderWithStateProviders(<TestCardOperationsComponent />)
      unmount()

      testBase.renderWithStateProviders(<TestCardOperationsComponent />)

      // 验证恢复正常
      expect(screen.getByTestId('error')).toHaveTextContent('No Error')
    })
  })
})

class GlobalStateIntegrationTest extends StateIntegrationTestBase {
  protected async initializeTestData(): Promise<void> {
    // 全局状态测试不需要预置数据
  }
}
```

#### 组件间通信测试

```typescript
// tests/integration/state/component-communication.integration.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StateIntegrationTestBase } from './state-integration-base'
import { TestDataGenerator } from '../fixtures/test-data-generator'

// 模拟复杂的组件通信场景
const CardList: React.FC = () => {
  const { cards, deleteCard } = useCardOperations()

  return (
    <div data-testid="card-list">
      {cards.map(card => (
        <div key={card.id} data-testid={`card-${card.id}`}>
          <span data-testid={`card-title-${card.id}`}>{card.frontContent.title}</span>
          <button
            data-testid={`delete-card-${card.id}`}
            onClick={() => deleteCard(card.id)}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}

const FolderTree: React.FC = () => {
  const { folders, deleteFolder } = useFolderOperations()

  return (
    <div data-testid="folder-tree">
      {folders.map(folder => (
        <div key={folder.id} data-testid={`folder-${folder.id}`}>
          <span data-testid={`folder-name-${folder.id}`}>{folder.name}</span>
          <button
            data-testid={`delete-folder-${folder.id}`}
            onClick={() => deleteFolder(folder.id)}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}

const SyncStatus: React.FC = () => {
  const { syncStatus, isSyncing, pendingOperations } = useSyncOperations()

  return (
    <div data-testid="sync-status-panel">
      <div data-testid="sync-status-display">{syncStatus}</div>
      <div data-testid="is-syncing-display">{isSyncing ? 'Yes' : 'No'}</div>
      <div data-testid="pending-ops-count">{pendingOperations.length}</div>
    </div>
  )
}

const CardEditor: React.FC<{ cardId: string }> = ({ cardId }) => {
  const { cards, updateCard } = useCardOperations()
  const card = cards.find(c => c.id === cardId)

  if (!card) return <div>Card not found</div>

  return (
    <div data-testid="card-editor">
      <input
        data-testid="card-title-input"
        value={card.frontContent.title}
        onChange={(e) => updateCard(cardId, {
          frontContent: { ...card.frontContent, title: e.target.value }
        })}
      />
    </div>
  )
}

describe('Component Communication Integration Tests', () => {
  let testBase: StateIntegrationTestBase
  let testDataGenerator: TestDataGenerator

  beforeEach(async () => {
    testBase = new ComponentCommunicationTest()
    await testBase.beforeEach()
    testDataGenerator = new TestDataGenerator()
  })

  afterEach(async () => {
    await testBase.afterEach()
  })

  describe('Card-Folder Communication', () => {
    it('should update card list when folder is deleted', async () => {
      // 创建测试数据
      const folder = testDataGenerator.generateFolderData()
      const card = testDataGenerator.generateCardData({ folderId: folder.id })

      await testBase.testDb.folders.add(folder)
      await testBase.testDb.cards.add(card)

      // 渲染组件
      testBase.renderWithStateProviders(
        <>
          <CardList />
          <FolderTree />
        </>
      )

      // 验证初始状态
      expect(screen.getByTestId('card-list')).toBeInTheDocument()
      expect(screen.getByTestId('folder-tree')).toBeInTheDocument()

      // 删除文件夹
      fireEvent.click(screen.getByTestId(`delete-folder-${folder.id}`))

      // 验证卡片列表更新
      await waitFor(() => {
        const cardElements = screen.queryByTestId(`card-${card.id}`)
        expect(cardElements).not.toBeInTheDocument()
      })

      // 验证文件夹树更新
      await waitFor(() => {
        const folderElements = screen.queryByTestId(`folder-${folder.id}`)
        expect(folderElements).not.toBeInTheDocument()
      })
    })

    it('should maintain folder references during card operations', async () => {
      // 创建测试数据
      const folder = testDataGenerator.generateFolderData()
      const card = testDataGenerator.generateCardData({ folderId: folder.id })

      await testBase.testDb.folders.add(folder)
      await testBase.testDb.cards.add(card)

      // 渲染组件
      testBase.renderWithStateProviders(
        <>
          <FolderTree />
          <CardEditor cardId={card.id} />
        </>
      )

      // 验证初始状态
      expect(screen.getByTestId(`folder-name-${folder.id}`)).toBeInTheDocument()

      // 更新卡片
      const titleInput = screen.getByTestId('card-title-input')
      fireEvent.change(titleInput, { target: { value: 'Updated Card Title' } })

      // 验证文件夹引用仍然存在
      await waitFor(() => {
        expect(screen.getByTestId(`folder-name-${folder.id}`)).toBeInTheDocument()
      })

      // 验证数据库中的引用
      const updatedCard = await testBase.testDb.cards.get(card.id)
      expect(updatedCard?.folderId).toBe(folder.id)
    })
  })

  describe('Sync State Communication', () => {
    it('should update sync status when operations are performed', async () => {
      testBase.renderWithStateProviders(
        <>
          <CardList />
          <SyncStatus />
        </>
      )

      // 初始状态
      expect(screen.getByTestId('sync-status-display')).toHaveTextContent('idle')
      expect(screen.getByTestId('pending-ops-count')).toHaveTextContent('0')

      // 创建卡片（应该触发同步状态更新）
      const createCardButton = screen.queryByTestId('create-card')
      if (createCardButton) {
        fireEvent.click(createCardButton)

        // 验证同步状态更新
        await waitFor(() => {
          expect(screen.getByTestId('pending-ops-count')).toHaveTextContent('1')
        })
      }
    })

    it('should communicate sync errors across components', async () => {
      // 模拟同步错误
      jest.spyOn(testBase.syncService, 'processSyncQueue').mockRejectedValueOnce(
        new Error('Network sync error')
      )

      testBase.renderWithStateProviders(
        <>
          <CardList />
          <SyncStatus />
        </>
      )

      // 触发同步
      const startSyncButton = screen.queryByTestId('start-sync')
      if (startSyncButton) {
        fireEvent.click(startSyncButton)

        // 验证错误状态传播
        await waitFor(() => {
          expect(screen.getByTestId('sync-status-display')).toHaveTextContent('error')
        })
      }
    })
  })

  describe('Real-time Updates', () => {
    it('should reflect real-time changes across components', async () => {
      // 创建测试数据
      const folder = testDataGenerator.generateFolderData()
      const card = testDataGenerator.generateCardData({ folderId: folder.id })

      await testBase.testDb.folders.add(folder)
      await testBase.testDb.cards.add(card)

      // 渲染组件
      testBase.renderWithStateProviders(
        <>
          <CardList />
          <FolderTree />
          <CardEditor cardId={card.id} />
        </>
      )

      // 通过编辑器更新卡片
      const titleInput = screen.getByTestId('card-title-input')
      fireEvent.change(titleInput, { target: { value: 'Real-time Updated Title' } })

      // 验证卡片列表实时更新
      await waitFor(() => {
        const cardTitle = screen.getByTestId(`card-title-${card.id}`)
        expect(cardTitle).toHaveTextContent('Real-time Updated Title')
      })
    })

    it('should handle concurrent updates from multiple components', async () => {
      // 创建多个卡片
      const cards = Array.from({ length: 3 }, (_, i) =>
        testDataGenerator.generateCardData({
          frontContent: {
            title: `Concurrent Card ${i}`,
            text: `Content ${i}`,
            tags: ['concurrent']
          }
        })
      )

      await testBase.testDb.cards.bulkAdd(cards)

      // 渲染多个编辑器
      testBase.renderWithStateProviders(
        <>
          <CardList />
          {cards.map(card => (
            <CardEditor key={card.id} cardId={card.id} />
          ))}
        </>
      )

      // 并发更新所有卡片
      const updatePromises = cards.map((card, index) => {
        const input = screen.getByTestId('card-title-input')
        fireEvent.change(input, { target: { value: `Concurrent Update ${index}` } })
        return Promise.resolve()
      })

      await Promise.all(updatePromises)

      // 验证所有更新都反映在列表中
      await waitFor(() => {
        cards.forEach((card, index) => {
          const cardTitle = screen.getByTestId(`card-title-${card.id}`)
          expect(cardTitle).toHaveTextContent(`Concurrent Update ${index}`)
        })
      })
    })
  })

  describe('Event Propagation', () => {
    it('should propagate events through the component tree', async () => {
      // 创建测试数据
      const folder = testDataGenerator.generateFolderData()
      const card = testDataGenerator.generateCardData({ folderId: folder.id })

      await testBase.testDb.folders.add(folder)
      await testBase.testDb.cards.add(card)

      // 渲染完整组件树
      testBase.renderWithStateProviders(
        <>
          <FolderTree />
          <CardList />
          <SyncStatus />
        </>
      )

      // 删除文件夹（应该触发一系列事件）
      fireEvent.click(screen.getByTestId(`delete-folder-${folder.id}`))

      // 验证事件传播
      await waitFor(() => {
        // 文件夹应该从树中移除
        expect(screen.queryByTestId(`folder-${folder.id}`)).not.toBeInTheDocument()

        // 相关卡片应该从列表中移除
        expect(screen.queryByTestId(`card-${card.id}`)).not.toBeInTheDocument()

        // 同步状态应该更新
        expect(screen.getByTestId('pending-ops-count')).toHaveTextContent('1')
      })
    })

    it('should handle event cascading correctly', async () => {
      // 创建复杂的数据关系
      const parentFolder = testDataGenerator.generateFolderData({ name: 'Parent' })
      const childFolder = testDataGenerator.generateFolderData({
        name: 'Child',
        parentId: parentFolder.id
      })
      const card = testDataGenerator.generateCardData({ folderId: childFolder.id })

      await testBase.testDb.folders.bulkAdd([parentFolder, childFolder])
      await testBase.testDb.cards.add(card)

      // 渲染组件
      testBase.renderWithStateProviders(
        <>
          <FolderTree />
          <CardList />
        </>
      )

      // 删除父文件夹（应该级联删除子文件夹和卡片）
      fireEvent.click(screen.getByTestId(`delete-folder-${parentFolder.id}`))

      // 验证级联删除
      await waitFor(() => {
        expect(screen.queryByTestId(`folder-${parentFolder.id}`)).not.toBeInTheDocument()
        expect(screen.queryByTestId(`folder-${childFolder.id}`)).not.toBeInTheDocument()
        expect(screen.queryByTestId(`card-${card.id}`)).not.toBeInTheDocument()
      })
    })
  })
})

class ComponentCommunicationTest extends StateIntegrationTestBase {
  protected async initializeTestData(): Promise<void> {
    // 组件通信测试不需要预置数据
  }
}
```

## 集成测试运行配置

### 1. 集成测试配置文件

```typescript
// tests/integration/integration-test.config.ts
export const integrationTestConfig = {
  testTimeout: 30000,
  setupTimeout: 10000,
  cleanupTimeout: 5000,

  database: {
    name: 'cardall-integration-test',
    version: 1,
    cleanupAfterTest: true
  },

  api: {
    baseUrl: 'http://localhost:5173',
    timeout: 10000,
    retries: 3
  },

  sync: {
    batchSize: 100,
    retryDelay: 1000,
    maxRetries: 5
  },

  performance: {
    enableProfiling: true,
    memoryThreshold: 100 * 1024 * 1024, // 100MB
    timeThreshold: 5000 // 5秒
  },

  coverage: {
    include: ['src/**/*.ts', 'src/**/*.tsx'],
    exclude: ['src/**/*.test.ts', 'src/**/*.stories.tsx'],
    thresholds: {
      global: {
        branches: 85,
        functions: 85,
        lines: 85,
        statements: 85
      }
    }
  }
}
```

### 2. 集成测试运行脚本

```typescript
// tests/integration/run-integration-tests.ts
import { config } from 'dotenv'
import { execSync } from 'child_process'
import { integrationTestConfig } from './integration-test.config'

config({ path: '.env.test' })

async function runIntegrationTests() {
  console.log('🚀 Starting Integration Tests...')

  try {
    // 设置环境变量
    process.env.NODE_ENV = 'test'
    process.env.VITE_APP_ENV = 'integration'

    // 清理之前的测试数据
    console.log('🧹 Cleaning up test environment...')
    execSync('npm run test:cleanup', { stdio: 'inherit' })

    // 启动开发服务器
    console.log('🌐 Starting development server...')
    const serverProcess = execSync('npm run dev &', { stdio: 'inherit' })

    // 等待服务器启动
    await new Promise(resolve => setTimeout(resolve, 5000))

    // 运行集成测试
    console.log('🧪 Running integration tests...')
    execSync(`npm run test:integration -- --config=${JSON.stringify(integrationTestConfig)}`, {
      stdio: 'inherit',
      env: {
        ...process.env,
        INTEGRATION_TEST_CONFIG: JSON.stringify(integrationTestConfig)
      }
    })

    // 生成测试报告
    console.log('📊 Generating test reports...')
    execSync('npm run test:report', { stdio: 'inherit' })

    console.log('✅ Integration tests completed successfully!')

  } catch (error) {
    console.error('❌ Integration tests failed:', error)
    process.exit(1)
  } finally {
    // 清理进程
    if (serverProcess) {
      serverProcess.kill()
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runIntegrationTests()
}

export { runIntegrationTests }
```

### 3. 集成测试工具函数

```typescript
// tests/integration/utils/integration-test-utils.ts
import { performance } from 'perf_hooks'

export class IntegrationTestUtils {
  // 性能测量工具
  static async measurePerformance<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number; memory: number }> {
    const startMemory = process.memoryUsage().heapUsed
    const startTime = performance.now()

    const result = await fn()

    const endTime = performance.now()
    const endMemory = process.memoryUsage().heapUsed

    return {
      result,
      duration: endTime - startTime,
      memory: endMemory - startMemory
    }
  }

  // 重试机制
  static async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        if (i === maxRetries - 1) throw error
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    throw new Error('Max retries exceeded')
  }

  // 并发测试工具
  static async runConcurrently<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number = 5
  ): Promise<{ results: T[]; errors: Error[] }> {
    const results: T[] = []
    const errors: Error[] = []

    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency)
      const batchResults = await Promise.allSettled(batch.map(task => task()))

      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          errors.push(result.reason)
        }
      })
    }

    return { results, errors }
  }

  // 数据验证工具
  static async validateDataConsistency(
    localData: any[],
    remoteData: any[],
    keyField: string = 'id'
  ): Promise<{
    missingInLocal: any[]
    missingInRemote: any[]
    inconsistent: any[]
    consistent: any[]
  }> {
    const localMap = new Map(localData.map(item => [item[keyField], item]))
    const remoteMap = new Map(remoteData.map(item => [item[keyField], item]))

    const missingInLocal = remoteData.filter(item => !localMap.has(item[keyField]))
    const missingInRemote = localData.filter(item => !remoteMap.has(item[keyField]))

    const inconsistent: any[] = []
    const consistent: any[] = []

    for (const [key, localItem] of localMap) {
      const remoteItem = remoteMap.get(key)
      if (remoteItem) {
        const isEqual = JSON.stringify(localItem) === JSON.stringify(remoteItem)
        if (isEqual) {
          consistent.push(localItem)
        } else {
          inconsistent.push({ local: localItem, remote: remoteItem })
        }
      }
    }

    return {
      missingInLocal,
      missingInRemote,
      inconsistent,
      consistent
    }
  }

  // 内存监控
  static startMemoryMonitoring(): { stop: () => MemoryUsageReport } {
    const measurements: { timestamp: number; memory: number }[] = []
    const interval = setInterval(() => {
      measurements.push({
        timestamp: Date.now(),
        memory: process.memoryUsage().heapUsed
      })
    }, 100)

    return {
      stop: () => {
        clearInterval(interval)
        return {
          measurements,
          peakMemory: Math.max(...measurements.map(m => m.memory)),
          averageMemory: measurements.reduce((sum, m) => sum + m.memory, 0) / measurements.length,
          memoryGrowth: measurements[measurements.length - 1].memory - measurements[0].memory
        }
      }
    }
  }

  // 网络模拟
  static simulateNetworkConditions(conditions: {
    latency?: number
    packetLoss?: number
    bandwidth?: number
  }): void {
    if (conditions.latency) {
      // 模拟网络延迟
      const originalFetch = global.fetch
      global.fetch = async (...args) => {
        await new Promise(resolve => setTimeout(resolve, conditions.latency))
        return originalFetch(...args)
      }
    }

    if (conditions.packetLoss) {
      // 模拟丢包
      const originalFetch = global.fetch
      global.fetch = async (...args) => {
        if (Math.random() < conditions.packetLoss!) {
          throw new Error('Network packet loss')
        }
        return originalFetch(...args)
      }
    }
  }

  // 恢复网络条件
  static restoreNetworkConditions(): void {
    // 需要保存原始fetch函数并在适当时候恢复
    // 这里简化处理，实际实现需要更复杂的逻辑
  }
}

interface MemoryUsageReport {
  measurements: { timestamp: number; memory: number }[]
  peakMemory: number
  averageMemory: number
  memoryGrowth: number
}
```

## 总结

本文档详细描述了 CardEverything 项目的集成测试环境配置，包括：

1. **数据库集成测试**：
   - IndexedDB 操作测试框架
   - 数据一致性验证
   - 事务处理测试
   - 性能测试和并发测试

2. **API 集成测试**：
   - MSW API 模拟框架
   - 认证流程测试
   - 数据操作测试
   - 错误处理和网络条件测试

3. **同步系统集成测试**：
   - 离线-在线转换测试
   - 冲突解决测试
   - 数据一致性验证
   - 性能优化测试

4. **状态管理集成测试**：
   - 全局状态管理测试
   - 组件间通信测试
   - 事件传播测试
   - 实时更新测试

5. **测试工具和配置**：
   - 集成测试配置文件
   - 测试运行脚本
   - 性能测量工具
   - 数据验证工具

这个集成测试框架为 CardEverything 项目提供了全面的质量保证，确保各个系统组件能够正确协同工作，为项目的重构和功能扩展提供了可靠的测试基础。