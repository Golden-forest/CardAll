// 模拟服务 - 为测试提供完整的服务层模拟
import { MockSupabaseClient, MockIndexedDB } from './advanced-test-utils'
import type { TestCardData, TestFolderData, TestTagData, TestSyncOperation } from './advanced-test-utils'

// ============================================================================
// Supabase 服务模拟
// ============================================================================

export class MockSupabaseService {
  private client: MockSupabaseClient
  private authState = {
    user: null,
    session: null,
    isLoading: false,
  }

  constructor() {
    this.client = new MockSupabaseClient()
  }

  // 认证服务
  auth = {
    signUp: jest.fn(async ({ email, password }: { email: string; password: string }) => {
      this.authState.isLoading = true
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const user = {
        id: crypto.randomUUID(),
        email,
        created_at: new Date().toISOString(),
      }
      
      this.authState.user = user
      this.authState.isLoading = false
      
      return {
        user,
        session: { access_token: 'mock-token', user },
        error: null,
      }
    }),

    signIn: jest.fn(async ({ email, password }: { email: string; password: string }) => {
      this.authState.isLoading = true
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (email === 'error@example.com') {
        this.authState.isLoading = false
        return {
          user: null,
          session: null,
          error: { message: 'Invalid credentials' },
        }
      }
      
      const user = {
        id: 'mock-user-id',
        email,
        created_at: new Date().toISOString(),
      }
      
      this.authState.user = user
      this.authState.isLoading = false
      
      return {
        user,
        session: { access_token: 'mock-token', user },
        error: null,
      }
    }),

    signOut: jest.fn(async () => {
      this.authState.isLoading = true
      await new Promise(resolve => setTimeout(resolve, 50))
      
      this.authState.user = null
      this.authState.session = null
      this.authState.isLoading = false
      
      return { error: null }
    }),

    getCurrentUser: jest.fn(() => {
      return this.authState.user
    }),

    onAuthStateChange: jest.fn((callback: (event: string, session: any) => void) => {
      // 返回一个取消订阅函数
      return {
        data: {
          subscription: {
            unsubscribe: jest.fn(),
          },
        },
      }
    }),

    resetPasswordForEmail: jest.fn(async (email: string) => {
      await new Promise(resolve => setTimeout(resolve, 100))
      return { error: null }
    }),

    updateUser: jest.fn(async (attributes: any) => {
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (this.authState.user) {
        this.authState.user = { ...this.authState.user, ...attributes }
      }
      
      return {
        user: this.authState.user,
        error: null,
      }
    }),
  }

  // 数据库服务
  from = jest.fn((table: string) => {
    switch (table) {
      case 'cards':
        return this.client.cards
      case 'folders':
        return this.client.folders
      case 'tags':
        return this.client.tags
      default:
        return {
          select: jest.fn(() => ({ data: [], error: null })),
          insert: jest.fn(() => ({ data: [], error: null })),
          update: jest.fn(() => ({ data: [], error: null })),
          delete: jest.fn(() => ({ data: null, error: null })),
        }
    }
  })

  // 实时服务
  channel = jest.fn((channelName: string) => {
    return {
      on: jest.fn((event: string, callback: (payload: any) => void) => {
        return this
      }),
      subscribe: jest.fn(() => {
        return {
          unsubscribe: jest.fn(),
        }
      }),
      send: jest.fn((payload: any) => {
        return Promise.resolve()
      }),
    }
  })

  // 存储服务
  storage = {
    from: jest.fn((bucket: string) => ({
      upload: jest.fn(async (path: string, file: File) => {
        await new Promise(resolve => setTimeout(resolve, 200))
        return {
          data: { path: `${bucket}/${path}` },
          error: null,
        }
      }),
      getPublicUrl: jest.fn((path: string) => ({
        data: { publicUrl: `https://example.com/${bucket}/${path}` },
      })),
      remove: jest.fn(async (paths: string[]) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { error: null }
      }),
      list: jest.fn(() => ({
        data: [],
        error: null,
      })),
    })),
  }

  // 辅助方法
  getClient = () => this.client
  getAuthState = () => this.authState
  setAuthState = (state: any) => {
    this.authState = { ...this.authState, ...state }
  }
  reset = () => {
    this.client.reset()
    this.authState = {
      user: null,
      session: null,
      isLoading: false,
    }
  }
}

// ============================================================================
// 数据库服务模拟
// ============================================================================

export class MockDatabaseService {
  private db: MockIndexedDB
  private syncOperations: TestSyncOperation[] = []

