/**
 * 测试工具函数库
 * 提供常用的测试辅助函数和模拟对象
 */

import { jest } from '@jest/globals'

// ============================================================================
// 模拟对象生成器
// ============================================================================

export const mockFactories = {
  /**
   * 生成模拟卡片数据
   */
  createMockCard(overrides: Partial<any> = {}) {
    return {
      id: crypto.randomUUID(),
      frontContent: {
        title: 'Test Card Front',
        text: 'This is test content',
        tags: ['test', 'card']
      },
      backContent: {
        title: 'Test Card Back',
        text: 'Back content test',
        tags: ['back', 'test']
      },
      style: {
        type: 'solid' as const,
        colors: ['#ffffff']
      },
      folderId: crypto.randomUUID(),
      userId: 'test-user-id',
      syncVersion: 1,
      pendingSync: false,
      updatedAt: new Date(),
      createdAt: new Date(),
      ...overrides
    }
  },

  /**
   * 生成模拟文件夹数据
   */
  createMockFolder(overrides: Partial<any> = {}) {
    return {
      id: crypto.randomUUID(),
      name: 'Test Folder',
      path: '/test/folder',
      parentId: null,
      userId: 'test-user-id',
      syncVersion: 1,
      pendingSync: false,
      updatedAt: new Date(),
      createdAt: new Date(),
      ...overrides
    }
  },

  /**
   * 生成模拟标签数据
   */
  createMockTag(overrides: Partial<any> = {}) {
    return {
      id: crypto.randomUUID(),
      name: 'Test Tag',
      color: '#3b82f6',
      count: 1,
      userId: 'test-user-id',
      syncVersion: 1,
      pendingSync: false,
      updatedAt: new Date(),
      createdAt: new Date(),
      ...overrides
    }
  },

  /**
   * 生成模拟图片数据
   */
  createMockImage(overrides: Partial<any> = {}) {
    return {
      id: crypto.randomUUID(),
      cardId: crypto.randomUUID(),
      userId: 'test-user-id',
      fileName: 'test-image.jpg',
      filePath: '/images/test-image.jpg',
      thumbnailPath: '/images/test-image-thumb.jpg',
      metadata: {
        originalName: 'test-image.jpg',
        size: 1024 * 100, // 100KB
        width: 800,
        height: 600,
        format: 'jpeg',
        compressed: true,
        quality: 80
      },
      storageMode: 'indexeddb' as const,
      syncVersion: 1,
      pendingSync: false,
      updatedAt: new Date(),
      createdAt: new Date(),
      ...overrides
    }
  },

  /**
   * 生成同步操作数据
   */
  createMockSyncOperation(overrides: Partial<any> = {}) {
    return {
      id: crypto.randomUUID(),
      type: 'create' as const,
      entity: 'card' as const,
      entityId: crypto.randomUUID(),
      userId: 'test-user-id',
      data: {},
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 5,
      priority: 'normal' as const,
      status: 'pending' as const,
      ...overrides
    }
  }
}

// ============================================================================
// 数据库模拟工具
// ============================================================================

export class MockDatabase {
  private stores = new Map<string, Map<string, any>>()
  private transactionStack: Set<string> = new Set()

  constructor() {
    // 初始化表
    this.initializeTables()
  }

  private initializeTables() {
    const tables = ['cards', 'folders', 'tags', 'images', 'syncQueue']
    tables.forEach(table => {
      this.stores.set(table, new Map())
    })
  }

  // 模拟表操作
  table(tableName: string) {
    return new MockTable(this.stores.get(tableName) || new Map(), tableName)
  }

  // 模拟事务
  async transaction(mode: string, tables: string[], callback: () => Promise<void>): Promise<void> {
    const transactionKey = `tx_${Date.now()}_${Math.random()}`
    this.transactionStack.add(transactionKey)

    try {
      await callback()
    } finally {
      this.transactionStack.delete(transactionKey)
    }
  }

  // 模拟打开数据库
  async open(): Promise<void> {
    // 模拟数据库打开
  }

  // 模拟关闭数据库
  async close(): Promise<void> {
    // 模拟数据库关闭
  }

  // 清空所有数据
  clear(): void {
    this.stores.forEach(store => store.clear())
  }

  // 获取所有表名
  getTableNames(): string[] {
    return Array.from(this.stores.keys())
  }
}

class MockTable {
  constructor(private store: Map<string, any>, private tableName: string) {}

  async add(data: any): Promise<string> {
    const id = data.id || crypto.randomUUID()
    this.store.set(id, { ...data, id })
    return id
  }

  async bulkAdd(dataArray: any[]): Promise<string[]> {
    const ids = dataArray.map(data => data.id || crypto.randomUUID())
    dataArray.forEach((data, index) => {
      this.store.set(ids[index], { ...data, id: ids[index] })
    })
    return ids
  }

  async get(id: string): Promise<any | undefined> {
    return this.store.get(id)
  }

