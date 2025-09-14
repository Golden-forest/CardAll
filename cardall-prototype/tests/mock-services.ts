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
    signUp: vi.fn(async ({ email, password }: { email: string; password: string }) => {
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

    signIn: vi.fn(async ({ email, password }: { email: string; password: string }) => {
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

    signOut: vi.fn(async () => {
      this.authState.isLoading = true
      await new Promise(resolve => setTimeout(resolve, 50))
      
      this.authState.user = null
      this.authState.session = null
      this.authState.isLoading = false
      
      return { error: null }
    }),

    getCurrentUser: vi.fn(() => {
      return this.authState.user
    }),

    onAuthStateChange: vi.fn((callback: (event: string, session: any) => void) => {
      // 返回一个取消订阅函数
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      }
    }),

    resetPasswordForEmail: vi.fn(async (email: string) => {
      await new Promise(resolve => setTimeout(resolve, 100))
      return { error: null }
    }),

    updateUser: vi.fn(async (attributes: any) => {
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
  from = vi.fn((table: string) => {
    switch (table) {
      case 'cards':
        return this.client.cards
      case 'folders':
        return this.client.folders
      case 'tags':
        return this.client.tags
      default:
        return {
          select: vi.fn(() => ({ data: [], error: null })),
          insert: vi.fn(() => ({ data: [], error: null })),
          update: vi.fn(() => ({ data: [], error: null })),
          delete: vi.fn(() => ({ data: null, error: null })),
        }
    }
  })

  // 实时服务
  channel = vi.fn((channelName: string) => {
    return {
      on: vi.fn((event: string, callback: (payload: any) => void) => {
        return this
      }),
      subscribe: vi.fn(() => {
        return {
          unsubscribe: vi.fn(),
        }
      }),
      send: vi.fn((payload: any) => {
        return Promise.resolve()
      }),
    }
  })

  // 存储服务
  storage = {
    from: vi.fn((bucket: string) => ({
      upload: vi.fn(async (path: string, file: File) => {
        await new Promise(resolve => setTimeout(resolve, 200))
        return {
          data: { path: `${bucket}/${path}` },
          error: null,
        }
      }),
      getPublicUrl: vi.fn((path: string) => ({
        data: { publicUrl: `https://example.com/${bucket}/${path}` },
      })),
      remove: vi.fn(async (paths: string[]) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { error: null }
      }),
      list: vi.fn(() => ({
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
  reset = vi.fn(() => {
    this.client.reset()
    this.authState = {
      user: null,
      session: null,
      isLoading: false,
    }
  })
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
    add: vi.fn(async (card: Partial<TestCardData>) => {
      const result = await this.db.table('cards').add(card)
      return result
    }),

    get: vi.fn(async (id: string) => {
      return await this.db.table('cards').get(id)
    }),

    getAll: vi.fn(async () => {
      return await this.db.table('cards').toArray()
    }),

    update: vi.fn(async (id: string, updates: Partial<TestCardData>) => {
      await this.db.table('cards').where('id').equals(id).modify(updates)
      return true
    }),

    delete: vi.fn(async (id: string) => {
      const deleted = await this.db.table('cards').where('id').equals(id).delete()
      return deleted > 0
    }),

    bulkAdd: vi.fn(async (cards: Partial<TestCardData>[]) => {
      const results = await this.db.table('cards').bulkAdd(cards)
      return results
    }),

    clear: vi.fn(async () => {
      await this.db.table('cards').clear()
    }),

    findByFolder: vi.fn(async (folderId: string) => {
      return await this.db.table('cards').where('folderId').equals(folderId).toArray()
    }),

    findByTag: vi.fn(async (tag: string) => {
      const allCards = await this.db.table('cards').toArray()
      return allCards.filter(card => 
        card.frontContent.tags.includes(tag) || card.backContent.tags.includes(tag)
      )
    }),

    search: vi.fn(async (searchTerm: string) => {
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
    add: vi.fn(async (folder: Partial<TestFolderData>) => {
      const result = await this.db.table('folders').add(folder)
      return result
    }),

    get: vi.fn(async (id: string) => {
      return await this.db.table('folders').get(id)
    }),

    getAll: vi.fn(async () => {
      return await this.db.table('folders').toArray()
    }),

    update: vi.fn(async (id: string, updates: Partial<TestFolderData>) => {
      await this.db.table('folders').where('id').equals(id).modify(updates)
      return true
    }),

    delete: vi.fn(async (id: string) => {
      const deleted = await this.db.table('folders').where('id').equals(id).delete()
      return deleted > 0
    }),

    bulkAdd: vi.fn(async (folders: Partial<TestFolderData>[]) => {
      const results = await this.db.table('folders').bulkAdd(folders)
      return results
    }),

    clear: vi.fn(async () => {
      await this.db.table('folders').clear()
    }),

    getChildren: vi.fn(async (parentId: string) => {
      return await this.db.table('folders').where('parentId').equals(parentId).toArray()
    }),

    getRoot: vi.fn(async () => {
      return await this.db.table('folders').where('parentId').equals(undefined).toArray()
    }),
  }

  // 标签操作
  tags = {
    add: vi.fn(async (tag: Partial<TestTagData>) => {
      const result = await this.db.table('tags').add(tag)
      return result
    }),

    get: vi.fn(async (id: string) => {
      return await this.db.table('tags').get(id)
    }),

    getAll: vi.fn(async () => {
      return await this.db.table('tags').toArray()
    }),

    update: vi.fn(async (id: string, updates: Partial<TestTagData>) => {
      await this.db.table('tags').where('id').equals(id).modify(updates)
      return true
    }),

    delete: vi.fn(async (id: string) => {
      const deleted = await this.db.table('tags').where('id').equals(id).delete()
      return deleted > 0
    }),

    bulkAdd: vi.fn(async (tags: Partial<TestTagData>[]) => {
      const results = await this.db.table('tags').bulkAdd(tags)
      return results
    }),

    clear: vi.fn(async () => {
      await this.db.table('tags').clear()
    }),

    getVisible: vi.fn(async () => {
      const allTags = await this.db.table('tags').toArray()
      return allTags.filter(tag => !tag.isHidden)
    }),

    getHidden: vi.fn(async () => {
      const allTags = await this.db.table('tags').toArray()
      return allTags.filter(tag => tag.isHidden)
    }),
  }

  // 同步队列操作
  syncQueue = {
    add: vi.fn(async (operation: Partial<TestSyncOperation>) => {
      const result = await this.db.table('syncQueue').add(operation)
      this.syncOperations.push(operation as TestSyncOperation)
      return result
    }),

    get: vi.fn(async (id: string) => {
      return await this.db.table('syncQueue').get(id)
    }),

    getAll: vi.fn(async () => {
      return await this.db.table('syncQueue').toArray()
    }),

    getPending: vi.fn(async () => {
      return await this.db.table('syncQueue').where('status').equals('pending').toArray()
    }),

    getFailed: vi.fn(async () => {
      return await this.db.table('syncQueue').where('status').equals('failed').toArray()
    }),

    bulkAdd: vi.fn(async (operations: Partial<TestSyncOperation>[]) => {
      const results = await this.db.table('syncQueue').bulkAdd(operations)
      this.syncOperations.push(...operations as TestSyncOperation[])
      return results
    }),

    update: vi.fn(async (id: string, updates: Partial<TestSyncOperation>) => {
      await this.db.table('syncQueue').where('id').equals(id).modify(updates)
      return true
    }),

    delete: vi.fn(async (id: string) => {
      const deleted = await this.db.table('syncQueue').where('id').equals(id).delete()
      this.syncOperations = this.syncOperations.filter(op => op.id !== id)
      return deleted > 0
    }),

    clear: vi.fn(async () => {
      await this.db.table('syncQueue').clear()
      this.syncOperations = []
    }),

    getStats: vi.fn(() => {
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
  clearAll = vi.fn(async () => {
    await this.cards.clear()
    await this.folders.clear()
    await this.tags.clear()
    await this.syncQueue.clear()
    this.syncOperations = []
  })

  exportData = vi.fn(async () => {
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

  importData = vi.fn(async (data: any) => {
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
  reset = vi.fn(() => {
    this.db.reset()
    this.syncOperations = []
  })
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

  // 同步状态方法
  getIsOnline = vi.fn(() => this.isOnline)
  getIsSyncing = vi.fn(() => this.syncInProgress)
  getLastSyncTime = vi.fn(() => this.lastSyncTime)
  getSyncErrors = vi.fn(() => [...this.syncErrors])

  // 网络状态管理
  setOnline = vi.fn((online: boolean) => {
    this.isOnline = online
  })

  // 手动同步
  syncNow = vi.fn(async () => {
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
  startAutoSync = vi.fn((interval: number = 30000) => {
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
  resolveConflicts = vi.fn(async (conflicts: any[]) => {
    // 模拟冲突解决逻辑
    const resolvedConflicts = conflicts.map(conflict => ({
      ...conflict,
      resolved: true,
      resolution: 'local-wins',
    }))
    
    return resolvedConflicts
  })

  // 数据生成方法（适配测试）
  generateCard = vi.fn((cardData: any) => {
    return {
      id: cardData.id || crypto.randomUUID(),
      title: cardData.title || 'Test Card',
      frontContent: cardData.frontContent || {
        title: 'Front Title',
        text: 'Front Content',
        images: [],
        tags: [],
        lastModified: new Date(),
      },
      backContent: cardData.backContent || {
        title: 'Back Title',
        text: 'Back Content',
        images: [],
        tags: [],
        lastModified: new Date(),
      },
      style: cardData.style || {
        type: 'solid' as const,
        backgroundColor: '#ffffff',
        fontFamily: 'system-ui',
        fontSize: 'base' as const,
        fontWeight: 'normal' as const,
        textColor: '#1f2937',
        borderRadius: 'xl' as const,
        shadow: 'md' as const,
        borderWidth: 0,
      },
      isFlipped: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...cardData,
    }
  })

  generateFolder = vi.fn((folderData: any) => {
    return {
      id: folderData.id || crypto.randomUUID(),
      name: folderData.name || 'Test Folder',
      color: folderData.color || '#3b82f6',
      icon: folderData.icon || 'folder',
      cardIds: folderData.cardIds || [],
      parentId: folderData.parentId,
      isExpanded: folderData.isExpanded || false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...folderData,
    }
  })

  generateTag = vi.fn((tagData: any) => {
    return {
      id: tagData.id || crypto.randomUUID(),
      name: tagData.name || 'Test Tag',
      color: tagData.color || '#3b82f6',
      count: tagData.count || 0,
      isHidden: tagData.isHidden || false,
      createdAt: new Date(),
      ...tagData,
    }
  })

  // 辅助方法
  clearErrors = vi.fn(() => {
    this.syncErrors = []
  })

  reset = vi.fn(() => {
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

// Mock services export已在类定义中处理