  constructor() {
    this.db = new MockIndexedDB()
  }

  // 卡片操作
  cards = {
    add: jest.fn(async (card: Partial<TestCardData>) => {
      const result = await this.db.table('cards').add(card)
      return result
    }),

    get: jest.fn(async (id: string) => {
      return await this.db.table('cards').get(id)
    }),

    getAll: jest.fn(async () => {
      return await this.db.table('cards').toArray()
    }),

    update: jest.fn(async (id: string, updates: Partial<TestCardData>) => {
      await this.db.table('cards').where('id').equals(id).modify(updates)
      return true
    }),

    delete: jest.fn(async (id: string) => {
      const deleted = await this.db.table('cards').where('id').equals(id).delete()
      return deleted > 0
    }),

    bulkAdd: jest.fn(async (cards: Partial<TestCardData>[]) => {
      const results = await this.db.table('cards').bulkAdd(cards)
      return results
    }),

    clear: jest.fn(async () => {
      await this.db.table('cards').clear()
    }),

    findByFolder: jest.fn(async (folderId: string) => {
      return await this.db.table('cards').where('folderId').equals(folderId).toArray()
    }),

    findByTag: jest.fn(async (tag: string) => {
      const allCards = await this.db.table('cards').toArray()
      return allCards.filter(card => 
        card.frontContent.tags.includes(tag) || card.backContent.tags.includes(tag)
      )
    }),

    search: jest.fn(async (searchTerm: string) => {
      const allCards = await this.db.table('cards').toArray()
      const term = searchTerm.toLowerCase()
      
      return allCards.filter(card => 
        card.frontContent.title.toLowerCase().includes(term) ||
        card.frontContent.text.toLowerCase().includes(term) ||
        card.backContent.title.toLowerCase().includes(term) ||
        card.backContent.text.toLowerCase().includes(term)
      )
    }),
  }

  // 文件夹操作
  folders = {
    add: jest.fn(async (folder: Partial<TestFolderData>) => {
      const result = await this.db.table('folders').add(folder)
      return result
    }),

    get: jest.fn(async (id: string) => {
      return await this.db.table('folders').get(id)
    }),

    getAll: jest.fn(async () => {
      return await this.db.table('folders').toArray()
    }),

    update: jest.fn(async (id: string, updates: Partial<TestFolderData>) => {
      await this.db.table('folders').where('id').equals(id).modify(updates)
      return true
    }),

    delete: jest.fn(async (id: string) => {
      const deleted = await this.db.table('folders').where('id').equals(id).delete()
      return deleted > 0
    }),

    bulkAdd: jest.fn(async (folders: Partial<TestFolderData>[]) => {
      const results = await this.db.table('folders').bulkAdd(folders)
      return results
    }),

    clear: jest.fn(async () => {
      await this.db.table('folders').clear()
    }),

    getChildren: jest.fn(async (parentId: string) => {
      return await this.db.table('folders').where('parentId').equals(parentId).toArray()
    }),

    getRoot: jest.fn(async () => {
      return await this.db.table('folders').where('parentId').equals(undefined).toArray()
    }),
  }

  // 标签操作
  tags = {
    add: jest.fn(async (tag: Partial<TestTagData>) => {
      const result = await this.db.table('tags').add(tag)
      return result
    }),

    get: jest.fn(async (id: string) => {
      return await this.db.table('tags').get(id)
    }),

    getAll: jest.fn(async () => {
      return await this.db.table('tags').toArray()
    }),

    update: jest.fn(async (id: string, updates: Partial<TestTagData>) => {
      await this.db.table('tags').where('id').equals(id).modify(updates)
      return true
    }),

    delete: jest.fn(async (id: string) => {
      const deleted = await this.db.table('tags').where('id').equals(id).delete()
      return deleted > 0
    }),

    bulkAdd: jest.fn(async (tags: Partial<TestTagData>[]) => {
      const results = await this.db.table('tags').bulkAdd(tags)
      return results
    }),

    clear: jest.fn(async () => {
      await this.db.table('tags').clear()
    }),

    getVisible: jest.fn(async () => {
      const allTags = await this.db.table('tags').toArray()
      return allTags.filter(tag => !tag.isHidden)
    }),

    getHidden: jest.fn(async () => {
      const allTags = await this.db.table('tags').toArray()
      return allTags.filter(tag => tag.isHidden)
    }),
  }