  async update(id: string, changes: any): Promise<number> {
    const existing = this.store.get(id)
    if (existing) {
      this.store.set(id, { ...existing, ...changes })
      return 1
    }
    return 0
  }

  async delete(id: string): Promise<number> {
    const deleted = this.store.delete(id)
    return deleted ? 1 : 0
  }

  async clear(): Promise<void> {
    this.store.clear()
  }

  async count(): Promise<number> {
    return this.store.size
  }

  async toArray(): Promise<any[]> {
    return Array.from(this.store.values())
  }

  where(fieldName: string) {
    return new MockCollection(this.store, fieldName)
  }

  orderBy(fieldName: string) {
    return new MockCollection(this.store, null, fieldName)
  }

  reverse() {
    return new MockCollection(this.store, null, null, true)
  }

  limit(count: number) {
    return new MockCollection(this.store, null, null, false, count)
  }

  offset(offset: number) {
    return new MockCollection(this.store, null, null, false, undefined, offset)
  }

  filter(predicate: (item: any) => boolean) {
    return new MockCollection(this.store, null, null, false, undefined, undefined, predicate)
  }

  sortBy(fieldName: string) {
    return new MockCollection(this.store, null, fieldName)
  }
}

class MockCollection {
  private filteredData: any[] = []

  constructor(
    private store: Map<string, any>,
    private whereField?: string | null,
    private orderByField?: string | null,
    private reverseOrder = false,
    private limitCount?: number,
    private offsetValue?: number,
    private filterPredicate?: (item: any) => boolean
  ) {
    this.buildQuery()
  }

  private buildQuery() {
    let data = Array.from(this.store.values())

    // 应用过滤
    if (this.filterPredicate) {
      data = data.filter(this.filterPredicate)
    }

    // 应用排序
    if (this.orderByField) {
      data.sort((a, b) => {
        const aVal = this.getNestedValue(a, this.orderByField!)
        const bVal = this.getNestedValue(b, this.orderByField!)
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      })
    }

    if (this.reverseOrder) {
      data.reverse()
    }

    // 应用分页
    if (this.offsetValue) {
      data = data.slice(this.offsetValue)
    }

    if (this.limitCount) {
      data = data.slice(0, this.limitCount)
    }

    this.filteredData = data
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  equals(value: any): MockCollection {
    if (this.whereField) {
      this.filteredData = this.filteredData.filter(item => {
        const fieldValue = this.getNestedValue(item, this.whereField!)
        return fieldValue === value
      })
    }
    return this
  }

  async toArray(): Promise<any[]> {
    return this.filteredData
  }

  async count(): Promise<number> {
    return this.filteredData.length
  }

  async first(): Promise<any | undefined> {
    return this.filteredData[0]
  }

  async last(): Promise<any | undefined> {
    return this.filteredData[this.filteredData.length - 1]
  }
}

// ============================================================================
// 性能测试工具
// ============================================================================

export class PerformanceTester {
  private measurements: Map<string, number[]> = new Map()

  async measure<T>(name: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = performance.now()
    const result = await fn()
    const duration = performance.now() - startTime

    this.recordMeasurement(name, duration)
    return { result, duration }
  }

  measureSync<T>(name: string, fn: () => T): { result: T; duration: number } {
    const startTime = performance.now()
    const result = fn()
    const duration = performance.now() - startTime

    this.recordMeasurement(name, duration)
    return { result, duration }
  }

  private recordMeasurement(name: string, duration: number): void {
    if (!this.measurements.has(name)) {
      this.measurements.set(name, [])
    }
    this.measurements.get(name)!.push(duration)
  }

  getStats(name: string) {
    const measurements = this.measurements.get(name) || []
    if (measurements.length === 0) return null

    const sorted = [...measurements].sort((a, b) => a - b)
    const sum = measurements.reduce((acc, val) => acc + val, 0)
    
    return {
      count: measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      avg: sum / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    }
  }

  getAllStats() {
    const stats: Record<string, any> = {}
    for (const [name] of this.measurements) {
      stats[name] = this.getStats(name)
    }
    return stats
  }

  reset(): void {
    this.measurements.clear()
  }
}

// ============================================================================
// 内存泄漏检测工具
// ============================================================================

export class MemoryLeakDetector {
  private snapshots: Map<string, number> = new Map()
  private baseline: number = 0

  async takeSnapshot(name: string): Promise<void> {
    // 模拟内存使用量
    const memoryUsage = this.simulateMemoryUsage()
    this.snapshots.set(name, memoryUsage)
  }

  compareSnapshots(name1: string, name2: string): number {
    const mem1 = this.snapshots.get(name1) || 0
    const mem2 = this.snapshots.get(name2) || 0
    return mem2 - mem1
  }

  setBaseline(): void {
    this.baseline = this.simulateMemoryUsage()
  }

  getMemoryGrowthSinceBaseline(): number {
    const current = this.simulateMemoryUsage()
    return current - this.baseline
  }

  private simulateMemoryUsage(): number {
    // 模拟内存使用量（MB）
    return Math.random() * 100 + 50
  }

