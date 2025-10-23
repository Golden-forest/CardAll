/**
 * 测试数据和fixture
 * 提供统一的测试数据用于所有测试用例
 */

import { Card, Folder, Tag, CardContent, ImageData } from '@/types/card'
import { SyncOperation, SyncStatus } from '@/types/sync'

// 测试用的Card数据
export const testCards: Card[] = [
  {
    id: 'test-card-1',
    title: '测试卡片 1',
    content: {
      title: '测试卡片 1',
      content: '这是一个测试卡片的内容',
      tags: ['test', 'important'],
      created: new Date('2024-01-01T00:00:00Z'),
      modified: new Date('2024-01-01T00:00:00Z'),
    } as CardContent,
    frontContent: '正面内容 1',
    backContent: '背面内容 1',
    isFlipped: false,
    isBookmarked: true,
    folderId: 'test-folder-1',
    tagIds: ['test-tag-1', 'test-tag-2'],
    imageIds: ['test-image-1'],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },
  {
    id: 'test-card-2',
    title: '测试卡片 2',
    content: {
      title: '测试卡片 2',
      content: '这是另一个测试卡片的内容',
      tags: ['test', 'normal'],
      created: new Date('2024-01-02T00:00:00Z'),
      modified: new Date('2024-01-02T00:00:00Z'),
    } as CardContent,
    frontContent: '正面内容 2',
    backContent: '背面内容 2',
    isFlipped: true,
    isBookmarked: false,
    folderId: 'test-folder-1',
    tagIds: ['test-tag-1'],
    imageIds: [],
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  },
  {
    id: 'test-card-3',
    title: '测试卡片 3',
    content: {
      title: '测试卡片 3',
      content: '这是第三个测试卡片的内容',
      tags: ['important'],
      created: new Date('2024-01-03T00:00:00Z'),
      modified: new Date('2024-01-03T00:00:00Z'),
    } as CardContent,
    frontContent: '正面内容 3',
    backContent: '背面内容 3',
    isFlipped: false,
    isBookmarked: true,
    folderId: 'test-folder-2',
    tagIds: ['test-tag-3'],
    imageIds: ['test-image-2'],
    createdAt: new Date('2024-01-03T00:00:00Z'),
    updatedAt: new Date('2024-01-03T00:00:00Z'),
  },
]

// 测试用的Folder数据
export const testFolders: Folder[] = [
  {
    id: 'test-folder-1',
    name: '测试文件夹 1',
    description: '这是一个测试文件夹',
    color: '#ff0000',
    icon: 'folder',
    parentId: null,
    childrenIds: [],
    cardIds: ['test-card-1', 'test-card-2'],
    isExpanded: true,
    isFavorite: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },
  {
    id: 'test-folder-2',
    name: '测试文件夹 2',
    description: '这是另一个测试文件夹',
    color: '#00ff00',
    icon: 'folder-open',
    parentId: null,
    childrenIds: [],
    cardIds: ['test-card-3'],
    isExpanded: false,
    isFavorite: false,
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  },
  {
    id: 'test-folder-3',
    name: '测试子文件夹',
    description: '这是一个子文件夹',
    color: '#0000ff',
    icon: 'folder',
    parentId: 'test-folder-1',
    childrenIds: [],
    cardIds: [],
    isExpanded: false,
    isFavorite: false,
    createdAt: new Date('2024-01-03T00:00:00Z'),
    updatedAt: new Date('2024-01-03T00:00:00Z'),
  },
]

// 测试用的Tag数据
export const testTags: Tag[] = [
  {
    id: 'test-tag-1',
    name: '测试标签',
    color: '#ff0000',
    icon: 'tag',
    description: '这是一个测试标签',
    isSystem: false,
    cardIds: ['test-card-1', 'test-card-2'],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },
  {
    id: 'test-tag-2',
    name: '重要',
    color: '#ff9900',
    icon: 'star',
    description: '重要标签',
    isSystem: false,
    cardIds: ['test-card-1'],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },
  {
    id: 'test-tag-3',
    name: '个人',
    color: '#0099ff',
    icon: 'user',
    description: '个人标签',
    isSystem: true,
    cardIds: ['test-card-3'],
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  },
]

// 测试用的ImageData数据
export const testImages: ImageData[] = [
  {
    id: 'test-image-1',
    filename: 'test-image-1.jpg',
    url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQE...',
    type: 'image/jpeg',
    size: 1024,
    width: 800,
    height: 600,
    cardId: 'test-card-1',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },
  {
    id: 'test-image-2',
    filename: 'test-image-2.png',
    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    type: 'image/png',
    size: 2048,
    width: 1024,
    height: 768,
    cardId: 'test-card-3',
    createdAt: new Date('2024-01-03T00:00:00Z'),
    updatedAt: new Date('2024-01-03T00:00:00Z'),
  },
]

