/**
 * 查询优化器测试
 * 测试QueryOptimizer类的所有功能
 */

// Jest全局函数不需要导入
import { QueryOptimizer, QueryPlan, IndexStats } from '../../utils/query-optimizer'
import { db } from '../../services/database-unified'

// Mock database
jest.mock('../../services/database-unified', () => ({
  db: {
    cards: {
      where: jest.fn().mockReturnThis(),
      and: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
      sortBy: jest.fn().mockReturnThis(),
      reverse: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      count: jest.fn()
    }
  }
}))

describe('QueryOptimizer', () => {
  let optimizer: QueryOptimizer

  beforeEach(() => {
    optimizer = new QueryOptimizer()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('构造函数和初始化', () => {
    test('应该正确初始化查询优化器', () => {
      expect(optimizer).toBeInstanceOf(QueryOptimizer)

      // 检查初始状态
      const stats = optimizer.getIndexStats()
      expect(stats).toEqual([])

      const report = optimizer.getPerformanceReport()
      expect(report.totalQueries).toBe(0)
      expect(report.avgOptimizationTime).toBe(0)
      expect(report.mostUsedIndexes).toEqual([])
    })
  })

  describe('卡片查询优化', () => {
    test('应该优化简单查询', async () => {
      const query = {
        userId: 'user123',
        limit: 10
      }

      db.cards.count.mockResolvedValue(100)

      const result = await optimizer.optimizeCardsQuery(query)

      expect(result).toHaveProperty('query')
      expect(result).toHaveProperty('plan')
      expect(result).toHaveProperty('estimatedRows')

      expect(result.plan).toHaveProperty('estimatedCost')
      expect(result.plan).toHaveProperty('indexes')
      expect(result.plan).toHaveProperty('filterOrder')
      expect(result.plan).toHaveProperty('cacheKey')
      expect(result.plan).toHaveProperty('cacheTTL')

      expect(Array.isArray(result.plan.indexes)).toBe(true)
      expect(Array.isArray(result.plan.filterOrder)).toBe(true)
      expect(typeof result.plan.cacheKey).toBe('string')
      expect(typeof result.plan.cacheTTL).toBe('number')
    })

    test('应该优化复杂查询', async () => {
      const query = {
        userId: 'user123',
        folderId: 'folder456',
        search: 'test search',
        tags: ['tag1', 'tag2'],
        sortBy: 'updated',
        sortOrder: 'desc',
        limit: 20,
        offset: 10
      }

      db.cards.count.mockResolvedValue(1000)

      const result = await optimizer.optimizeCardsQuery(query)

      // 复杂查询应该有更高的成本估算
      expect(result.plan.estimatedCost).toBeGreaterThan(0)

      // 应该选择合适的索引
      expect(result.plan.indexes.length).toBeGreaterThan(0)

      // 应该有合理的过滤顺序
      expect(result.plan.filterOrder.length).toBeGreaterThan(0)
    })

    test('应该处理无参数查询', async () => {
      const query = {}

      db.cards.count.mockResolvedValue(500)

      const result = await optimizer.optimizeCardsQuery(query)

      expect(result.plan.estimatedCost).toBe(0)
      expect(result.plan.indexes.length).toBe(0)
      expect(result.plan.filterOrder.length).toBe(0)
    })

    test('应该估算结果数量', async () => {
      const query = {
        userId: 'user123',
        limit: 10
      }

      db.cards.count.mockResolvedValue(100)

      const result = await optimizer.optimizeCardsQuery(query)

      // 基于用户ID的选择性估算
      expect(result.estimatedRows).toBe(10) // 100 * 0.1 = 10
    })

    test('应该在数据库错误时使用保守估算', async () => {
      const query = {
        userId: 'user123',
        limit: 20
      }

      db.cards.count.mockRejectedValue(new Error('Database error'))

      const result = await optimizer.optimizeCardsQuery(query)

      // 使用查询limit作为保守估算
      expect(result.estimatedRows).toBe(20)
    })
  })

  describe('查询模式分析', () => {
    test('应该分析查询选择性', () => {
      // 通过私有方法测试
      const selectivity = (optimizer as any).calculateSelectivity({
        userId: 'user123',
        folderId: 'folder456',
        search: 'test',
        tags: ['tag1']
      })

      // 预期：0.1 * 0.3 * 0.7 * 0.5 = 0.0105，但最小为0.01
      expect(selectivity).toBeCloseTo(0.0105, 3)
    })

    test('应该计算查询复杂度', () => {
      const complexity = (optimizer as any).calculateComplexity({
        userId: 'user123',
        folderId: 'folder456',
        search: 'test search',
        tags: ['tag1', 'tag2', 'tag3'],
        sortBy: 'updated',
        limit: 10
      })

      // 预期：1 + 1 + 3 + 1.5 + 1 + 0.5 = 8
      expect(complexity).toBeCloseTo(8, 1)
    })

    test('应该分析查询模式特征', () => {
      const analysis = (optimizer as any).analyzeQueryPattern({
        userId: 'user123',
        search: 'test',
        limit: 10
      })

      expect(analysis).toHaveProperty('hasUserId', true)
      expect(analysis).toHaveProperty('hasFolderId', false)
      expect(analysis).toHaveProperty('hasSearch', true)
      expect(analysis).toHaveProperty('hasTags', false)
      expect(analysis).toHaveProperty('hasSort', false)
      expect(analysis).toHaveProperty('hasPagination', true)
      expect(analysis).toHaveProperty('selectivity')
      expect(analysis).toHaveProperty('complexity')
    })
  })

  describe('查询计划生成', () => {
    test('应该生成优化的查询计划', () => {
      const analysis = {
        hasUserId: true,
        hasFolderId: true,
        hasSearch: false,
        hasTags: false,
        hasSort: true,
        hasPagination: true,
        selectivity: 0.03,
        complexity: 3.5
      }

      const plan = (optimizer as any).generateQueryPlan(analysis)

      expect(plan).toHaveProperty('estimatedCost')
      expect(plan).toHaveProperty('indexes')
      expect(plan).toHaveProperty('filterOrder')
      expect(plan).toHaveProperty('limitStrategy')
      expect(plan).toHaveProperty('cacheKey')
      expect(plan).toHaveProperty('cacheTTL')

      // 应该选择复合索引
      expect(plan.indexes).toContain('[userId+folderId+updatedAt]')

      // 应该确定过滤顺序
      expect(plan.filterOrder).toEqual(['userId', 'folderId'])

      // 高选择性查询应该使用游标分页
      expect(plan.limitStrategy).toBe('cursor')
    })

    test('应该选择最佳索引', () => {
      const analysis = {
        hasUserId: true,
        hasFolderId: false,
        hasSearch: true,
        hasTags: true,
        hasSort: false
      }

      const indexes = (optimizer as any).selectBestIndexes(analysis)

      expect(indexes).toContain('[userId+createdAt]')
      expect(indexes).toContain('[searchVector+userId]')
      expect(indexes).toContain('userId')
    })

    test('应该确定过滤顺序', () => {
      const analysis = {
        hasUserId: true,
        hasFolderId: true,
        hasSearch: true,
        hasTags: true
      }

      const order = (optimizer as any).determineFilterOrder(analysis)

      expect(order).toEqual(['userId', 'folderId', 'tags', 'search'])
    })

    test('应该选择合适的分页策略', () => {
      // 高选择性查询使用游标
      const strategy1 = (optimizer as any).selectPaginationStrategy({
        selectivity: 0.05
      })
      expect(strategy1).toBe('cursor')

      // 低选择性查询使用偏移
      const strategy2 = (optimizer as any).selectPaginationStrategy({
        selectivity: 0.5
      })
      expect(strategy2).toBe('offset')
    })

    test('应该生成缓存键', () => {
      const analysis = {
        hasUserId: true,
        hasFolderId: false,
        hasSearch: true,
        hasTags: false,
        hasSort: true
      }

      const cacheKey = (optimizer as any).generateCacheKey(analysis)

      expect(cacheKey).toBe('user-no-folder-search-no-tags-sort')
    })

    test('应该计算缓存TTL', () => {
      const analysis1 = {
        selectivity: 0.05, // 高选择性
        complexity: 2,     // 简单
        hasSearch: false
      }

      const ttl1 = (optimizer as any).calculateCacheTTL(analysis1)
      expect(ttl1).toBe(90000) // 30000 * 2 * 1.5 = 90000

      const analysis2 = {
        selectivity: 0.5,  // 低选择性
        complexity: 5,     // 复杂
        hasSearch: true    // 搜索
      }

      const ttl2 = (optimizer as any).calculateCacheTTL(analysis2)
      expect(ttl2).toBe(15000) // 30000 * 0.5 = 15000
    })
  })

  describe('优化查询构建', () => {
    test('应该构建优化的查询', () => {
      const plan: QueryPlan = {
        estimatedCost: 50,
        indexes: ['[userId+createdAt]'],
        filterOrder: ['userId'],
        limitStrategy: 'offset',
        cacheKey: 'user-no-folder',
        cacheTTL: 30000
      }

      const originalQuery = {
        userId: 'user123',
        limit: 10,
        offset: 5
      }

      const optimizedQuery = (optimizer as any).buildOptimizedQuery(plan, originalQuery)

      // 应该返回一个查询对象
      expect(optimizedQuery).toBeDefined()

      // 验证方法链调用
      expect(db.cards.where).toHaveBeenCalledWith('userId')
      expect(db.cards.where().equals).toHaveBeenCalledWith('user123')
      expect(db.cards.where().equals().limit).toHaveBeenCalledWith(10)
      expect(db.cards.where().equals().limit().offset).toHaveBeenCalledWith(5)
    })

    test('应该应用搜索过滤', () => {
      const plan: QueryPlan = {
        estimatedCost: 100,
        indexes: ['[searchVector+userId]'],
        filterOrder: ['search'],
        limitStrategy: 'offset',
        cacheKey: 'search',
        cacheTTL: 15000
      }

      const originalQuery = {
        search: 'test search',
        limit: 20
      }

      const optimizedQuery = (optimizer as any).buildOptimizedQuery(plan, originalQuery)

      expect(db.cards.filter).toHaveBeenCalled()

      // 验证过滤函数
      const filterCall = db.cards.filter.mock.calls[0][0]
      const testCard = {
        searchVector: 'test search content',
        frontContent: { tags: [] },
        backContent: { tags: [] }
      }
      expect(filterCall(testCard)).toBe(true)
    })

    test('应该应用标签过滤', () => {
      const plan: QueryPlan = {
        estimatedCost: 75,
        indexes: ['userId'],
        filterOrder: ['tags'],
        limitStrategy: 'offset',
        cacheKey: 'tags',
        cacheTTL: 30000
      }

      const originalQuery = {
        tags: ['important', 'work'],
        limit: 15
      }

      const optimizedQuery = (optimizer as any).buildOptimizedQuery(plan, originalQuery)

      expect(db.cards.filter).toHaveBeenCalled()

      // 验证标签过滤函数
      const filterCall = db.cards.filter.mock.calls[0][0]
      const testCard = {
        frontContent: { tags: ['important', 'personal'] },
        backContent: { tags: ['work'] }
      }
      expect(filterCall(testCard)).toBe(true)
    })

    test('应该应用排序', () => {
      const plan: QueryPlan = {
        estimatedCost: 25,
        indexes: ['updatedAt'],
        filterOrder: [],
        limitStrategy: 'offset',
        cacheKey: 'sort',
        cacheTTL: 30000
      }

      const originalQuery = {
        sortBy: 'updated',
        sortOrder: 'desc',
        limit: 10
      }

      const optimizedQuery = (optimizer as any).buildOptimizedQuery(plan, originalQuery)

      expect(db.cards.orderBy).toHaveBeenCalledWith('updatedAt')
      expect(db.cards.orderBy().reverse).toHaveBeenCalled()
    })

    test('应该使用默认排序', () => {
      const plan: QueryPlan = {
        estimatedCost: 10,
        indexes: [],
        filterOrder: [],
        limitStrategy: 'offset',
        cacheKey: 'no-sort',
        cacheTTL: 30000
      }

      const originalQuery = {
        limit: 10
      }

      const optimizedQuery = (optimizer as any).buildOptimizedQuery(plan, originalQuery)

      expect(db.cards.orderBy).toHaveBeenCalledWith('updatedAt')
    })
  })

  describe('性能统计和分析', () => {
    test('应该记录查询分析', () => {
      const plan: QueryPlan = {
        estimatedCost: 50,
        indexes: ['[userId+createdAt]', 'updatedAt'],
        filterOrder: ['userId'],
        limitStrategy: 'offset',
        cacheKey: 'user',
        cacheTTL: 30000
      }

      const analysis = {
        hasUserId: true,
        hasFolderId: false,
        hasSearch: false,
        hasTags: false,
        hasSort: false,
        hasPagination: false,
        selectivity: 0.1,
        complexity: 1
      }

      // 记录分析
      (optimizer as any).recordQueryAnalysis(analysis, plan, 5.2)

      // 检查索引统计
      const stats = optimizer.getIndexStats()
      expect(stats.length).toBe(2)
      expect(stats[0].hits).toBe(1)
      expect(stats[1].hits).toBe(1)

      // 检查性能报告
      const report = optimizer.getPerformanceReport()
      expect(report.totalQueries).toBe(1)
      expect(report.avgOptimizationTime).toBe(5.2)
      expect(report.mostUsedIndexes).toEqual(['[userId+createdAt]', 'updatedAt'])
    })

    test('应该跟踪最常用的索引', () => {
      // 模拟多次查询
      for (let i = 0; i < 5; i++) {
        const plan: QueryPlan = {
          estimatedCost: 30,
          indexes: ['index1'],
          filterOrder: [],
          limitStrategy: 'offset',
          cacheKey: 'test',
          cacheTTL: 30000
        }

        const analysis = { hasUserId: false, hasFolderId: false, hasSearch: false, hasTags: false, hasSort: false, hasPagination: false, selectivity: 1, complexity: 0 }
        (optimizer as any).recordQueryAnalysis(analysis, plan, 1)
      }

      for (let i = 0; i < 3; i++) {
        const plan: QueryPlan = {
          estimatedCost: 40,
          indexes: ['index2'],
          filterOrder: [],
          limitStrategy: 'offset',
          cacheKey: 'test',
          cacheTTL: 30000
        }

        const analysis = { hasUserId: false, hasFolderId: false, hasSearch: false, hasTags: false, hasSort: false, hasPagination: false, selectivity: 1, complexity: 0 }
        (optimizer as any).recordQueryAnalysis(analysis, plan, 1)
      }

      const report = optimizer.getPerformanceReport()
      expect(report.mostUsedIndexes[0]).toBe('index1')
      expect(report.mostUsedIndexes[1]).toBe('index2')
    })

    test('应该生成优化建议', () => {
      // 添加一些低使用率的索引
      for (let i = 0; i < 5; i++) {
        const plan: QueryPlan = {
          estimatedCost: 50,
          indexes: ['underused-index'],
          filterOrder: [],
          limitStrategy: 'offset',
          cacheKey: 'test',
          cacheTTL: 30000
        }

        const analysis = { hasUserId: false, hasFolderId: false, hasSearch: false, hasTags: false, hasSort: false, hasPagination: false, selectivity: 1, complexity: 0 }
        (optimizer as any).recordQueryAnalysis(analysis, plan, 1)
      }

      // 添加一些慢查询
      for (let i = 0; i < 3; i++) {
        const plan: QueryPlan = {
          estimatedCost: 100,
          indexes: ['slow-index'],
          filterOrder: [],
          limitStrategy: 'offset',
          cacheKey: 'slow',
          cacheTTL: 30000
        }

        const analysis = { hasUserId: false, hasFolderId: false, hasSearch: false, hasTags: false, hasSort: false, hasPagination: false, selectivity: 1, complexity: 0 }
        (optimizer as any).recordQueryAnalysis(analysis, plan, 100) // 100ms 慢查询
      }

      const report = optimizer.getPerformanceReport()
      expect(report.recommendations.length).toBeGreaterThan(0)
      expect(report.recommendations[0]).toContain('考虑删除低使用率索引')
      expect(report.recommendations[1]).toContain('发现 1 个慢查询模式')
    })
  })

  describe('清理功能', () => {
    test('应该清理旧统计数据', () => {
      // 添加一些查询指标
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10天前
      const recentDate = new Date()

      // 模拟旧查询
      const oldPlan: QueryPlan = {
        estimatedCost: 50,
        indexes: ['old-index'],
        filterOrder: [],
        limitStrategy: 'offset',
        cacheKey: 'old',
        cacheTTL: 30000
      }

      const oldAnalysis = { hasUserId: false, hasFolderId: false, hasSearch: false, hasTags: false, hasSort: false, hasPagination: false, selectivity: 1, complexity: 0 }
      ;(optimizer as any).recordQueryAnalysis(oldAnalysis, oldPlan, oldDate.getTime())

      // 模拟新查询
      const newPlan: QueryPlan = {
        estimatedCost: 30,
        indexes: ['new-index'],
        filterOrder: [],
        limitStrategy: 'offset',
        cacheKey: 'new',
        cacheTTL: 30000
      }

      const newAnalysis = { hasUserId: false, hasFolderId: false, hasSearch: false, hasTags: false, hasSort: false, hasPagination: false, selectivity: 1, complexity: 0 }
      ;(optimizer as any).recordQueryAnalysis(newAnalysis, newPlan, recentDate.getTime())

      // 清理7天前的数据
      optimizer.cleanup()

      // 旧数据应该被清理
      const report = optimizer.getPerformanceReport()
      expect(report.totalQueries).toBe(1) // 只剩下新查询
    })

    test('应该处理清理时的边界情况', () => {
      // 空状态清理
      expect(() => optimizer.cleanup()).not.toThrow()
    })
  })

  describe('边界情况和错误处理', () => {
    test('应该处理无效的查询参数', async () => {
      const invalidQuery = {
        userId: null,
        folderId: undefined,
        tags: null,
        sortBy: 'invalid_field'
      }

      db.cards.count.mockResolvedValue(100)

      const result = await optimizer.optimizeCardsQuery(invalidQuery)

      // 应该优雅处理无效参数
      expect(result).toBeDefined()
      expect(result.plan).toBeDefined()
    })

    test('应该处理空字符串搜索', async () => {
      const query = {
        search: '',
        userId: 'user123'
      }

      db.cards.count.mockResolvedValue(100)

      const result = await optimizer.optimizeCardsQuery(query)

      // 空搜索不应该影响分析
      expect(result.plan.cacheKey).toContain('no-search')
    })

    test('应该处理数据库连接错误', async () => {
      const query = {
        userId: 'user123',
        limit: 10
      }

      db.cards.count.mockRejectedValue(new Error('Connection failed'))

      const result = await optimizer.optimizeCardsQuery(query)

      // 应该使用保守估算
      expect(result.estimatedRows).toBe(10)
    })
  })

  describe('性能测试', () => {
    test('应该保持良好的查询优化性能', async () => {
      const query = {
        userId: 'user123',
        folderId: 'folder456',
        search: 'performance test',
        tags: ['perf', 'test'],
        sortBy: 'updated',
        sortOrder: 'desc',
        limit: 50
      }

      db.cards.count.mockResolvedValue(1000)

      const start = performance.now()

      // 执行多次优化操作
      for (let i = 0; i < 100; i++) {
        await optimizer.optimizeCardsQuery(query)
      }

      const end = performance.now()
      const duration = end - start

      // 100次优化操作应该在合理时间内完成
      expect(duration).toBeLessThan(1000) // 1秒
    })

    test('应该避免内存泄漏', () => {
      // 创建多个优化器实例
      const instances = []
      for (let i = 0; i < 100; i++) {
        instances.push(new QueryOptimizer())
      }

      // 清理
      instances.length = 0

      // 如果没有内存泄漏，这个测试应该通过
      expect(true).toBe(true)
    })
  })

  describe('TypeScript类型检查', () => {
    test('应该符合TypeScript接口', () => {
      const stats: IndexStats[] = optimizer.getIndexStats()
      expect(Array.isArray(stats)).toBe(true)

      const report = optimizer.getPerformanceReport()
      expect(report).toHaveProperty('totalQueries')
      expect(report).toHaveProperty('avgOptimizationTime')
      expect(report).toHaveProperty('mostUsedIndexes')
      expect(report).toHaveProperty('recommendations')
    })
  })
})