  // 同步队列操作
  syncQueue = {
    add: jest.fn(async (operation: Partial<TestSyncOperation>) => {
      const result = await this.db.table('syncQueue').add(operation)
      this.syncOperations.push(operation as TestSyncOperation)
      return result
    }),

    get: jest.fn(async (id: string) => {
      return await this.db.table('syncQueue').get(id)
    }),

    getAll: jest.fn(async () => {
      return await this.db.table('syncQueue').toArray()
    }),

    getPending: jest.fn(async () => {
      return await this.db.table('syncQueue').where('status').equals('pending').toArray()
    }),

    getFailed: jest.fn(async () => {
      return await this.db.table('syncQueue').where('status').equals('failed').toArray()
    }),

    update: jest.fn(async (id: string, updates: Partial<TestSyncOperation>) => {
      await this.db.table('syncQueue').where('id').equals(id).modify(updates)
      return true
    }),

    delete: jest.fn(async (id: string) => {
      const deleted = await this.db.table('syncQueue').where('id').equals(id).delete()
      this.syncOperations = this.syncOperations.filter(op => op.id !== id)
      return deleted > 0
    }),

    clear: jest.fn(async () => {
      await this.db.table('syncQueue').clear()
      this.syncOperations = []
    }),

    getStats: jest.fn(() => {
      const pending = this.syncOperations.filter(op => op.status === 'pending').length
      const processing = this.syncOperations.filter(op => op.status === 'processing').length
      const completed = this.syncOperations.filter(op => op.status === 'completed').length
      const failed = this.syncOperations.filter(op => op.status === 'failed').length
      
      return {
        total: this.syncOperations.length,
        pending,
        processing,
        completed,
        failed,
      }
    }),
  }

  // 数据库管理
  clearAll = jest.fn(async () => {
    await this.cards.clear()
    await this.folders.clear()
    await this.tags.clear()
    await this.syncQueue.clear()
    this.syncOperations = []
  })

  exportData = jest.fn(async () => {
    const [cards, folders, tags, syncQueue] = await Promise.all([
      this.cards.getAll(),
      this.folders.getAll(),
      this.tags.getAll(),
      this.syncQueue.getAll(),
    ])

    return {
      cards,
      folders,
      tags,
      syncQueue,
      exportedAt: new Date(),
    }
  })

  importData = jest.fn(async (data: any) => {
    await this.clearAll()
    
    await Promise.all([
      this.cards.bulkAdd(data.cards || []),
      this.folders.bulkAdd(data.folders || []),
      this.tags.bulkAdd(data.tags || []),
      this.syncQueue.bulkAdd(data.syncQueue || []),
    ])
  })

  // 辅助方法
  getDB = () => this.db
  reset = () => {
    this.db.reset()
    this.syncOperations = []
  }
}

// ============================================================================
// 同步服务模拟
// ============================================================================

export class MockSyncService {
  private supabaseService: MockSupabaseService
  private databaseService: MockDatabaseService
  private isOnline = true
  private syncInProgress = false
  private lastSyncTime: Date | null = null
  private syncErrors: string[] = []

  constructor(
    supabaseService: MockSupabaseService,
    databaseService: MockDatabaseService
  ) {
    this.supabaseService = supabaseService
    this.databaseService = databaseService
  }

  // 同步状态
  isOnline = jest.fn(() => this.isOnline)
  isSyncing = jest.fn(() => this.syncInProgress)
  getLastSyncTime = jest.fn(() => this.lastSyncTime)
  getSyncErrors = jest.fn(() => [...this.syncErrors])

  // 网络状态管理
  setOnline = jest.fn((online: boolean) => {
    this.isOnline = online
  })

