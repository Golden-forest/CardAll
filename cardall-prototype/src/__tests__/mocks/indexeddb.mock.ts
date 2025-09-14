/**
 * IndexedDB Mock for Testing
 * 提供完整的IndexedDB API模拟用于单元测试
 */

export interface MockIndexedDBEventTarget extends EventTarget {
  result?: any
  error?: any
  transaction?: MockIDBTransaction
}

export interface MockIDBObjectStore {
  name: string
  keyPath: string | string[] | null
  autoIncrement: boolean
  indexNames: DOMStringList

  // 数据操作方法
  add(data: any, key?: any): Promise<IDBRequest>
  put(data: any, key?: any): Promise<IDBRequest>
  delete(key: any): Promise<IDBRequest>
  get(key: any): Promise<IDBRequest>
  getAll(query?: any, count?: number): Promise<IDBRequest>
  clear(): Promise<IDBRequest>

  // 索引方法
  index(name: string): MockIDBIndex
  createIndex(name: string, keyPath: string | string[], options?: IDBIndexParameters): MockIDBIndex
  deleteIndex(name: string): void

  // 游标方法
  openCursor(query?: any, direction?: IDBCursorDirection): Promise<IDBRequest>
}

export interface MockIDBIndex {
  name: string
  objectStore: MockIDBObjectStore
  keyPath: string | string[]
  multiEntry: boolean
  unique: boolean

  get(key: any): Promise<IDBRequest>
  getKey(key: any): Promise<IDBRequest>
  getAll(query?: any, count?: number): Promise<IDBRequest>
  getAllKeys(query?: any, count?: number): Promise<IDBRequest>
  count(query?: any): Promise<IDBRequest>
  openCursor(query?: any, direction?: IDBCursorDirection): Promise<IDBRequest>
  openKeyCursor(query?: any, direction?: IDBCursorDirection): Promise<IDBRequest>
}

export interface MockIDBTransaction {
  db: MockIDBDatabase
  mode: IDBTransactionMode
  objectStoreNames: DOMStringList
  error: DOMException | null
  onabort: ((this: IDBTransaction, ev: Event) => any) | null
  oncomplete: ((this: IDBTransaction, ev: Event) => any) | null
  onerror: ((this: IDBTransaction, ev: Event) => any) | null

  objectStore(name: string): MockIDBObjectStore
  abort(): void
  commit(): void
}

export interface MockIDBDatabase {
  name: string
  version: number
  objectStoreNames: DOMStringList

  createObjectStore(name: string, options?: IDBObjectStoreParameters): MockIDBObjectStore
  deleteObjectStore(name: string): void
  transaction(storeNames: string | string[], mode?: IDBTransactionMode): MockIDBTransaction
  close(): void
}

export interface MockIDBOpenDBRequest extends MockIndexedDBEventTarget {
  source: null
  readyState: IDBRequestReadyState
  onupgradeneeded: ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => any) | null
  onblocked: ((this: IDBOpenDBRequest, ev: Event) => any) | null
}

export interface MockIDBRequest extends MockIndexedDBEventTarget {
  source: any
  readyState: IDBRequestReadyState
  result: any
  error: any
  onsuccess: ((this: IDBRequest, ev: Event) => any) | null
  onerror: ((this: IDBRequest, ev: Event) => any) | null
}

// 模拟实现
class MockIDBObjectStoreImpl implements MockIDBObjectStore {
  private data: Map<any, any> = new Map()
  private indexes: Map<string, MockIDBIndex> = new Map()

  name: string
  keyPath: string | string[] | null
  autoIncrement: boolean
  indexNames: DOMStringList

  constructor(name: string, keyPath: string | string[] | null = null, autoIncrement: boolean = false) {
    this.name = name
    this.keyPath = keyPath
    this.autoIncrement = autoIncrement
    this.indexNames = [] as any
  }

  async add(data: any, key?: any): Promise<IDBRequest> {
    return this._executeOperation(() => {
      const actualKey = key || this._generateKey(data)
      if (this.data.has(actualKey)) {
        throw new DOMException('Key already exists', 'ConstraintError')
      }
      this.data.set(actualKey, data)
      return actualKey
    })
  }

  async put(data: any, key?: any): Promise<IDBRequest> {
    return this._executeOperation(() => {
      const actualKey = key || this._generateKey(data)
      this.data.set(actualKey, data)
      return actualKey
    })
  }

  async delete(key: any): Promise<IDBRequest> {
    return this._executeOperation(() => {
      if (!this.data.has(key)) {
        throw new DOMException('Key not found', 'NotFoundError')
      }
      this.data.delete(key)
      return undefined
    })
  }

