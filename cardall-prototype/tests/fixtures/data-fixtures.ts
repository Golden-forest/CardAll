// 测试夹具 - 提供常用的测试数据
export const userFixtures = {
  // 基础用户
  basicUser: {
    id: 'user-1',
    email: 'basic@example.com',
    name: 'Basic User',
    avatar: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },

  // 高级用户
  premiumUser: {
    id: 'user-2',
    email: 'premium@example.com',
    name: 'Premium User',
    avatar: 'https://example.com/avatar.jpg',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },

  // 新用户
  newUser: {
    id: 'user-3',
    email: 'new@example.com',
    name: 'New User',
    avatar: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
}

export const cardFixtures = {
  // 简单文本卡片
  textCard: {
    id: 'card-1',
    title: 'Simple Text Card',
    content: '<p>This is a simple text card with basic content.</p>',
    backContent: '',
    tags: ['text', 'simple'],
    folderId: null,
    style: 'default',
    isFlipped: false,
    order: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    userId: 'user-1',
    isLocalOnly: false,
    cloudSynced: true,
  },

  // 图片卡片
  imageCard: {
    id: 'card-2',
    title: 'Image Card',
    content: '<p>Card with image:</p><img src="test.jpg" alt="Test image">',
    backContent: '',
    tags: ['image', 'visual'],
    folderId: null,
    style: 'gradient-blue',
    isFlipped: false,
    order: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    userId: 'user-1',
    isLocalOnly: false,
    cloudSynced: true,
  },

  // 复杂内容卡片
  complexCard: {
    id: 'card-3',
    title: 'Complex Card',
    content: `
      <h2>Complex Content</h2>
      <p>This card contains multiple elements:</p>
      <ul>
        <li>Lists</li>
        <li><strong>Formatted text</strong></li>
        <li><em>Emphasis</em></li>
      </ul>
      <blockquote>Block quote example</blockquote>
      <pre><code>Code block</code></pre>
    `,
    backContent: '<p>Additional information on the back.</p>',
    tags: ['complex', 'formatted'],
    folderId: null,
    style: 'gradient-green',
    isFlipped: false,
    order: 2,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    userId: 'user-1',
    isLocalOnly: false,
    cloudSynced: true,
  },

  // 任务列表卡片
  taskCard: {
    id: 'card-4',
    title: 'Task List Card',
    content: `
      <h3>Shopping List</h3>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false">
          <input type="checkbox" />
          <div>Milk</div>
        </li>
        <li data-type="taskItem" data-checked="true">
          <input type="checkbox" checked />
          <div>Bread</div>
        </li>
        <li data-type="taskItem" data-checked="false">
          <input type="checkbox" />
          <div>Eggs</div>
        </li>
      </ul>
    `,
    backContent: '',
    tags: ['tasks', 'shopping'],
    folderId: null,
    style: 'default',
    isFlipped: false,
    order: 3,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    userId: 'user-1',
    isLocalOnly: false,
    cloudSynced: true,
  },

  // 长内容卡片
  longCard: {
    id: 'card-5',
    title: 'Long Content Card',
    content: `
      <p>This is a card with very long content to test rendering performance and scrolling behavior.</p>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
      <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
      <img src="large-image.jpg" alt="Large image" />
      <p>More content continues here...</p>
    `,
    backContent: '<p>Additional long content on the back side.</p>',
    tags: ['long', 'performance'],
    folderId: null,
    style: 'gradient-purple',
    isFlipped: false,
    order: 4,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    userId: 'user-1',
    isLocalOnly: false,
    cloudSynced: true,
  },
}

export const folderFixtures = {
  // 根文件夹
  rootFolder: {
    id: 'folder-1',
    name: 'Root Folder',
    parentId: null,
    userId: 'user-1',
    order: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isLocalOnly: false,
    cloudSynced: true,
  },

  // 子文件夹
  subFolder: {
    id: 'folder-2',
    name: 'Sub Folder',
    parentId: 'folder-1',
    userId: 'user-1',
    order: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isLocalOnly: false,
    cloudSynced: true,
  },

  // 深层嵌套文件夹
  deepFolder: {
    id: 'folder-3',
    name: 'Deep Nested Folder',
    parentId: 'folder-2',
    userId: 'user-1',
    order: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isLocalOnly: false,
    cloudSynced: true,
  },

  // 空文件夹
  emptyFolder: {
    id: 'folder-4',
    name: 'Empty Folder',
    parentId: null,
    userId: 'user-1',
    order: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isLocalOnly: false,
    cloudSynced: true,
  },
}

export const tagFixtures = {
  // 基础标签
  basicTag: {
    id: 'tag-1',
    name: 'Basic',
    color: '#3b82f6',
    userId: 'user-1',
    count: 5,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },

  // 工作标签
  workTag: {
    id: 'tag-2',
    name: 'Work',
    color: '#ef4444',
    userId: 'user-1',
    count: 10,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },

  // 个人标签
  personalTag: {
    id: 'tag-3',
    name: 'Personal',
    color: '#10b981',
    userId: 'user-1',
    count: 8,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },

  // 重要标签
  importantTag: {
    id: 'tag-4',
    name: 'Important',
    color: '#f59e0b',
    userId: 'user-1',
    count: 3,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
}

export const syncFixtures = {
  // 创建操作
  createOperation: {
    id: 'sync-1',
    operation: 'create' as const,
    entityType: 'card' as const,
    entityId: 'card-1',
    data: cardFixtures.textCard,
    timestamp: '2024-01-01T00:00:00Z',
    retryCount: 0,
    status: 'pending' as const,
    error: null,
  },

  // 更新操作
  updateOperation: {
    id: 'sync-2',
    operation: 'update' as const,
    entityType: 'card' as const,
    entityId: 'card-1',
    data: { title: 'Updated Title' },
    timestamp: '2024-01-01T00:01:00Z',
    retryCount: 0,
    status: 'pending' as const,
    error: null,
  },

  // 删除操作
  deleteOperation: {
    id: 'sync-3',
    operation: 'delete' as const,
    entityType: 'card' as const,
    entityId: 'card-1',
    data: {},
    timestamp: '2024-01-01T00:02:00Z',
    retryCount: 0,
    status: 'pending' as const,
    error: null,
  },

  // 失败操作
  failedOperation: {
    id: 'sync-4',
    operation: 'create' as const,
    entityType: 'card' as const,
    entityId: 'card-1',
    data: cardFixtures.textCard,
    timestamp: '2024-01-01T00:00:00Z',
    retryCount: 3,
    status: 'failed' as const,
    error: 'Network error',
  },
}

// 批量数据生成器
export const bulkDataFixtures = {
  // 生成多个卡片
  generateCards: (count: number, overrides?: Partial<typeof cardFixtures.textCard>) => {
    return Array.from({ length: count }, (_, index) => ({
      ...cardFixtures.textCard,
      id: `card-${index + 1}`,
      title: `Card ${index + 1}`,
      order: index,
      ...overrides,
    }))
  },

  // 生成多个文件夹
  generateFolders: (count: number, parentId?: string) => {
    return Array.from({ length: count }, (_, index) => ({
      ...folderFixtures.rootFolder,
      id: `folder-${index + 1}`,
      name: `Folder ${index + 1}`,
      parentId: parentId || null,
      order: index,
    }))
  },

  // 生成多个标签
  generateTags: (count: number) => {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']
    return Array.from({ length: count }, (_, index) => ({
      ...tagFixtures.basicTag,
      id: `tag-${index + 1}`,
      name: `Tag ${index + 1}`,
      color: colors[index % colors.length],
    }))
  },

  // 生成多个同步操作
  generateSyncOperations: (count: number, operationType: 'create' | 'update' | 'delete' = 'create') => {
    return Array.from({ length: count }, (_, index) => ({
      ...syncFixtures.createOperation,
      id: `sync-${index + 1}`,
      operation: operationType,
      entityId: `card-${index + 1}`,
      timestamp: new Date(Date.now() + index * 1000).toISOString(),
    }))
  },
}

// 场景数据
export const scenarioFixtures = {
  // 简单用户场景
  simpleUserScenario: {
    user: userFixtures.basicUser,
    cards: [cardFixtures.textCard, cardFixtures.imageCard],
    folders: [folderFixtures.rootFolder],
    tags: [tagFixtures.basicTag, tagFixtures.personalTag],
  },

  // 高级用户场景
  advancedUserScenario: {
    user: userFixtures.premiumUser,
    cards: bulkDataFixtures.generateCards(20),
    folders: [
      folderFixtures.rootFolder,
      folderFixtures.subFolder,
      folderFixtures.deepFolder,
    ],
    tags: bulkDataFixtures.generateTags(10),
  },

  // 同步问题场景
  syncProblemScenario: {
    user: userFixtures.basicUser,
    cards: [cardFixtures.textCard],
    syncQueue: [
      syncFixtures.failedOperation,
      syncFixtures.createOperation,
      syncFixtures.updateOperation,
    ],
  },

  // 性能测试场景
  performanceScenario: {
    user: userFixtures.basicUser,
    cards: bulkDataFixtures.generateCards(100),
    folders: bulkDataFixtures.generateFolders(20, 'folder-1'),
    tags: bulkDataFixtures.generateTags(50),
  },
}

// 导出所有夹具
export {
  userFixtures,
  cardFixtures,
  folderFixtures,
  tagFixtures,
  syncFixtures,
  bulkDataFixtures,
  scenarioFixtures,
}