// 测试用的SyncOperation数据
export const testSyncOperations: SyncOperation[] = [
  {
    id: 'test-sync-1',
    type: 'CREATE',
    entityType: 'CARD',
    entityId: 'test-card-1',
    data: testCards[0],
    timestamp: new Date('2024-01-01T00:00:00Z'),
    status: SyncStatus.PENDING,
    retryCount: 0,
    error: null,
    priority: 1,
  },
  {
    id: 'test-sync-2',
    type: 'UPDATE',
    entityType: 'CARD',
    entityId: 'test-card-2',
    data: testCards[1],
    timestamp: new Date('2024-01-02T00:00:00Z'),
    status: SyncStatus.SYNCED,
    retryCount: 0,
    error: null,
    priority: 2,
  },
  {
    id: 'test-sync-3',
    type: 'DELETE',
    entityType: 'FOLDER',
    entityId: 'test-folder-3',
    data: null,
    timestamp: new Date('2024-01-03T00:00:00Z'),
    status: SyncStatus.FAILED,
    retryCount: 3,
    error: new Error('Network error'),
    priority: 3,
  },
]

// 性能测试数据
export const performanceTestData = {
  // 数据库性能测试数据
  databaseMetrics: {
    databaseSize: 1024 * 1024, // 1MB
    cardCount: 1000,
    folderCount: 50,
    tagCount: 100,
    imageCount: 200,
    averageQueryTime: 5.5, // ms
    cacheHitRate: 0.85, // 85%
    memoryUsage: 1024 * 1024 * 10, // 10MB
    syncStatus: 'synced' as const,
    consistencyScore: 95,
    errorCount: 2,
    warningCount: 5,
  },

  // 网络性能测试数据
  networkMetrics: {
    latency: 50, // ms
    bandwidth: 1000000, // bytes/s
    packetLoss: 0.01, // 1%
    jitter: 5, // ms
  },

  // 系统性能测试数据
  systemMetrics: {
    cpuUsage: 45, // %
    memoryUsage: 60, // %
    diskUsage: 30, // %
    networkUsage: 20, // %
  },
}

// 错误测试数据
export const errorTestData = {
  // 网络错误
  networkError: new Error('Network Error'),
  timeoutError: new Error('Timeout Error'),
  connectionError: new Error('Connection Error'),

  // 数据错误
  dataValidationError: new Error('Data validation failed'),
  serializationError: new Error('Serialization failed'),
  deserializationError: new Error('Deserialization failed'),

  // 权限错误
  permissionError: new Error('Permission denied'),
  authenticationError: new Error('Authentication failed'),
  authorizationError: new Error('Authorization failed'),

  // 系统错误
  storageError: new Error('Storage error'),
  memoryError: new Error('Out of memory'),
  databaseError: new Error('Database error'),
}

// 安全测试数据
export const securityTestData = {
  // 用户数据
  userData: {
    id: 'test-user-1',
    email: 'test@example.com',
    password: 'hashed-password-123',
    roles: ['user', 'admin'],
    permissions: ['read', 'write', 'delete'],
  },

  // 会话数据
  sessionData: {
    id: 'test-session-1',
    userId: 'test-user-1',
    token: 'test-jwt-token',
    expiresAt: new Date('2024-12-31T23:59:59Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
  },

  // 加密测试数据
  encryptionData: {
    plainText: 'This is a test message',
    cipherText: 'encrypted-data-123',
    key: 'test-encryption-key',
    iv: 'test-iv-123',
  },
}

// 创建测试数据的辅助函数
export const createTestDataBuilder = () => ({
  // 创建卡片
  card: (overrides: Partial<Card> = {}) => ({
    ...testCards[0],
    ...overrides,
    id: overrides.id || `test-card-${Date.now()}`,
  }),

  // 创建文件夹
  folder: (overrides: Partial<Folder> = {}) => ({
    ...testFolders[0],
    ...overrides,
    id: overrides.id || `test-folder-${Date.now()}`,
  }),

  // 创建标签
  tag: (overrides: Partial<Tag> = {}) => ({
    ...testTags[0],
    ...overrides,
    id: overrides.id || `test-tag-${Date.now()}`,
  }),

  // 创建同步操作
  syncOperation: (overrides: Partial<SyncOperation> = {}) => ({
    ...testSyncOperations[0],
    ...overrides,
    id: overrides.id || `test-sync-${Date.now()}`,
  }),

  // 创建大量数据用于性能测试
  bulkData: (count: number) => ({
    cards: Array.from({ length: count }, (_, i) => ({
      ...testCards[0],
      id: `bulk-card-${i}`,
      title: `Bulk Card ${i}`,
      content: {
        ...testCards[0].content,
        title: `Bulk Card ${i}`,
        content: `This is bulk card ${i} content`,
      },
    })),
    folders: Array.from({ length: Math.floor(count / 10) }, (_, i) => ({
      ...testFolders[0],
      id: `bulk-folder-${i}`,
      name: `Bulk Folder ${i}`,
    })),
    tags: Array.from({ length: Math.floor(count / 20) }, (_, i) => ({
      ...testTags[0],
      id: `bulk-tag-${i}`,
      name: `Bulk Tag ${i}`,
    })),
  }),
})

// 测试数据构建器实例
export const testData = createTestDataBuilder()