  async get(key: any): Promise<IDBRequest> {
    return this._executeOperation(() => {
      return this.data.get(key)
    })
  }

  async getAll(query?: any, count?: number): Promise<IDBRequest> {
    return this._executeOperation(() => {
      let results: any[] = []

      if (query === undefined) {
        results = Array.from(this.data.values())
      } else {
        // 简单的查询处理
        results = Array.from(this.data.values()).filter(item => {
          if (typeof query === 'string') {
            return JSON.stringify(item).includes(query)
          }
          return true
        })
      }

      if (count !== undefined) {
        results = results.slice(0, count)
      }

      return results
    })
  }

  async clear(): Promise<IDBRequest> {
    return this._executeOperation(() => {
      this.data.clear()
      return undefined
    })
  }

  index(name: string): MockIDBIndex {
    const index = this.indexes.get(name)
    if (!index) {
      throw new DOMException('Index not found', 'NotFoundError')
    }
    return index
  }

  createIndex(name: string, keyPath: string | string[], options: IDBIndexParameters = {}): MockIDBIndex {
    const index = new MockIDBIndexImpl(name, this, keyPath, options.multiEntry || false, options.unique || false)
    this.indexes.set(name, index)
    this.indexNames.push(name)
    return index
  }

  deleteIndex(name: string): void {
    this.indexes.delete(name)
    this.indexNames = this.indexNames.filter(n => n !== name) as any
  }

  async openCursor(query?: any, direction?: IDBCursorDirection): Promise<IDBRequest> {
    return this._executeOperation(() => {
      return {
        continue: jest.fn(),
        advance: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      }
    })
  }

  private _generateKey(data: any): any {
    if (this.keyPath) {
      if (typeof this.keyPath === 'string') {
        return data[this.keyPath]
      } else {
        // 处理复合键路径
        return this.keyPath.map(key => data[key])
      }
    }
    return crypto.randomUUID()
  }

  private async _executeOperation(operation: () => any): Promise<any> {
    try {
      const result = operation()
      await new Promise(resolve => setTimeout(resolve, 0)) // 模拟异步操作
      return result
    } catch (error) {
      throw error
    }
  }
}

class MockIDBIndexImpl implements MockIDBIndex {
  name: string
  objectStore: MockIDBObjectStore
  keyPath: string | string[]
  multiEntry: boolean
  unique: boolean

  constructor(name: string, objectStore: MockIDBObjectStore, keyPath: string | string[], multiEntry: boolean, unique: boolean) {
    this.name = name
    this.objectStore = objectStore
    this.keyPath = keyPath
    this.multiEntry = multiEntry
    this.unique = unique
  }

  async get(key: any): Promise<IDBRequest> {
    return this._executeOperation(() => {
      // 简化实现
      return null
    })
  }

  async getKey(key: any): Promise<IDBRequest> {
    return this._executeOperation(() => {
      return null
    })
  }

  async getAll(query?: any, count?: number): Promise<IDBRequest> {
    return this._executeOperation(() => {
      return []
    })
  }

  async getAllKeys(query?: any, count?: number): Promise<IDBRequest> {
    return this._executeOperation(() => {
      return []
    })
  }

  async count(query?: any): Promise<IDBRequest> {
    return this._executeOperation(() => {
      return 0
    })
  }

  async openCursor(query?: any, direction?: IDBCursorDirection): Promise<IDBRequest> {
    return this._executeOperation(() => {
      return null
    })
  }

  async openKeyCursor(query?: any, direction?: IDBCursorDirection): Promise<IDBRequest> {
    return this._executeOperation(() => {
      return null
    })
  }

  private async _executeOperation(operation: () => any): Promise<any> {
    try {
      const result = operation()
      await new Promise(resolve => setTimeout(resolve, 0))
      return result
    } catch (error) {
      throw error
    }
  }
}

class MockIDBDatabaseImpl implements MockIDBDatabase {
  private objectStores: Map<string, MockIDBObjectStore> = new Map()

  name: string
  version: number
  objectStoreNames: DOMStringList

  constructor(name: string, version: number) {
    this.name = name
    this.version = version
    this.objectStoreNames = [] as any
  }

  createObjectStore(name: string, options: IDBObjectStoreParameters = {}): MockIDBObjectStore {
    if (this.objectStores.has(name)) {
      throw new DOMException('Object store already exists', 'ConstraintError')
    }

    const store = new MockIDBObjectStoreImpl(
      name,
      options.keyPath || null,
      options.autoIncrement || false
    )

    this.objectStores.set(name, store)
    this.objectStoreNames.push(name)

    return store
  }