  detectLeaks(thresholdMB: number = 10): string[] {
    const leaks: string[] = []
    const current = this.simulateMemoryUsage()
    const growth = current - this.baseline

    if (growth > thresholdMB) {
      leaks.push(`内存增长 ${growth.toFixed(2)}MB 超过阈值 ${thresholdMB}MB`)
    }

    return leaks
  }

  clearSnapshots(): void {
    this.snapshots.clear()
    this.baseline = 0
  }
}

// ============================================================================
// 异步测试工具
// ============================================================================

export class AsyncTestHelper {
  static async waitFor<T>(
    condition: () => T | Promise<T>,
    options: {
      timeout?: number
      interval?: number
      message?: string
    } = {}
  ): Promise<T> {
    const { timeout = 5000, interval = 100, message = '条件超时' } = options
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      try {
        const result = await condition()
        if (result) {
          return result
        }
      } catch (error) {
        // 忽略错误，继续等待
      }
      await this.delay(interval)
    }

    throw new Error(`${message}: 等待 ${timeout}ms 后超时`)
  }

  static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  static async retry<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number
      delay?: number
      backoff?: boolean
    } = {}
  ): Promise<T> {
    const { maxRetries = 3, delay = 1000, backoff = true } = options
    let lastError: Error

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        if (i < maxRetries) {
          const waitTime = backoff ? delay * Math.pow(2, i) : delay
          await this.delay(waitTime)
        }
      }
    }

    throw lastError!
  }
}

// ============================================================================
// 断言扩展
// ============================================================================

export const customMatchers = {
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true
      }
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false
      }
    }
  },

  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const pass = uuidRegex.test(received)
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true
      }
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false
      }
    }
  },

  toHavePerformance(received: any, thresholds: { maxDuration?: number; minSuccessRate?: number }) {
    const { maxDuration, minSuccessRate } = thresholds
    const errors: string[] = []

    if (maxDuration && received.averageResponseTime > maxDuration) {
      errors.push(`平均响应时间 ${received.averageResponseTime}ms 超过阈值 ${maxDuration}ms`)
    }

    if (minSuccessRate && received.successRate < minSuccessRate) {
      errors.push(`成功率 ${received.successRate} 低于阈值 ${minSuccessRate}`)
    }

    if (errors.length === 0) {
      return {
        message: () => `expected performance not to meet thresholds`,
        pass: true
      }
    } else {
      return {
        message: () => `performance issues: ${errors.join(', ')}`,
        pass: false
      }
    }
  }
}

// 注册自定义断言
expect.extend(customMatchers)

// ============================================================================
// Mock 函数生成器
// ============================================================================

export const mockGenerators = {
  createSupabaseClient() {
    return {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          data: [],
          error: null
        }),
        insert: jest.fn().mockReturnValue({
          data: null,
          error: null
        }),
        update: jest.fn().mockReturnValue({
          data: null,
          error: null
        }),
        delete: jest.fn().mockReturnValue({
          error: null
        })
      }),
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        signUp: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        signIn: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signOut: jest.fn().mockResolvedValue({ error: null })
      }
    }
  },

  createDexieInstance() {
    const mockDb = new MockDatabase()
    return mockDb
  }
}

// ============================================================================
// 测试数据生成器
// ============================================================================

export const testDataGenerator = {
  /**
   * 生成测试数据集
   */
  generateTestData(config: {
    cardCount?: number
    folderCount?: number
    tagCount?: number
    imageCount?: number
  } = {}) {
    const { cardCount = 10, folderCount = 3, tagCount = 5, imageCount = 5 } = config

    const cards = Array.from({ length: cardCount }, (_, i) =>
      mockFactories.createMockCard({ frontContent: { title: `Card ${i + 1}` } })
    )

    const folders = Array.from({ length: folderCount }, (_, i) =>
      mockFactories.createMockFolder({ name: `Folder ${i + 1}` })
    )

    const tags = Array.from({ length: tagCount }, (_, i) =>
      mockFactories.createMockTag({ name: `Tag ${i + 1}` })
    )

    const images = Array.from({ length: imageCount }, (_, i) =>
      mockFactories.createMockImage({ fileName: `image${i + 1}.jpg` })
    )

    return { cards, folders, tags, images }
  },

  /**
   * 生成大规模测试数据
   */
  generateLargeDataset(size: number = 1000) {
    return Array.from({ length: size }, (_, i) =>
      mockFactories.createMockCard({
        frontContent: {
          title: `Large Dataset Card ${i + 1}`,
          text: `This is card number ${i + 1} in a large dataset`,
          tags: [`batch-${Math.floor(i / 100)}`, `large-dataset`]
        }
      })
    )
  }
}

// ============================================================================
// 导出工具实例
// ============================================================================

export const performanceTester = new PerformanceTester()
export const memoryLeakDetector = new MemoryLeakDetector()
export const asyncTestHelper = AsyncTestHelper