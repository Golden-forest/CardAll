/**
 * LocalOperationService 准确单元测试
 * 基于实际API接口的测试
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { LocalOperationServiceOptimized } from '../../services/local-operation-service'

// 创建准确的Mock数据
const createMockCard = () => ({
  frontContent: {
    title: '测试卡片',
    text: '正面内容',
    tags: ['测试标签'],
    style: { backgroundColor: '#ffffff' }
  },
  backContent: {
    title: '背面标题',
    text: '背面内容',
    tags: ['背面标签'],
    style: { backgroundColor: '#f0f0f0' }
  },
  style: {
    type: 'solid' as const,
    colors: ['#ffffff', '#f0f0f0']
  },
  folderId: crypto.randomUUID(),
  userId: 'test-user'
})

const createMockDbCard = () => ({
  id: crypto.randomUUID(),
  frontContent: {
    title: '测试卡片',
    text: '正面内容',
    tags: ['测试标签'],
    style: { backgroundColor: '#ffffff' }
  },
  backContent: {
    title: '背面标题',
    text: '背面内容',
    tags: ['背面标签'],
    style: { backgroundColor: '#f0f0f0' }
  },
  style: {
    type: 'solid' as const,
    colors: ['#ffffff', '#f0f0f0']
  },
  folderId: crypto.randomUUID(),
  userId: 'test-user',
  createdAt: new Date(),
  updatedAt: new Date(),
  isDeleted: false,
  version: 1
})

// 模拟数据库
jest.mock('../../services/database-unified', () => {
  const mockDb = {
    cards: {
      add: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      where: jest.fn(),
      toArray: jest.fn(),
      bulkAdd: jest.fn(),
      bulkPut: jest.fn(),
      bulkDelete: jest.fn()
    },
    folders: {
      add: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      where: jest.fn(),
      toArray: jest.fn()
    },
    tags: {
      add: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      where: jest.fn(),
      toArray: jest.fn()
    },
    cardTags: {
      add: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      where: jest.fn(),
      toArray: jest.fn()
    },
    syncOperations: {
      add: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      where: jest.fn(),
      toArray: jest.fn()
    }
  }
  return { db: mockDb }
})

describe('LocalOperationServiceOptimized', () => {
  let service: LocalOperationServiceOptimized
  let mockDb: any

  beforeEach(() => {
    // 重置服务实例
    service = new LocalOperationServiceOptimized()
    
    // 获取模拟数据库
    const { db } = require('../../services/database-unified')
    mockDb = db
    
    // 清理所有模拟
    jest.clearAllMocks()
  })

  afterEach(() => {
    // 清理服务
    if (service.destroy) {
      service.destroy()
    }
  })

  // ============================================================================
  // 初始化测试
  // ============================================================================

  describe('初始化', () => {
    test('应该正确初始化服务', async () => {
      await service.initialize()
      expect(service).toBeInstanceOf(LocalOperationServiceOptimized)
    })
  })

  // ============================================================================
  // 卡片操作测试
  // ============================================================================

  describe('卡片操作', () => {
    test('应该成功创建卡片', async () => {
      const cardData = createMockCard()
      const cardId = crypto.randomUUID()
      
      // 模拟数据库返回
      mockDb.cards.add.mockResolvedValue(cardId)
      
      const result = await service.createCard(cardData)
      
      expect(result.success).toBe(true)
      expect(result.id).toBe(cardId)
      expect(result.duration).toBeGreaterThan(0)
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(mockDb.cards.add).toHaveBeenCalledWith(cardData)
    })

    test('应该成功读取卡片', async () => {
      const cardId = crypto.randomUUID()
      const mockCard = createMockDbCard()
      
      // 模拟数据库返回
      mockDb.cards.get.mockResolvedValue(mockCard)
      
      const result = await service.getCard(cardId)
      
      expect(result).toEqual(mockCard)
      expect(mockDb.cards.get).toHaveBeenCalledWith(cardId)
    })

    test('应该成功更新卡片', async () => {
      const cardId = crypto.randomUUID()
      const updateData = {
        frontContent: { title: '更新后的标题' }
      }
      
      // 模拟数据库返回
      mockDb.cards.update.mockResolvedValue(1)
      
      const result = await service.updateCard(cardId, updateData)
      
      expect(result.success).toBe(true)
      expect(result.duration).toBeGreaterThan(0)
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(mockDb.cards.update).toHaveBeenCalledWith(cardId, updateData)
    })

    test('应该成功删除卡片', async () => {
      const cardId = crypto.randomUUID()
      
      // 模拟数据库返回
      mockDb.cards.delete.mockResolvedValue(1)
      
      const result = await service.deleteCard(cardId)
      
      expect(result.success).toBe(true)
      expect(result.duration).toBeGreaterThan(0)
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(mockDb.cards.delete).toHaveBeenCalledWith(cardId)
    })

    test('应该处理数据库操作错误', async () => {
      const cardData = createMockCard()
      
      // 模拟数据库错误
      mockDb.cards.add.mockRejectedValue(new Error('数据库连接失败'))
      
      const result = await service.createCard(cardData)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('数据库连接失败')
      expect(result.duration).toBeGreaterThan(0)
      expect(result.timestamp).toBeInstanceOf(Date)
    })
  })

  // ============================================================================
  // 批量操作测试
  // ============================================================================

  describe('批量操作', () => {
    test('应该成功批量创建卡片', async () => {
      const cards = Array.from({ length: 5 }, () => createMockCard())
      const cardIds = cards.map(() => crypto.randomUUID())
      
      // 模拟数据库返回
      mockDb.cards.bulkAdd.mockResolvedValue(cardIds)
      
      const results = await service.bulkCreateCards(cards)
      
      expect(results).toHaveLength(5)
      expect(results.every(r => r.success)).toBe(true)
      expect(mockDb.cards.bulkAdd).toHaveBeenCalledWith(cards)
    })

    test('应该处理批量操作部分失败', async () => {
      const cards = Array.from({ length: 3 }, () => createMockCard())
      
      // 模拟数据库部分失败
      mockDb.cards.bulkAdd.mockRejectedValue(new Error('批量操作失败'))
      
      const results = await service.bulkCreateCards(cards)
      
      expect(results).toHaveLength(3)
      expect(results.every(r => r.success)).toBe(false)
    })
  })

  // ============================================================================
  // 查询操作测试
  // ============================================================================

  describe('查询操作', () => {
    test('应该成功查询卡片列表', async () => {
      const mockCards = Array.from({ length: 3 }, () => createMockDbCard())
      
      // 模拟数据库返回
      mockDb.cards.toArray.mockResolvedValue(mockCards)
      
      const result = await service.getCards()
      
      expect(result).toEqual(mockCards)
      expect(mockDb.cards.toArray).toHaveBeenCalled()
    })

    test('应该支持带选项的查询', async () => {
      const mockCards = Array.from({ length: 2 }, () => createMockDbCard())
      
      // 模拟数据库返回
      mockDb.cards.toArray.mockResolvedValue(mockCards)
      
      const options = { folderId: crypto.randomUUID() }
      const result = await service.getCards(options)
      
      expect(result).toEqual(mockCards)
      expect(mockDb.cards.toArray).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // 同步操作测试
  // ============================================================================

  describe('同步操作', () => {
    test('应该获取待同步操作', async () => {
      const mockOperations = Array.from({ length: 2 }, () => ({
        id: crypto.randomUUID(),
        type: 'create' as const,
        entityType: 'card' as const,
        entityId: crypto.randomUUID(),
        data: createMockCard(),
        timestamp: new Date()
      }))
      
      // 模拟数据库返回
      mockDb.syncOperations.toArray.mockResolvedValue(mockOperations)
      
      const result = await service.getPendingSyncOperations()
      
      expect(result).toEqual(mockOperations)
      expect(mockDb.syncOperations.toArray).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // 性能监控测试
  // ============================================================================

  describe('性能监控', () => {
    test('应该记录操作性能', async () => {
      const cardData = createMockCard()
      const cardId = crypto.randomUUID()
      
      // 模拟数据库返回
      mockDb.cards.add.mockResolvedValue(cardId)
      
      const result = await service.createCard(cardData)
      
      expect(result.duration).toBeGreaterThan(0)
      expect(result.timestamp).toBeInstanceOf(Date)
    })

    test('应该处理快速操作', async () => {
      const cardData = createMockCard()
      const cardId = crypto.randomUUID()
      
      // 模拟快速数据库操作
      mockDb.cards.add.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1))
        return cardId
      })
      
      const result = await service.createCard(cardData)
      
      expect(result.duration).toBeGreaterThan(0)
      expect(result.success).toBe(true)
    })
  })

  // ============================================================================
  // 边界情况测试
  // ============================================================================

  describe('边界情况', () => {
    test('应该处理空数据', async () => {
      // 创建最小有效数据
      const minimalCard = {
        frontContent: { title: '', text: '', tags: [] },
        backContent: { title: '', text: '', tags: [] }
      }
      
      const cardId = crypto.randomUUID()
      mockDb.cards.add.mockResolvedValue(cardId)
      
      const result = await service.createCard(minimalCard)
      
      expect(result.success).toBe(true)
      expect(result.id).toBe(cardId)
    })

    test('应该处理查询空结果', async () => {
      const cardId = crypto.randomUUID()
      
      // 模拟数据库返回null
      mockDb.cards.get.mockResolvedValue(null)
      
      const result = await service.getCard(cardId)
      
      expect(result).toBeNull()
      expect(mockDb.cards.get).toHaveBeenCalledWith(cardId)
    })

    test('应该处理删除不存在的卡片', async () => {
      const cardId = crypto.randomUUID()
      
      // 模拟数据库删除0条记录
      mockDb.cards.delete.mockResolvedValue(0)
      
      const result = await service.deleteCard(cardId)
      
      expect(result.success).toBe(true) // 删除操作在业务逻辑中总是返回成功
    })
  })

  // ============================================================================
  // 错误处理测试
  // ============================================================================

  describe('错误处理', () => {
    test('应该处理网络错误', async () => {
      const cardData = createMockCard()
      
      // 模拟网络错误
      mockDb.cards.add.mockRejectedValue(new Error('Network Error'))
      
      const result = await service.createCard(cardData)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Network Error')
    })

    test('应该处理并发创建', async () => {
      const cardData = createMockCard()
      const cardId = crypto.randomUUID()
      
      mockDb.cards.add.mockResolvedValue(cardId)
      
      // 并发创建多个卡片
      const promises = Array.from({ length: 3 }, () => service.createCard(cardData))
      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(3)
      expect(results.every(r => r.success)).toBe(true)
      expect(mockDb.cards.add).toHaveBeenCalledTimes(3)
    })
  })
})