  deleteObjectStore(name: string): void {
    if (!this.objectStores.has(name)) {
      throw new DOMException('Object store not found', 'NotFoundError')
    }

    this.objectStores.delete(name)
    this.objectStoreNames = this.objectStoreNames.filter(n => n !== name) as any
  }

  transaction(storeNames: string | string[], mode: IDBTransactionMode = 'readonly'): MockIDBTransaction {
    const stores = Array.isArray(storeNames) ? storeNames : [storeNames]
    const transaction = new MockIDBTransactionImpl(this, mode, stores)
    return transaction
  }

  close(): void {
    // 清理资源
    this.objectStores.clear()
  }
}

class MockIDBTransactionImpl implements MockIDBTransaction {
  db: MockIDBDatabase
  mode: IDBTransactionMode
  objectStoreNames: DOMStringList
  error: DOMException | null = null
  onabort: ((this: IDBTransaction, ev: Event) => any) | null = null
  oncomplete: ((this: IDBTransaction, ev: Event) => any) | null = null
  onerror: ((this: IDBTransaction, ev: Event) => any) | null = null

  private committed = false
  private aborted = false

  constructor(db: MockIDBDatabase, mode: IDBTransactionMode, storeNames: string[]) {
    this.db = db
    this.mode = mode
    this.objectStoreNames = storeNames as any
  }

  objectStore(name: string): MockIDBObjectStore {
    // 这里应该返回一个在事务上下文中的对象存储
    return (this.db as any).objectStores.get(name)
  }

  abort(): void {
    if (this.committed) {
      throw new DOMException('Transaction already committed', 'InvalidStateError')
    }
    this.aborted = true

    if (this.onabort) {
      this.onabort(new Event('abort'))
    }
  }

  commit(): void {
    if (this.aborted) {
      throw new DOMException('Transaction already aborted', 'InvalidStateError')
    }
    this.committed = true

    if (this.oncomplete) {
      this.oncomplete(new Event('complete'))
    }
  }
}

// 全局IndexedDB工厂函数
let databases: Map<string, MockIDBDatabase> = new Map()

export function resetMockIndexedDB(): void {
  databases.clear()
}

export function createMockIDBFactory(): any {
  return {
    open: (name: string, version?: number): Promise<MockIDBOpenDBRequest> => {
      return new Promise((resolve, reject) => {
        const request = {
          source: null,
          readyState: 'pending',
          result: null,
          error: null,
          onupgradeneeded: null,
          onblocked: null,
          onsuccess: null,
          onerror: null,
        } as MockIDBOpenDBRequest

        setTimeout(() => {
          try {
            let db = databases.get(name)

            if (!db) {
              db = new MockIDBDatabaseImpl(name, version || 1)
              databases.set(name, db)

              if (request.onupgradeneeded) {
                request.onupgradeneeded({
                  type: 'upgradeneeded',
                  oldVersion: 0,
                  newVersion: version || 1,
                  target: request,
                } as any)
              }
            } else if (version && db.version !== version) {
              throw new DOMException('Version mismatch', 'VersionError')
            }

            request.result = db
            request.readyState = 'done'

            if (request.onsuccess) {
              request.onsuccess(new Event('success'))
            }

            resolve(request)
          } catch (error) {
            request.error = error
            request.readyState = 'done'

            if (request.onerror) {
              request.onerror(new Event('error'))
            }

            reject(error)
          }
        }, 10)
      })
    },

    deleteDatabase: (name: string): Promise<MockIDBOpenDBRequest> => {
      return new Promise((resolve, reject) => {
        const request = {
          source: null,
          readyState: 'pending',
          result: undefined,
          error: null,
          onsuccess: null,
          onerror: null,
        } as MockIDBOpenDBRequest

        setTimeout(() => {
          try {
            databases.delete(name)
            request.readyState = 'done'

            if (request.onsuccess) {
              request.onsuccess(new Event('success'))
            }

            resolve(request)
          } catch (error) {
            request.error = error
            request.readyState = 'done'

            if (request.onerror) {
              request.onerror(new Event('error'))
            }

            reject(error)
          }
        }, 10)
      })
    },

    cmp: (first: any, second: any): number => {
      if (first < second) return -1
      if (first > second) return 1
      return 0
    },
  }
}

// 设置全局IndexedDB
Object.defineProperty(window, 'indexedDB', {
  value: createMockIDBFactory(),
  writable: true,
})