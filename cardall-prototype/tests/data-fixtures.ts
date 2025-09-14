// 数据测试装置 - 提供标准化的测试数据
import { TestDataGenerator } from './advanced-test-utils'
import type { TestCardData, TestFolderData, TestTagData, TestSyncOperation } from './advanced-test-utils'

// 重新导出TestDataGenerator确保可用
export { TestDataGenerator }

// ============================================================================
// 预定义的测试数据集
// ============================================================================

export const TEST_USERS = {
  basic: {
    id: 'user-basic',
    email: 'basic@example.com',
    name: 'Basic User',
    avatar: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  premium: {
    id: 'user-premium',
    email: 'premium@example.com',
    name: 'Premium User',
    avatar: 'https://example.com/avatar.png',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  admin: {
    id: 'user-admin',
    email: 'admin@example.com',
    name: 'Admin User',
    avatar: 'https://example.com/admin.png',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
}

export const TEST_CARD_STYLES = {
  solid: {
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
  gradient: {
    type: 'gradient' as const,
    gradientColors: ['#667eea', '#764ba2'],
    gradientDirection: 'to-br' as const,
    fontFamily: 'system-ui',
    fontSize: 'base' as const,
    fontWeight: 'medium' as const,
    textColor: '#ffffff',
    borderRadius: 'xl' as const,
    shadow: 'lg' as const,
    borderWidth: 0,
  },
  glass: {
    type: 'glass' as const,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    fontFamily: 'system-ui',
    fontSize: 'base' as const,
    fontWeight: 'normal' as const,
    textColor: '#ffffff',
    borderRadius: 'xl' as const,
    shadow: 'glass' as const,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
}

export const TEST_IMAGES = [
  {
    id: 'img-1',
    url: 'https://picsum.photos/seed/card1/400/300.jpg',
    alt: 'Test image 1',
    width: 400,
    height: 300,
    aspectRatio: 1.33,
  },
  {
    id: 'img-2',
    url: 'https://picsum.photos/seed/card2/300/400.jpg',
    alt: 'Test image 2',
    width: 300,
    height: 400,
    aspectRatio: 0.75,
  },
  {
    id: 'img-3',
    url: 'https://picsum.photos/seed/card3/500/500.jpg',
    alt: 'Test image 3',
    width: 500,
    height: 500,
    aspectRatio: 1,
  },
]

export const TEST_TAGS = [
  { name: '重要', color: '#ef4444', count: 5 },
  { name: '工作', color: '#3b82f6', count: 8 },
  { name: '个人', color: '#10b981', count: 3 },
  { name: '学习', color: '#f59e0b', count: 6 },
  { name: '项目', color: '#8b5cf6', count: 4 },
  { name: '灵感', color: '#ec4899', count: 2 },
  { name: '待办', color: '#6b7280', count: 7 },
  { name: '完成', color: '#059669', count: 12 },
]

// ============================================================================
// 测试数据生成器函数
// ============================================================================

export class CardFixture {
  static basic(overrides: Partial<TestCardData> = {}): TestCardData {
    return TestDataGenerator.generateCard({
      frontContent: {
        title: '基础测试卡片',
        text: '这是一个基础的测试卡片，用于测试基本功能。',
        images: [],
        tags: ['测试'],
        lastModified: new Date(),
      },
      backContent: {
        title: '卡片背面',
        text: '这是卡片的背面内容。',
        images: [],
        tags: [],
        lastModified: new Date(),
      },
      style: TEST_CARD_STYLES.solid,
      isFlipped: false,
      ...overrides,
    })
  }

  static withImages(overrides: Partial<TestCardData> = {}): TestCardData {
    return TestDataGenerator.generateCard({
      frontContent: {
        title: '带图片的卡片',
        text: '这是一个包含图片的测试卡片。',
        images: [TEST_IMAGES[0], TEST_IMAGES[1]],
        tags: ['图片', '测试'],
        lastModified: new Date(),
      },
      backContent: {
        title: '背面内容',
        text: '背面的图片内容。',
        images: [TEST_IMAGES[2]],
        tags: [],
        lastModified: new Date(),
      },
      style: TEST_CARD_STYLES.gradient,
      isFlipped: false,
      ...overrides,
    })
  }

  static withTags(overrides: Partial<TestCardData> = {}): TestCardData {
    return TestDataGenerator.generateCard({
      frontContent: {
        title: '多标签卡片',
        text: '这是一个包含多个标签的测试卡片。',
        images: [],
        tags: ['重要', '工作', '项目'],
        lastModified: new Date(),
      },
      backContent: {
        title: '背面内容',
        text: '卡片的背面内容。',
        images: [],
        tags: [],
        lastModified: new Date(),
      },
      style: TEST_CARD_STYLES.solid,
      isFlipped: false,
      ...overrides,
    })
  }

  static glassStyle(overrides: Partial<TestCardData> = {}): TestCardData {
    return TestDataGenerator.generateCard({
      frontContent: {
        title: '玻璃风格卡片',
        text: '这是一个玻璃风格的测试卡片。',
        images: [],
        tags: ['设计', 'UI'],
        lastModified: new Date(),
      },
      backContent: {
        title: '背面内容',
        text: '玻璃风格背面。',
        images: [],
        tags: [],
        lastModified: new Date(),
      },
      style: TEST_CARD_STYLES.glass,
      isFlipped: false,
      ...overrides,
    })
  }

  static flipped(overrides: Partial<TestCardData> = {}): TestCardData {
    return TestDataGenerator.generateCard({
      frontContent: {
        title: '已翻转的卡片',
        text: '这是一个默认已翻转的测试卡片。',
        images: [],
        tags: ['状态'],
        lastModified: new Date(),
      },
      backContent: {
        title: '背面内容',
        text: '这是卡片的背面内容，现在是可见的。',
        images: [],
        tags: [],
        lastModified: new Date(),
      },
      style: TEST_CARD_STYLES.solid,
      isFlipped: true,
      ...overrides,
    })
  }

  static inFolder(folderId: string, overrides: Partial<TestCardData> = {}): TestCardData {
    return TestDataGenerator.generateCard({
      frontContent: {
        title: '文件夹中的卡片',
        text: '这是一个位于特定文件夹中的测试卡片。',
        images: [],
        tags: ['文件夹'],
        lastModified: new Date(),
      },
      backContent: {
        title: '背面内容',
        text: '文件夹卡片背面。',
        images: [],
        tags: [],
        lastModified: new Date(),
      },
      style: TEST_CARD_STYLES.solid,
      isFlipped: false,
      folderId,
      ...overrides,
    })
  }

  static selected(overrides: Partial<TestCardData> = {}): TestCardData {
    return TestDataGenerator.generateCard({
      frontContent: {
        title: '已选择的卡片',
        text: '这是一个被选择的测试卡片。',
        images: [],
        tags: ['选择'],
        lastModified: new Date(),
      },
      backContent: {
        title: '背面内容',
        text: '选择状态卡片背面。',
        images: [],
        tags: [],
        lastModified: new Date(),
      },
      style: TEST_CARD_STYLES.solid,
      isFlipped: false,
      isSelected: true,
      ...overrides,
    })
  }

  static list(count: number, overrides?: Partial<TestCardData>): TestCardData[] {
    return Array.from({ length: count }, (_, i) => 
      this.basic({
        ...overrides,
        id: `card-${i + 1}`,
        frontContent: {
          title: `测试卡片 ${i + 1}`,
          text: `这是第 ${i + 1} 个测试卡片。`,
          images: [],
          tags: [`标签-${i + 1}`],
          lastModified: new Date(),
        },
      })
    )
  }
}

export class FolderFixture {
  static basic(overrides: Partial<TestFolderData> = {}): TestFolderData {
    return TestDataGenerator.generateFolder({
      name: '测试文件夹',
      color: '#3b82f6',
      cardIds: [],
      ...overrides,
    })
  }

  static withCards(cardIds: string[], overrides: Partial<TestFolderData> = {}): TestFolderData {
    return TestDataGenerator.generateFolder({
      name: '包含卡片的文件夹',
      color: '#10b981',
      cardIds,
      ...overrides,
    })
  }

  static nested(parentId: string, overrides: Partial<TestFolderData> = {}): TestFolderData {
    return TestDataGenerator.generateFolder({
      name: '子文件夹',
      color: '#f59e0b',
      cardIds: [],
      parentId,
      ...overrides,
    })
  }

  static expanded(overrides: Partial<TestFolderData> = {}): TestFolderData {
    return TestDataGenerator.generateFolder({
      name: '展开的文件夹',
      color: '#8b5cf6',
      cardIds: [],
      isExpanded: true,
      ...overrides,
    })
  }

  static list(count: number, overrides?: Partial<TestFolderData>): TestFolderData[] {
    return Array.from({ length: count }, (_, i) => 
      this.basic({
        ...overrides,
        id: `folder-${i + 1}`,
        name: `测试文件夹 ${i + 1}`,
        color: TEST_TAGS[i % TEST_TAGS.length].color,
      })
    )
  }
}

export class TagFixture {
  static basic(overrides: Partial<TestTagData> = {}): TestTagData {
    return TestDataGenerator.generateTag({
      name: '测试标签',
      color: '#3b82f6',
      count: 0,
      ...overrides,
    })
  }

  static withCount(count: number, overrides: Partial<TestTagData> = {}): TestTagData {
    return TestDataGenerator.generateTag({
      name: `标签 (${count})`,
      color: '#10b981',
      count,
      ...overrides,
    })
  }

  static hidden(overrides: Partial<TestTagData> = {}): TestTagData {
    return TestDataGenerator.generateTag({
      name: '隐藏标签',
      color: '#6b7280',
      count: 0,
      isHidden: true,
      ...overrides,
    })
  }

  static list(): TestTagData[] {
    return TEST_TAGS.map((tag, i) => 
      this.basic({
        id: `tag-${i + 1}`,
        name: tag.name,
        color: tag.color,
        count: tag.count,
      })
    )
  }
}

export class SyncOperationFixture {
  static createCard(cardId: string, overrides: Partial<TestSyncOperation> = {}): TestSyncOperation {
    return TestDataGenerator.generateSyncOperation({
      type: 'create',
      entity: 'card',
      entityId: cardId,
      priority: 'normal',
      ...overrides,
    })
  }

  static updateCard(cardId: string, overrides: Partial<TestSyncOperation> = {}): TestSyncOperation {
    return TestDataGenerator.generateSyncOperation({
      type: 'update',
      entity: 'card',
      entityId: cardId,
      priority: 'normal',
      ...overrides,
    })
  }

  static deleteCard(cardId: string, overrides: Partial<TestSyncOperation> = {}): TestSyncOperation {
    return TestDataGenerator.generateSyncOperation({
      type: 'delete',
      entity: 'card',
      entityId: cardId,
      priority: 'high',
      ...overrides,
    })
  }

  static createFolder(folderId: string, overrides: Partial<TestSyncOperation> = {}): TestSyncOperation {
    return TestDataGenerator.generateSyncOperation({
      type: 'create',
      entity: 'folder',
      entityId: folderId,
      priority: 'normal',
      ...overrides,
    })
  }

  static failed(overrides: Partial<TestSyncOperation> = {}): TestSyncOperation {
    return TestDataGenerator.generateSyncOperation({
      status: 'failed',
      retryCount: 3,
      error: 'Network error occurred',
      ...overrides,
    })
  }

  static processing(overrides: Partial<TestSyncOperation> = {}): TestSyncOperation {
    return TestDataGenerator.generateSyncOperation({
      status: 'processing',
      ...overrides,
    })
  }

  static completed(overrides: Partial<TestSyncOperation> = {}): TestSyncOperation {
    return TestDataGenerator.generateSyncOperation({
      status: 'completed',
      ...overrides,
    })
  }

  static withDependencies(dependencies: string[], overrides: Partial<TestSyncOperation> = {}): TestSyncOperation {
    return TestDataGenerator.generateSyncOperation({
      dependencies,
      ...overrides,
    })
  }
}

// ============================================================================
// 测试场景数据集
// ============================================================================

export const TEST_SCENARIOS = {
  // 空状态场景
  empty: {
    cards: [],
    folders: [],
    tags: [],
    syncOperations: [],
  },

  // 基础使用场景
  basicUsage: {
    cards: CardFixture.list(3),
    folders: FolderFixture.list(2),
    tags: TagFixture.list().slice(0, 4),
    syncOperations: [],
  },

  // 大数据量场景
  largeDataset: {
    cards: CardFixture.list(100),
    folders: FolderFixture.list(20),
    tags: TagFixture.list(),
    syncOperations: Array.from({ length: 50 }, (_, i) => 
      SyncOperationFixture.createCard(`card-${i + 1}`)
    ),
  },

  // 文件夹嵌套场景
  nestedFolders: {
    cards: CardFixture.list(10),
    folders: [
      ...FolderFixture.list(3),
      FolderFixture.nested('folder-1'),
      FolderFixture.nested('folder-1'),
      FolderFixture.nested('folder-2'),
    ],
    tags: TagFixture.list().slice(0, 5),
    syncOperations: [],
  },

  // 标签丰富场景
  richTags: {
    cards: CardFixture.list(5).map((card, i) => ({
      ...card,
      frontContent: {
        ...card.frontContent,
        tags: [`标签-${i + 1}`, `共享标签`],
      },
    })),
    folders: FolderFixture.list(2),
    tags: TagFixture.list(),
    syncOperations: [],
  },

  // 同步队列场景
  syncQueue: {
    cards: CardFixture.list(5),
    folders: FolderFixture.list(2),
    tags: TagFixture.list().slice(0, 3),
    syncOperations: [
      SyncOperationFixture.createCard('card-1'),
      SyncOperationFixture.updateCard('card-2'),
      SyncOperationFixture.failed(),
      SyncOperationFixture.processing(),
      SyncOperationFixture.completed(),
    ],
  },

  // 混合状态场景
  mixedStates: {
    cards: [
      CardFixture.basic(),
      CardFixture.flipped(),
      CardFixture.selected(),
      CardFixture.inFolder('folder-1'),
      CardFixture.withImages(),
    ],
    folders: [
      FolderFixture.basic(),
      FolderFixture.expanded(),
      FolderFixture.withCards(['card-1', 'card-2']),
    ],
    tags: TagFixture.list().slice(0, 4),
    syncOperations: [
      SyncOperationFixture.createCard('card-1'),
      SyncOperationFixture.withDependencies(['sync-1']),
    ],
  },
}

// ============================================================================
// 边界值测试数据
// ============================================================================

export const BOUNDARY_TEST_DATA = {
  // 空字符串和null值
  emptyStrings: {
    card: CardFixture.basic({
      frontContent: {
        title: '',
        text: '',
        images: [],
        tags: [],
        lastModified: new Date(),
      },
    }),
    folder: FolderFixture.basic({ name: '' }),
    tag: TagFixture.basic({ name: '' }),
  },

  // 超长字符串
  longStrings: {
    card: CardFixture.basic({
      frontContent: {
        title: 'A'.repeat(1000),
        text: 'B'.repeat(10000),
        images: [],
        tags: ['C'.repeat(100)],
        lastModified: new Date(),
      },
    }),
  },

  // 最大边界值
  maxValues: {
    card: CardFixture.basic({
      frontContent: {
        title: 'Max',
        text: 'Max content',
        images: Array.from({ length: 100 }, (_, i) => ({
          ...TEST_IMAGES[0],
          id: `img-${i}`,
        })),
        tags: Array.from({ length: 50 }, (_, i) => `tag-${i}`),
        lastModified: new Date(),
      },
    }),
  },

  // 特殊字符
  specialChars: {
    card: CardFixture.basic({
      frontContent: {
        title: 'Special: @#$%^&*()_+',
        text: 'Content with emoji: 😊 🎉 🚀',
        images: [],
        tags: ['特殊标签', 'Special Tag'],
        lastModified: new Date(),
      },
    }),
  },

  // Unicode字符
  unicode: {
    card: CardFixture.basic({
      frontContent: {
        title: '中文测试',
        text: 'This is a mix of 中文, English, and 日本語',
        images: [],
        tags: ['中文', 'English', '日本語'],
        lastModified: new Date(),
      },
    }),
  },
}

// ============================================================================
// 导出已在文件开头完成，避免重复导出
// ============================================================================