/**
 * 测试模拟工具
 * 为集成测试提供各种模拟对象和服务
 */

import { vi, jest } from 'vitest'
import type {
  DbCard,
  DbFolder,
  DbTag,
  CoreSyncService,
  EntityType,
  SyncResult,
  ConflictInfo
} from '../../src/services/core-sync-service'

// ============================================================================
// Supabase 模拟
// ============================================================================

export const createMockSupabaseClient = () => {
  const mockData = {
    cards: [] as DbCard[],
    folders: [] as DbFolder[],
    tags: [] as DbTag[]
  }

  const mockTable = (tableName: string) => ({
    select: (columns = '*') => ({
      eq: (column: string, value: any) => ({
        eq: (column2: string, value2: any) => ({
          order: (orderBy: string, options?: any) => ({
            limit: (limit: number) => ({
              data: mockData[tableName as keyof typeof mockData] || [],
              error: null
            }),
            then: (resolve: any) => resolve({
              data: mockData[tableName as keyof typeof mockData] || [],
              error: null
            })
          }),
          then: (resolve: any) => resolve({
            data: mockData[tableName as keyof typeof mockData] || [],
            error: null
          })
        }),
        order: (orderBy: string, options?: any) => ({
          limit: (limit: number) => ({
            data: mockData[tableName as keyof typeof mockData] || [],
            error: null
          }),
          then: (resolve: any) => resolve({
            data: mockData[tableName as keyof typeof mockData] || [],
            error: null
          })
        }),
        then: (resolve: any) => resolve({
          data: mockData[tableName as keyof typeof mockData] || [],
          error: null
        })
      }),
      in: (column: string, values: any[]) => ({
        then: (resolve: any) => resolve({
          data: mockData[tableName as keyof typeof mockData]?.filter((item: any) =>
            values.includes(item[column])
          ) || [],
          error: null
        })
      }),
      then: (resolve: any) => resolve({
        data: mockData[tableName as keyof typeof mockData] || [],
        error: null
      })
    }),
    insert: (data: any) => ({
      select: () => ({
        then: (resolve: any) => resolve({
          data: Array.isArray(data) ? data : [data],
          error: null
        })
      }),
      then: (resolve: any) => resolve({
        data: Array.isArray(data) ? data : [data],
        error: null
      })
    }),
    update: (updates: any) => ({
      eq: (column: string, value: any) => ({
        eq: (column2: string, value2: any) => ({
          then: (resolve: any) => resolve({
            data: [{ ...updates, id: value }],
            error: null
          })
        }),
        then: (resolve: any) => resolve({
          data: [{ ...updates, id: value }],
          error: null
        })
      }),
      then: (resolve: any) => resolve({
        data: [{ ...updates }],
        error: null
      })
    }),
    delete: () => ({
      eq: (column: string, value: any) => ({
        eq: (column2: string, value2: any) => ({
          then: (resolve: any) => resolve({
            data: null,
            error: null
          })
        }),
        then: (resolve: any) => resolve({
          data: null,
          error: null
        })
      }),
      then: (resolve: any) => resolve({
        data: null,
        error: null
      })
    })
  })

  return {
    from: (tableName: string) => mockTable(tableName),
    storage: {
      from: (bucketName: string) => ({
        upload: (path: string, file: File) => ({
          data: { path },
          error: null
        }),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/${bucketName}/${path}` }
        }),
        remove: (paths: string[]) => ({
          data: {},
          error: null
        })
      })
    },
    auth: {
      getSession: () => ({
        data: {
          session: {
            user: { id: 'test-user-id' },
            access_token: 'test-access-token'
          }
        },
        error: null
      }),
      signInWithOAuth: () => ({
        data: { url: 'https://test.oauth.com' },
        error: null
      }),
      signOut: () => ({
        error: null
      })
    },
    // 添加模拟数据管理方法
    __mockData: mockData,
    __addData: (tableName: string, data: any) => {
      if (!mockData[tableName as keyof typeof mockData]) {
        mockData[tableName as keyof typeof mockData] = []
      }
      mockData[tableName as keyof typeof mockData].push(data)
    },
    __clearData: (tableName?: string) => {
      if (tableName) {
        mockData[tableName as keyof typeof mockData] = []
      } else {
        Object.keys(mockData).forEach(key => {
          mockData[key as keyof typeof mockData] = []
        })
      }
    }
  }
}

// ============================================================================
// 数据库模拟 (Dexie)
// ============================================================================

export const createMockDatabase = () => {
  const mockData = {
    cards: new Map<string, DbCard>(),
    folders: new Map<string, DbFolder>(),
    tags: new Map<string, DbTag>()
  }

  const createTable = <T>(tableName: string) => ({
    add: async (item: T) => {
      const id = crypto.randomUUID()
      const itemWithId = { ...item, id } as T & { id: string }
      mockData[tableName as keyof typeof mockData].set(id, itemWithId)
      return id
    },
    update: async (id: string, changes: Partial<T>) => {
      const existing = mockData[tableName as keyof typeof mockData].get(id)
      if (existing) {
        const updated = { ...existing, ...changes }
        mockData[tableName as keyof typeof mockData].set(id, updated)
        return id
      }
      throw new Error('Item not found')
    },
    get: async (id: string) => {
      return mockData[tableName as keyof typeof mockData].get(id)
    },
    delete: async (id: string) => {
      return mockData[tableName as keyof typeof mockData].delete(id)
    },
    toArray: async () => {
      return Array.from(mockData[tableName as keyof typeof mockData].values())
    },
    count: async () => {
      return mockData[tableName as keyof typeof mockData].size
    },
    clear: async () => {
      mockData[tableName as keyof typeof mockData].clear()
    },
    where: (predicate: any) => ({
      equals: (value: any) => ({
        toArray: async () => {
          return Array.from(mockData[tableName as keyof typeof mockData].values())
            .filter(item => item[predicate as keyof T] === value)
        },
        first: async () => {
          return Array.from(mockData[tableName as keyof typeof mockData].values())
            .find(item => item[predicate as keyof T] === value)
        }
      }),
      above: (value: any) => ({
        toArray: async () => {
          return Array.from(mockData[tableName as keyof typeof mockData].values())
            .filter(item => item[predicate as keyof T] > value)
        }
      }),
      between: (lower: any, upper: any) => ({
        toArray: async () => {
          return Array.from(mockData[tableName as keyof typeof mockData].values())
            .filter(item => {
              const val = item[predicate as keyof T]
              return val >= lower && val <= upper
            })
        }
      })
    }),
    orderBy: (key: string) => ({
      toArray: async () => {
        return Array.from(mockData[tableName as keyof typeof mockData].values())
          .sort((a, b) => {
            const aVal = a[key as keyof T]
            const bVal = b[key as keyof T]
            if (aVal < bVal) return -1
            if (aVal > bVal) return 1
            return 0
          })
        }
    })
  })

  return {
    cards: createTable<DbCard>('cards'),
    folders: createTable<DbFolder>('folders'),
    tags: createTable<DbTag>('tags'),
    transaction: async (mode: string, ...tables: string[]) => {
      return {
        table: (name: string) => createTable(name),
        complete: Promise.resolve(),
        abort: () => {}
      }
    },
    __mockData: mockData
  }
}

// ============================================================================
// 认证服务模拟
// ============================================================================

export const createMockAuthService = () => ({
  getCurrentUserId: vi.fn().mockResolvedValue('test-user-id'),
  isSignedIn: vi.fn().mockResolvedValue(true),
  signIn: vi.fn().mockResolvedValue({ success: true }),
  signOut: vi.fn().mockResolvedValue({ success: true }),
  onAuthStateChange: vi.fn().mockReturnValue(() => {}),
  getToken: vi.fn().mockResolvedValue('test-token'),
  refreshSession: vi.fn().mockResolvedValue({ success: true })
})

// ============================================================================
// 事件系统模拟
// ============================================================================

export const createMockEventSystem = () => {
  const listeners = new Map<string, Set<Function>>()

  return {
    on: vi.fn().mockImplementation((event: string, listener: Function) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set())
      }
      listeners.get(event)!.add(listener)

      return () => {
        const eventListeners = listeners.get(event)
        if (eventListeners) {
          eventListeners.delete(listener)
          if (eventListeners.size === 0) {
            listeners.delete(event)
          }
        }
      }
    }),
    emit: vi.fn().mockImplementation((event: string, data: any) => {
      const eventListeners = listeners.get(event)
      if (eventListeners) {
        eventListeners.forEach(listener => {
          try {
            listener(data)
          } catch (error) {
            console.error(`Error in event listener for ${event}:`, error)
          }
        })
      }
    }),
    off: vi.fn().mockImplementation((event: string, listener: Function) => {
      const eventListeners = listeners.get(event)
      if (eventListeners) {
        eventListeners.delete(listener)
      }
    }),
    clear: vi.fn().mockImplementation(() => {
      listeners.clear()
    }),
    __listeners: listeners
  }
}

// ============================================================================
// 冲突解决器模拟
// ============================================================================

export const createMockConflictResolver = () => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  detectConflicts: vi.fn().mockResolvedValue([]),
  resolveConflicts: vi.fn().mockImplementation((conflicts: ConflictInfo[]) => {
    return Promise.resolve(conflicts.map(conflict => ({
      ...conflict,
      resolution: 'local' as const,
      autoResolved: true
    })))
  }),
  addResolutionStrategy: vi.fn(),
  removeResolutionStrategy: vi.fn()
})

// ============================================================================
// 内容去重器模拟
// ============================================================================

export const createMockContentDeduplicator = () => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  checkDuplicates: vi.fn().mockResolvedValue([]),
  markDuplicates: vi.fn().mockResolvedValue([]),
  removeDuplicates: vi.fn().mockResolvedValue([]),
  getContentHash: vi.fn().mockReturnValue('mock-hash')
})

// ============================================================================
// 核心同步服务模拟
// ============================================================================

export const createMockCoreSyncService = () => {
  const mockEvents = createMockEventSystem()
  const mockMetrics = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageSyncTime: 0,
    lastSyncTime: null,
    conflictsCount: 0,
    networkQuality: 'good' as const
  }

  const mockStatus = {
    isInitialized: false,
    isOnline: true,
    isSyncing: false,
    currentOperation: null,
    lastSyncTime: null,
    pendingOperations: 0,
    queuedOperations: 0,
    activeOperations: 0,
    lastError: null
  }

  const createMockSyncResult = (entityType: EntityType, success: boolean = true): SyncResult => ({
    success,
    entityType,
    operationCount: 1,
    successCount: success ? 1 : 0,
    errorCount: success ? 0 : 1,
    conflictCount: 0,
    duration: 100,
    errors: success ? [] : [{
      id: crypto.randomUUID(),
      entityId: 'test-id',
      entityType,
      code: 'TEST_ERROR',
      message: 'Test error',
      details: {},
      timestamp: new Date(),
      retryable: true
    }],
    conflicts: [],
    timestamp: new Date()
  })

  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    syncUp: vi.fn().mockImplementation((entityType: EntityType) =>
      Promise.resolve(createMockSyncResult(entityType))
    ),
    syncDown: vi.fn().mockImplementation((entityType: EntityType) =>
      Promise.resolve(createMockSyncResult(entityType))
    ),
    syncBoth: vi.fn().mockImplementation((entityType: EntityType) =>
      Promise.resolve(createMockSyncResult(entityType))
    ),
    syncIncremental: vi.fn().mockImplementation((entityType: EntityType) =>
      Promise.resolve(createMockSyncResult(entityType))
    ),
    syncSmart: vi.fn().mockResolvedValue(createMockSyncResult(EntityType.CARD)),
    syncBatch: vi.fn().mockResolvedValue(createMockSyncResult(EntityType.CARD)),
    syncAll: vi.fn().mockResolvedValue(createMockSyncResult(EntityType.CARD)),
    detectConflicts: vi.fn().mockResolvedValue([]),
    resolveConflicts: vi.fn().mockResolvedValue([]),
    getStatus: vi.fn().mockReturnValue(mockStatus),
    getMetrics: vi.fn().mockReturnValue(mockMetrics),
    getHistory: vi.fn().mockResolvedValue([]),
    updateConfig: vi.fn(),
    getConfig: vi.fn().mockReturnValue({}),
    on: mockEvents.on,
    emit: mockEvents.emit,
    __mockEvents: mockEvents,
    __mockMetrics: mockMetrics,
    __mockStatus: mockStatus,
    __setSyncResult: (entityType: EntityType, success: boolean) => {
      const result = createMockSyncResult(entityType, success)
      if (success) {
        mockMetrics.successfulOperations++
      } else {
        mockMetrics.failedOperations++
      }
      mockMetrics.totalOperations++
      return result
    }
  }
}

// ============================================================================
// 网络监控模拟
// ============================================================================

export const createMockNetworkMonitor = () => {
  let isOnline = true

  return {
    isOnline: () => isOnline,
    getStatus: () => ({
      online: isOnline,
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false
    }),
    onOnline: vi.fn(),
    onOffline: vi.fn(),
    onStatusChange: vi.fn(),
    __setOnline: (online: boolean) => {
      isOnline = online
    }
  }
}

// ============================================================================
// 测试数据生成器
// ============================================================================

export const createTestCard = (overrides: Partial<DbCard> = {}): DbCard => ({
  id: crypto.randomUUID(),
  user_id: 'test-user-id',
  title: 'Test Card',
  content: 'Test content',
  tags: [],
  folder_id: null,
  style_config: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sync_version: 1,
  is_deleted: false,
  ...overrides
})

export const createTestFolder = (overrides: Partial<DbFolder> = {}): DbFolder => ({
  id: crypto.randomUUID(),
  user_id: 'test-user-id',
  name: 'Test Folder',
  parent_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sync_version: 1,
  is_deleted: false,
  ...overrides
})

export const createTestTag = (overrides: Partial<DbTag> = {}): DbTag => ({
  id: crypto.randomUUID(),
  user_id: 'test-user-id',
  name: 'test-tag',
  color: '#ff0000',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sync_version: 1,
  is_deleted: false,
  ...overrides
})

// ============================================================================
// 环境设置和清理
// ============================================================================

export const setupTestEnvironment = () => {
  // 设置模拟环境变量
  Object.defineProperty(global, 'import', {
    value: {
      meta: {
        env: {
          VITE_SUPABASE_URL: 'https://test-project.supabase.co',
          VITE_SUPABASE_ANON_KEY: 'test-anon-key',
          NODE_ENV: 'test'
        }
      }
    },
    writable: true
  })

  // 设置网络状态
  Object.defineProperty(navigator, 'onLine', {
    value: true,
    writable: true
  })

  return {
    cleanup: () => {
      // 清理测试环境
    }
  }
}

// ============================================================================
// 性能测试工具
// ============================================================================

export const measurePerformance = async (fn: () => Promise<any> | any) => {
  const start = performance.now()
  const result = await fn()
  const end = performance.now()

  return {
    result,
    duration: end - start,
    memory: {
      used: performance.memory?.usedJSHeapSize || 0,
      total: performance.memory?.totalJSHeapSize || 0,
      limit: performance.memory?.jsHeapSizeLimit || 0
    }
  }
}

// ============================================================================
// 等待工具
// ============================================================================

export const waitFor = (
  condition: () => boolean,
  timeout = 5000,
  interval = 100
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()

    const check = () => {
      if (condition()) {
        resolve()
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for condition after ${timeout}ms`))
      } else {
        setTimeout(check, interval)
      }
    }

    check()
  })
}

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// 导出所有模拟对象
// ============================================================================

export {
  vi,
  jest
}

export default {
  createMockSupabaseClient,
  createMockDatabase,
  createMockAuthService,
  createMockEventSystem,
  createMockConflictResolver,
  createMockContentDeduplicator,
  createMockCoreSyncService,
  createMockNetworkMonitor,
  createTestCard,
  createTestFolder,
  createTestTag,
  setupTestEnvironment,
  measurePerformance,
  waitFor,
  sleep,
  vi,
  jest
}