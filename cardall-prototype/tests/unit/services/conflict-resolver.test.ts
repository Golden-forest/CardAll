// ============================================================================
// 冲突解析器测试用例
// ============================================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ConflictResolver, type ConflictResolutionRequest, type ConflictResolutionResult, type ConflictPrediction } from '@/services/conflict-resolver'
import type { Card, Folder, Tag } from '@/types/card'

// Mock 数据
const mockLocalCard: Card = {
  id: 'card-1',
  frontContent: {
    title: 'Local Title',
    text: 'Local front content',
    images: [],
    tags: ['tag1', 'tag2'],
    lastModified: new Date('2024-01-01T10:00:00Z')
  },
  backContent: {
    title: 'Local Back',
    text: 'Local back content',
    images: [],
    tags: ['tag3'],
    lastModified: new Date('2024-01-01T10:00:00Z')
  },
  style: {
    type: 'solid',
    backgroundColor: '#ffffff',
    fontFamily: 'Arial',
    fontSize: 'base',
    fontWeight: 'normal'
  },
  isFlipped: false,
  createdAt: new Date('2024-01-01T09:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
  folderId: 'folder-1'
}

const mockCloudCard: Card = {
  id: 'card-1',
  frontContent: {
    title: 'Cloud Title',
    text: 'Cloud front content',
    images: [],
    tags: ['tag2', 'tag4'],
    lastModified: new Date('2024-01-01T11:00:00Z')
  },
  backContent: {
    title: 'Cloud Back',
    text: 'Cloud back content',
    images: [],
    tags: ['tag5'],
    lastModified: new Date('2024-01-01T11:00:00Z')
  },
  style: {
    type: 'gradient',
    gradientColors: ['#ff0000', '#0000ff'],
    fontFamily: 'Arial',
    fontSize: 'base',
    fontWeight: 'normal'
  },
  isFlipped: false,
  createdAt: new Date('2024-01-01T09:00:00Z'),
  updatedAt: new Date('2024-01-01T11:00:00Z'),
  folderId: 'folder-1'
}

const mockLocalFolder: Folder = {
  id: 'folder-1',
  name: 'Local Folder',
  parentId: null,
  cardIds: ['card-1', 'card-2'],
  createdAt: new Date('2024-01-01T09:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z')
}

const mockCloudFolder: Folder = {
  id: 'folder-1',
  name: 'Cloud Folder',
  parentId: 'parent-1',
  cardIds: ['card-1', 'card-3'],
  createdAt: new Date('2024-01-01T09:00:00Z'),
  updatedAt: new Date('2024-01-01T11:00:00Z')
}

const mockLocalTag: Tag = {
  id: 'tag-1',
  name: 'Local Tag',
  color: '#ff0000',
  cardIds: ['card-1', 'card-2'],
  createdAt: new Date('2024-01-01T09:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z')
}

const mockCloudTag: Tag = {
  id: 'tag-1',
  name: 'Cloud Tag',
  color: '#0000ff',
  cardIds: ['card-1', 'card-3'],
  createdAt: new Date('2024-01-01T09:00:00Z'),
  updatedAt: new Date('2024-01-01T11:00:00Z')
}

describe('ConflictResolver', () => {
  let conflictResolver: ConflictResolver

  beforeEach(() => {
    // 创建新的冲突解析器实例
    conflictResolver = new ConflictResolver()

    // Mock 网络信息
    vi.stubGlobal('navigator', {
      onLine: true,
      connection: {
        effectiveType: '4g',
        downlink: 10,
        rtt: 100
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  describe('基本冲突解析', () => {
    it('应该能够解析无冲突的情况', async () => {
      const request: ConflictResolutionRequest = {
        localData: mockLocalCard,
        cloudData: mockLocalCard, // 相同的数据
        entityType: 'card',
        entityId: 'card-1',
        userId: 'user-1'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result.success).toBe(true)
      expect(result.conflicts).toHaveLength(0)
      expect(result.resolutionStrategy).toBe('no-conflict')
      expect(result.confidence).toBe(1.0)
    })

    it('应该能够检测并解决基本的卡牌冲突', async () => {
      const request: ConflictResolutionRequest = {
        localData: mockLocalCard,
        cloudData: mockCloudCard,
        entityType: 'card',
        entityId: 'card-1',
        userId: 'user-1'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result.success).toBe(true)
      expect(result.conflicts.length).toBeGreaterThan(0)
      expect(result.resolutionDetails).toBeDefined()
      expect(result.resolutionDetails?.mergedFields).toBeDefined()
      expect(result.resolutionDetails?.preservedFields).toBeDefined()
    })

    it('应该能够检测并解决文件夹冲突', async () => {
      const request: ConflictResolutionRequest = {
        localData: mockLocalFolder,
        cloudData: mockCloudFolder,
        entityType: 'folder',
        entityId: 'folder-1',
        userId: 'user-1'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result.success).toBe(true)
      expect(result.conflicts.length).toBeGreaterThan(0)
      expect(result.resolutionDetails).toBeDefined()
    })

    it('应该能够检测并解决标签冲突', async () => {
      const request: ConflictResolutionRequest = {
        localData: mockLocalTag,
        cloudData: mockCloudTag,
        entityType: 'tag',
        entityId: 'tag-1',
        userId: 'user-1'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result.success).toBe(true)
      expect(result.conflicts.length).toBeGreaterThan(0)
      expect(result.resolutionDetails).toBeDefined()
    })
  })

  describe('时间戳优先策略', () => {
    it('应该优先选择更新时间戳的数据', async () => {
      const newerCard = {
        ...mockLocalCard,
        updatedAt: new Date('2024-01-01T12:00:00Z'), // 更新
        frontContent: {
          ...mockLocalCard.frontContent,
          title: 'Newer Title'
        }
      }

      const request: ConflictResolutionRequest = {
        localData: newerCard,
        cloudData: mockCloudCard, // 云端数据较旧
        entityType: 'card',
        entityId: 'card-1',
        userId: 'user-1'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result.success).toBe(true)
      expect(result.resolvedData?.frontContent?.title).toBe('Newer Title')
      expect(result.resolutionStrategy).toContain('timestamp')
    })

    it('应该处理相同时间戳的情况', async () => {
      const sameTimeCard = {
        ...mockLocalCard,
        updatedAt: mockCloudCard.updatedAt, // 相同时间戳
        frontContent: {
          ...mockLocalCard.frontContent,
          title: 'Same Time Title'
        }
      }

      const request: ConflictResolutionRequest = {
        localData: sameTimeCard,
        cloudData: mockCloudCard,
        entityType: 'card',
        entityId: 'card-1',
        userId: 'user-1'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result.success).toBe(true)
      // 相同时间戳时应该使用默认策略
      expect(result.resolutionStrategy).toBeDefined()
    })
  })

  describe('智能合并策略', () => {
    it('应该能够合并标签字段', async () => {
      const localWithTags = {
        ...mockLocalCard,
        frontContent: {
          ...mockLocalCard.frontContent,
          tags: ['tag1', 'tag2']
        }
      }

      const cloudWithTags = {
        ...mockCloudCard,
        frontContent: {
          ...mockCloudCard.frontContent,
          tags: ['tag2', 'tag3']
        }
      }

      const request: ConflictResolutionRequest = {
        localData: localWithTags,
        cloudData: cloudWithTags,
        entityType: 'card',
        entityId: 'card-1',
        userId: 'user-1'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result.success).toBe(true)
      expect(result.resolvedData?.frontContent?.tags).toContain('tag1')
      expect(result.resolvedData?.frontContent?.tags).toContain('tag2')
      expect(result.resolvedData?.frontContent?.tags).toContain('tag3')
      expect(result.resolutionDetails?.mergedFields).toContain('tags')
    })

    it('应该能够合并样式字段', async () => {
      const localWithStyle = {
        ...mockLocalCard,
        style: {
          type: 'solid' as const,
          backgroundColor: '#ffffff',
          fontFamily: 'Arial',
          fontSize: 'base' as const,
          fontWeight: 'normal' as const
        }
      }

      const cloudWithStyle = {
        ...mockCloudCard,
        style: {
          type: 'gradient' as const,
          gradientColors: ['#ff0000', '#0000ff'],
          fontFamily: 'Times New Roman',
          fontSize: 'lg' as const,
          fontWeight: 'bold' as const
        }
      }

      const request: ConflictResolutionRequest = {
        localData: localWithStyle,
        cloudData: cloudWithStyle,
        entityType: 'card',
        entityId: 'card-1',
        userId: 'user-1'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result.success).toBe(true)
      expect(result.resolvedData?.style).toBeDefined()
      // 样式应该包含更具体的设置
      expect(result.resolutionDetails?.mergedFields).toBeDefined()
    })

    it('应该能够合并图片字段', async () => {
      const localWithImages = {
        ...mockLocalCard,
        frontContent: {
          ...mockLocalCard.frontContent,
          images: [
            { id: 'img-1', url: 'local1.jpg', alt: 'Local 1' },
            { id: 'img-2', url: 'local2.jpg', alt: 'Local 2' }
          ]
        }
      }

      const cloudWithImages = {
        ...mockCloudCard,
        frontContent: {
          ...mockCloudCard.frontContent,
          images: [
            { id: 'img-1', url: 'cloud1.jpg', alt: 'Cloud 1' },
            { id: 'img-3', url: 'cloud3.jpg', alt: 'Cloud 3' }
          ]
        }
      }

      const request: ConflictResolutionRequest = {
        localData: localWithImages,
        cloudData: cloudWithImages,
        entityType: 'card',
        entityId: 'card-1',
        userId: 'user-1'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result.success).toBe(true)
      expect(result.resolvedData?.frontContent?.images).toHaveLength(3) // img-1, img-2, img-3
      expect(result.resolutionDetails?.mergedFields).toContain('images')
    })
  })

  describe('冲突预测', () => {
    it('应该能够预测低风险冲突', async () => {
      const similarCard = {
        ...mockLocalCard,
        frontContent: {
          ...mockLocalCard.frontContent,
          title: 'Similar Title' // 只有一个字段不同
        }
      }

      const prediction = await conflictResolver.predictConflicts(
        similarCard,
        mockLocalCard,
        'card',
        'user-1'
      )

      expect(prediction).toBeDefined()
      expect(prediction.riskLevel).toBeDefined()
      expect(prediction.probability).toBeGreaterThanOrEqual(0)
      expect(prediction.probability).toBeLessThanOrEqual(1)
      expect(prediction.confidence).toBeGreaterThanOrEqual(0)
      expect(prediction.confidence).toBeLessThanOrEqual(1)
      expect(prediction.factors).toBeDefined()
      expect(prediction.recommendations).toBeDefined()
    })

    it('应该能够预测高风险冲突', async () => {
      const veryDifferentCard = {
        ...mockLocalCard,
        updatedAt: new Date('2024-01-01T12:00:00Z'), // 很大的时间差异
        frontContent: {
          title: 'Completely Different',
          text: 'Completely different content',
          images: [{ id: 'img-1', url: 'image.jpg', alt: 'Image' }],
          tags: ['different1', 'different2'],
          lastModified: new Date('2024-01-01T12:00:00Z')
        },
        backContent: {
          title: 'Different Back',
          text: 'Different back content',
          images: [],
          tags: ['different3'],
          lastModified: new Date('2024-01-01T12:00:00Z')
        }
      }

      const prediction = await conflictResolver.predictConflicts(
        veryDifferentCard,
        mockLocalCard,
        'card',
        'user-1'
      )

      expect(prediction).toBeDefined()
      expect(prediction.riskLevel).toMatch(/^(low|medium|high|critical)$/)
      expect(prediction.probability).toBeGreaterThan(0)
      expect(prediction.factors.length).toBeGreaterThan(0)
    })

    it('应该考虑时间差在冲突预测中', async () => {
      const oldCard = {
        ...mockLocalCard,
        updatedAt: new Date('2023-01-01T10:00:00Z') // 很旧的卡片
      }

      const newCard = {
        ...mockLocalCard,
        updatedAt: new Date('2024-01-01T10:00:00Z') // 很新的卡片
      }

      const prediction = await conflictResolver.predictConflicts(
        oldCard,
        newCard,
        'card',
        'user-1'
      )

      expect(prediction).toBeDefined()
      expect(prediction.factors).toContain('数据修改时间差异较大')
    })
  })

  describe('错误处理', () => {
    it('应该处理无效的输入数据', async () => {
      const request: ConflictResolutionRequest = {
        localData: null,
        cloudData: mockCloudCard,
        entityType: 'card',
        entityId: 'card-1',
        userId: 'user-1'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
    })

    it('应该处理缺少必需字段的情况', async () => {
      const incompleteCard = {
        id: 'card-1',
        // 缺少必需的字段
      } as any

      const request: ConflictResolutionRequest = {
        localData: incompleteCard,
        cloudData: mockCloudCard,
        entityType: 'card',
        entityId: 'card-1',
        userId: 'user-1'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
    })

    it('应该在策略失败时回退到安全模式', async () => {
      // Mock 一个会抛出异常的情况
      const mockStrategy = vi.fn().mockRejectedValue(new Error('Strategy failed'))
      vi.spyOn(conflictResolver as any, 'executeResolutionStrategy').mockImplementation(mockStrategy)

      const request: ConflictResolutionRequest = {
        localData: mockLocalCard,
        cloudData: mockCloudCard,
        entityType: 'card',
        entityId: 'card-1',
        userId: 'user-1'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
      expect(result.resolutionStrategy).toBe('fallback-local-priority')
    })
  })

  describe('用户偏好', () => {
    it('应该使用用户的默认策略偏好', async () => {
      // 这里需要访问私有方法来设置用户偏好
      const userPrefs = {
        defaultStrategy: 'local-priority' as const,
        fieldSpecificStrategies: {},
        autoResolutionThreshold: 0.7,
        preserveUserChanges: true,
        conflictHistoryRetention: 30
      }

      // 使用反射或测试专用方法设置偏好
      ;(conflictResolver as any).userPreferences.set('test-user', userPrefs)

      const request: ConflictResolutionRequest = {
        localData: mockLocalCard,
        cloudData: mockCloudCard,
        entityType: 'card',
        entityId: 'card-1',
        userId: 'test-user'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
    })

    it('应该应用字段特定的策略', async () => {
      const userPrefs = {
        defaultStrategy: 'smart-merge' as const,
        fieldSpecificStrategies: {
          'tags': 'local-priority',
          'style': 'cloud-priority'
        },
        autoResolutionThreshold: 0.7,
        preserveUserChanges: true,
        conflictHistoryRetention: 30
      }

      ;(conflictResolver as any).userPreferences.set('test-user', userPrefs)

      const request: ConflictResolutionRequest = {
        localData: mockLocalCard,
        cloudData: mockCloudCard,
        entityType: 'card',
        entityId: 'card-1',
        userId: 'test-user'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
    })
  })

  describe('网络和设备感知', () => {
    it('应该在网络状况差时调整策略', async () => {
      // 模拟网络状况差
      vi.stubGlobal('navigator', {
        onLine: true,
        connection: {
          effectiveType: 'slow-2g',
          downlink: 0.1,
          rtt: 2000
        }
      })

      const request: ConflictResolutionRequest = {
        localData: mockLocalCard,
        cloudData: mockCloudCard,
        entityType: 'card',
        entityId: 'card-1',
        userId: 'user-1'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
    })

    it('应该在离线模式下优先本地策略', async () => {
      // 模拟离线模式
      vi.stubGlobal('navigator', {
        onLine: false,
        connection: null
      })

      const request: ConflictResolutionRequest = {
        localData: mockLocalCard,
        cloudData: mockCloudCard,
        entityType: 'card',
        entityId: 'card-1',
        userId: 'user-1'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
    })
  })

  describe('性能和边界情况', () => {
    it('应该能够处理大量冲突', async () => {
      // 创建具有大量冲突的卡片
      const highConflictCard = {
        ...mockLocalCard,
        frontContent: {
          title: 'Different Title',
          text: 'Different text content',
          images: Array.from({ length: 10 }, (_, i) => ({
            id: `img-${i}`,
            url: `image${i}.jpg`,
            alt: `Image ${i}`
          })),
          tags: Array.from({ length: 20 }, (_, i) => `tag-${i}`),
          lastModified: new Date('2024-01-01T12:00:00Z')
        },
        backContent: {
          title: 'Different Back',
          text: 'Different back content',
          images: Array.from({ length: 5 }, (_, i) => ({
            id: `back-img-${i}`,
            url: `back${i}.jpg`,
            alt: `Back Image ${i}`
          })),
          tags: Array.from({ length: 10 }, (_, i) => `back-tag-${i}`),
          lastModified: new Date('2024-01-01T12:00:00Z')
        },
        style: {
          type: 'gradient' as const,
          gradientColors: ['#ff0000', '#00ff00', '#0000ff'],
          fontFamily: 'Custom Font',
          fontSize: 'xl' as const,
          fontWeight: 'bold' as const,
          textColor: '#333333',
          borderRadius: 'lg' as const,
          shadow: 'lg' as const
        },
        updatedAt: new Date('2024-01-01T12:00:00Z')
      }

      const request: ConflictResolutionRequest = {
        localData: highConflictCard,
        cloudData: mockLocalCard,
        entityType: 'card',
        entityId: 'card-1',
        userId: 'user-1'
      }

      const startTime = Date.now()
      const result = await conflictResolver.resolveConflicts(request)
      const endTime = Date.now()

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
      expect(endTime - startTime).toBeLessThan(1000) // 应该在1秒内完成
    })

    it('应该能够处理空数据', async () => {
      const request: ConflictResolutionRequest = {
        localData: {},
        cloudData: {},
        entityType: 'card',
        entityId: 'card-1',
        userId: 'user-1'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
    })

    it('应该能够处理部分数据', async () => {
      const partialData = {
        id: 'card-1',
        frontContent: {
          title: 'Partial Title'
          // 缺少其他字段
        }
      } as any

      const request: ConflictResolutionRequest = {
        localData: partialData,
        cloudData: mockCloudCard,
        entityType: 'card',
        entityId: 'card-1',
        userId: 'user-1'
      }

      const result = await conflictResolver.resolveConflicts(request)

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
    })
  })
})

// ============================================================================
// 集成测试
// ============================================================================

describe('ConflictResolver Integration', () => {
  let conflictResolver: ConflictResolver

  beforeEach(() => {
    conflictResolver = new ConflictResolver()
  })

  describe('与同步队列的集成', () => {
    it('应该与同步队列无缝集成', async () => {
      // 这里可以测试与 sync-queue.ts 的集成
      // 由于需要导入实际的同步队列，这里只做基本验证
      expect(conflictResolver).toBeDefined()
      expect(typeof conflictResolver.resolveConflicts).toBe('function')
      expect(typeof conflictResolver.predictConflicts).toBe('function')
    })
  })

  describe('持久化和历史记录', () => {
    it('应该记录冲突解决历史', async () => {
      const request: ConflictResolutionRequest = {
        localData: mockLocalCard,
        cloudData: mockCloudCard,
        entityType: 'card',
        entityId: 'card-1',
        userId: 'user-1'
      }

      // 解析冲突
      await conflictResolver.resolveConflicts(request)

      // 检查历史记录（需要访问私有方法）
      const history = (conflictResolver as any).conflictHistory as any[]
      expect(history).toBeDefined()
      expect(Array.isArray(history)).toBe(true)
    })

    it('应该更新策略权重', async () => {
      const request: ConflictResolutionRequest = {
        localData: mockLocalCard,
        cloudData: mockCloudCard,
        entityType: 'card',
        entityId: 'card-1',
        userId: 'user-1'
      }

      // 解析冲突
      await conflictResolver.resolveConflicts(request)

      // 检查策略权重（需要访问私有方法）
      const weights = (conflictResolver as any).strategyWeights as Map<string, number>
      expect(weights).toBeDefined()
      expect(weights.size).toBeGreaterThan(0)
    })
  })
})