  // 手动同步
  syncNow = jest.fn(async () => {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress')
    }

    this.syncInProgress = true
    this.syncErrors = []

    try {
      // 获取待同步的操作
      const pendingOperations = await this.databaseService.syncQueue.getPending()
      
      if (pendingOperations.length === 0) {
        this.lastSyncTime = new Date()
        this.syncInProgress = false
        return { success: true, syncedCount: 0 }
      }

      // 处理每个操作
      let syncedCount = 0
      const errors: string[] = []

      for (const operation of pendingOperations) {
        try {
          await this.executeSyncOperation(operation)
          syncedCount++
          
          // 标记操作为已完成
          await this.databaseService.syncQueue.update(operation.id, {
            status: 'completed',
            error: null,
          })
        } catch (error) {
          const errorMsg = `Failed to sync operation ${operation.id}: ${error}`
          errors.push(errorMsg)
          this.syncErrors.push(errorMsg)
          
          // 标记操作为失败
          await this.databaseService.syncQueue.update(operation.id, {
            status: 'failed',
            error: errorMsg,
          })
        }
      }

      this.lastSyncTime = new Date()
      this.syncInProgress = false

      return {
        success: errors.length === 0,
        syncedCount,
        errors: errors.length,
        errorDetails: errors,
      }
    } catch (error) {
      this.syncInProgress = false
      const errorMsg = `Sync failed: ${error}`
      this.syncErrors.push(errorMsg)
      
      return {
        success: false,
        syncedCount: 0,
        errors: 1,
        errorDetails: [errorMsg],
      }
    }
  })

  // 自动同步
  startAutoSync = jest.fn((interval: number = 30000) => {
    const intervalId = setInterval(async () => {
      if (this.isOnline && !this.syncInProgress) {
        await this.syncNow()
      }
    }, interval)
    
    return () => clearInterval(intervalId)
  })

  // 执行同步操作
  private executeSyncOperation = async (operation: TestSyncOperation) => {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50))

    switch (operation.entity) {
      case 'card':
        return await this.syncCard(operation)
      case 'folder':
        return await this.syncFolder(operation)
      case 'tag':
        return await this.syncTag(operation)
      default:
        throw new Error(`Unknown entity type: ${operation.entity}`)
    }
  }

  private syncCard = async (operation: TestSyncOperation) => {
    switch (operation.type) {
      case 'create':
        await this.supabaseService.from('cards').insert(operation.data)
        break
      case 'update':
        await this.supabaseService.from('cards').update(operation.data).eq('id', operation.entityId)
        break
      case 'delete':
        await this.supabaseService.from('cards').delete().eq('id', operation.entityId)
        break
    }
  }

  private syncFolder = async (operation: TestSyncOperation) => {
    switch (operation.type) {
      case 'create':
        await this.supabaseService.from('folders').insert(operation.data)
        break
      case 'update':
        await this.supabaseService.from('folders').update(operation.data).eq('id', operation.entityId)
        break
      case 'delete':
        await this.supabaseService.from('folders').delete().eq('id', operation.entityId)
        break
    }
  }

  private syncTag = async (operation: TestSyncOperation) => {
    switch (operation.type) {
      case 'create':
        await this.supabaseService.from('tags').insert(operation.data)
        break
      case 'update':
        await this.supabaseService.from('tags').update(operation.data).eq('id', operation.entityId)
        break
      case 'delete':
        await this.supabaseService.from('tags').delete().eq('id', operation.entityId)
        break
    }
  }

  // 冲突解决
  resolveConflicts = jest.fn(async (conflicts: any[]) => {
    // 模拟冲突解决逻辑
    const resolvedConflicts = conflicts.map(conflict => ({
      ...conflict,
      resolved: true,
      resolution: 'local-wins',
    }))
    
    return resolvedConflicts
  })

  // 辅助方法
  clearErrors = jest.fn(() => {
    this.syncErrors = []
  })

  reset = jest.fn(() => {
    this.isOnline = true
    this.syncInProgress = false
    this.lastSyncTime = null
    this.syncErrors = []
  })
}

// ============================================================================
// 服务工厂
// ============================================================================

export class ServiceFactory {
  private static supabaseService: MockSupabaseService | null = null
  private static databaseService: MockDatabaseService | null = null
  private static syncService: MockSyncService | null = null

  static createSupabaseService(): MockSupabaseService {
    if (!this.supabaseService) {
      this.supabaseService = new MockSupabaseService()
    }
    return this.supabaseService
  }

  static createDatabaseService(): MockDatabaseService {
    if (!this.databaseService) {
      this.databaseService = new MockDatabaseService()
    }
    return this.databaseService
  }

  static createSyncService(
    supabaseService?: MockSupabaseService,
    databaseService?: MockDatabaseService
  ): MockSyncService {
    if (!this.syncService) {
      const supa = supabaseService || this.createSupabaseService()
      const db = databaseService || this.createDatabaseService()
      this.syncService = new MockSyncService(supa, db)
    }
    return this.syncService
  }

  static resetAll(): void {
    this.supabaseService?.reset()
    this.databaseService?.reset()
    this.syncService?.reset()
    
    this.supabaseService = null
    this.databaseService = null
    this.syncService = null
  }
}

// ============================================================================
// 导出
// ============================================================================

export {
  MockSupabaseService,
  MockDatabaseService,
  MockSyncService,
  ServiceFactory,
}