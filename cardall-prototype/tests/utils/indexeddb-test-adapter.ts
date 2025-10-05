/**
 * IndexedDB 测试适配器
 * 为 Jest 和 Vitest 提供完整的 IndexedDB API 模拟
 */

import type { DexieOptions } from 'dexie'

// 基础 IndexedDB 模拟实现
class MockIndexedDB {
  private databases = new Map<string, any>()
  private version = 1

  static open(name: string, version?: number): any {
    const mockDB = new MockIndexedDB()
    return mockDB.open(name, version)
  }

  open(name: string, version?: number) {
    const mockRequest = {
      result: this.createMockDatabase(name),
      error: null,
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any
    }

    // 模拟异步打开
    setTimeout(() => {
      if (mockRequest.onsuccess) {
        mockRequest.onsuccess({ target: mockRequest })
      }
    }, 0)

    return mockRequest
  }

  private createMockDatabase(name: string) {
    const db = {
      name,
      version: this.version,
      objectStoreNames: {
        contains: (name: string) => false,
        length: 0
      },
      createObjectStore: (name: string, options?: any) => ({
        name,
        indexNames: { contains: () => false },
        add: () => this.createMockRequest(),
        put: () => this.createMockRequest(),
        get: () => this.createMockRequest(),
        delete: () => this.createMockRequest(),
        clear: () => this.createMockRequest(),
        getAll: () => this.createMockRequest([]),
        count: () => this.createMockRequest(0),
        openCursor: () => this.createMockRequest(null),
        createIndex: () => ({}),
        deleteIndex: () => {}
      }),
      transaction: (storeNames: string | string[], mode?: string) => ({
        objectStore: (name: string) => db.createObjectStore(name),
        oncomplete: null as any,
        onerror: null as any,
        onabort: null as any,
        abort: () => {}
      }),
      close: () => {},
      onversionchange: null as any
    }

    this.databases.set(name, db)
    return db
  }

  private createMockRequest(result?: any) {
    return {
      result,
      error: null,
      onsuccess: null as any,
      onerror: null as any,
      readyState: 'done'
    }
  }
}

// Dexie 模拟适配器
export class MockDexie {
  private tables = new Map<string, MockTable>()
  private isOpen = false

  constructor(name: string, options?: DexieOptions) {
    // 初始化模拟数据库
  }

  version(version: number) {
    return {
      stores: (schema: string) => {
        // 解析并创建表结构
        this.parseSchema(schema)
        return this
      }
    }
  }

  private parseSchema(schema: string) {
    // 简单的表结构解析
    const tables = schema.split(',').map(table => table.trim())

    tables.forEach(tableDef => {
      const [tableName] = tableDef.split('->').map(s => s.trim())
      if (tableName && !this.tables.has(tableName)) {
        this.tables.set(tableName, new MockTable(tableName))
      }
    })
  }

  table<T>(tableName: string): MockTable {
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, new MockTable(tableName))
    }
    return this.tables.get(tableName)!
  }

  async open() {
    // 模拟数据库打开
    await new Promise(resolve => setTimeout(resolve, 10))
    this.isOpen = true
  }

  async close() {
    // 模拟数据库关闭
    this.isOpen = false
  }

  async delete() {
    // 模拟数据库删除
    this.tables.clear()
    this.isOpen = false
  }

  // 事务支持
  async transaction(mode: 'r' | 'rw', ...tables: string[]): Promise<any> {
    return {
      table: (name: string) => this.table(name),
      complete: Promise.resolve(),
      abort: () => {}
    }
  }

  // 获取所有表名
  get tables() {
    return Array.from(this.tables.keys())
  }

  // 清理所有数据
  async clear() {
    for (const table of this.tables.values()) {
      await table.clear()
    }
  }
}

// 模拟表类
class MockTable {
  private data = new Map<string, any>()
  private primaryKey = 'id'

  constructor(name: string) {
    this.name = name
  }

  name: string

  async add(item: any, key?: any) {
    const id = key || this.generateId()
    this.data.set(id, { ...item, [this.primaryKey]: id })
    return id
  }

  async put(item: any, key?: any) {
    const id = key || item[this.primaryKey] || this.generateId()
    this.data.set(id, { ...item, [this.primaryKey]: id })
    return id
  }

  async get(key: any) {
    return this.data.get(key) || undefined
  }

  async delete(key: any) {
    return this.data.delete(key)
  }

  async clear() {
    this.data.clear()
  }

  async toArray() {
    return Array.from(this.data.values())
  }

  async count() {
    return this.data.size
  }

  async where(predicate: any) {
    // 简单的 where 模拟
    return new MockWhereClause(this.data, predicate)
  }

  async orderBy(key: string) {
    // 简单的 order by 模拟
    return new MockCollection(this.data)
  }

  async offset(count: number) {
    // 简单的 offset 模拟
    return new MockCollection(this.data)
  }

  async limit(count: number) {
    // 简单的 limit 模拟
    const items = Array.from(this.data.values()).slice(0, count)
    return new MockCollection(new Map(items.map(item => [item[this.primaryKey], item])))
  }

  private generateId() {
    return crypto.randomUUID()
  }
}

// 模拟 Where 条件
class MockWhereClause {
  constructor(private data: Map<string, any>, private predicate: any) {}

  async equals(value: any) {
    // 简单的等值查询
    const items = Array.from(this.data.values()).filter(item =>
      item[this.predicate] === value
    )
    return new MockCollection(new Map(items.map(item => [item.id, item])))
  }

  async above(value: any) {
    const items = Array.from(this.data.values()).filter(item =>
      item[this.predicate] > value
    )
    return new MockCollection(new Map(items.map(item => [item.id, item])))
  }

  async below(value: any) {
    const items = Array.from(this.data.values()).filter(item =>
      item[this.predicate] < value
    )
    return new MockCollection(new Map(items.map(item => [item.id, item])))
  }

  async between(lower: any, upper: any) {
    const items = Array.from(this.data.values()).filter(item =>
      item[this.predicate] >= lower && item[this.predicate] <= upper
    )
    return new MockCollection(new Map(items.map(item => [item.id, item])))
  }
}

// 模拟集合
class MockCollection {
  constructor(private data: Map<string, any>) {}

  async toArray() {
    return Array.from(this.data.values())
  }

  async count() {
    return this.data.size
  }

  async first() {
    return Array.from(this.data.values())[0]
  }

  async last() {
    const items = Array.from(this.data.values())
    return items[items.length - 1]
  }
}

// 设置全局模拟
const setupJestIndexedDB = (options: {
  enableLogging?: boolean
  simulateLatency?: boolean
  autoCleanup?: boolean
} = {}) => {
  const { enableLogging = false, simulateLatency = false, autoCleanup = true } = options

  // 模拟 indexedDB
  Object.defineProperty(global, 'indexedDB', {
    value: MockIndexedDB,
    writable: true
  })

  // 模拟 IDBKeyRange
  Object.defineProperty(global, 'IDBKeyRange', {
    value: {
      only: (value: any) => ({ only: value }),
      lowerBound: (value: any) => ({ lowerBound: value }),
      upperBound: (value: any) => ({ upperBound: value }),
      bound: (lower: any, upper: any) => ({ lower, upper })
    },
    writable: true
  })

  // 模拟 IDBCursor
  Object.defineProperty(global, 'IDBCursor', {
    value: class MockIDBCursor {
      value: any
      key: any
      direction: string = 'next'

      continue() {
        // 模拟游标继续
      }

      advance(count: number) {
        // 模拟游标前进
      }

      delete() {
        // 模拟删除当前项
      }
    },
    writable: true
  })

  // 模拟 IDBTransaction
  Object.defineProperty(global, 'IDBTransaction', {
    value: {
      READ_ONLY: 'readonly',
      READ_WRITE: 'readwrite',
      VERSION_CHANGE: 'versionchange'
    },
    writable: true
  })

  // 增强模拟 Dexie
  Object.defineProperty(global, 'Dexie', {
    value: MockDexie,
    writable: true
  })

  if (enableLogging) {
    console.log('✅ IndexedDB 模拟环境已设置')
  }

  // 自动清理
  if (autoCleanup) {
    afterEach(() => {
      // 清理测试后的数据
    })
  }

  return {
    MockDexie,
    MockIndexedDB,
    cleanup: () => {
      // 清理方法
    }
  }
}

// 导出设置函数
export { setupJestIndexedDB }

// 导出模拟类
export { MockDexie, MockTable, MockWhereClause, MockCollection }