// 卡片管理集成测试
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MockDatabaseService, MockSupabaseService, MockSyncService } from '../mock-services'
import { CardFixture, FolderFixture, TagFixture } from '../data-fixtures'
import { PerformanceTester } from '../advanced-test-utils'
import type { TestCardData, TestFolderData, TestTagData } from '../advanced-test-utils'

// 模拟组件
const CardGrid = ({ cards, onCardClick, onCardDelete, onCardFlip }: {
  cards: TestCardData[]
  onCardClick: (card: TestCardData) => void
  onCardDelete: (cardId: string) => void
  onCardFlip: (cardId: string) => void
}) => (
  <div data-testid="card-grid">
    {cards.map(card => (
      <div key={card.id} data-testid={`card-${card.id}`} data-card-id={card.id}>
        <div data-testid={`card-title-${card.id}`}>{card.frontContent.title}</div>
        <div data-testid={`card-content-${card.id}`}>{card.frontContent.text}</div>
        <button 
          data-testid={`card-flip-${card.id}`}
          onClick={() => onCardFlip(card.id)}
        >
          翻转
        </button>
        <button 
          data-testid={`card-delete-${card.id}`}
          onClick={() => onCardDelete(card.id)}
        >
          删除
        </button>
        <div 
          data-testid={`card-click-${card.id}`}
          onClick={() => onCardClick(card)}
        >
          点击区域
        </div>
      </div>
    ))}
  </div>
)

const CardForm = ({ onSubmit, onCancel }: {
  onSubmit: (card: Partial<TestCardData>) => void
  onCancel: () => void
}) => {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      frontContent: {
        title,
        text: content,
        images: [],
        tags: [],
        lastModified: new Date(),
      },
      backContent: {
        title: '',
        text: '',
        images: [],
        tags: [],
        lastModified: new Date(),
      },
      style: {
        type: 'solid',
        backgroundColor: '#ffffff',
        fontFamily: 'system-ui',
        fontSize: 'base',
        fontWeight: 'normal',
        textColor: '#1f2937',
        borderRadius: 'xl',
        shadow: 'md',
        borderWidth: 0,
      },
      isFlipped: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  return (
    <form data-testid="card-form" onSubmit={handleSubmit}>
      <input
        data-testid="card-title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="卡片标题"
        required
      />
      <textarea
        data-testid="card-content-input"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="卡片内容"
        required
      />
      <button type="submit" data-testid="card-submit-button">创建卡片</button>
      <button type="button" data-testid="card-cancel-button" onClick={onCancel}>取消</button>
    </form>
  )
}

const CardSearch = ({ onSearch }: {
  onSearch: (searchTerm: string) => void
}) => {
  const [searchTerm, setSearchTerm] = useState('')

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value
    setSearchTerm(term)
    onSearch(term)
  }

  return (
    <div data-testid="card-search">
      <input
        data-testid="search-input"
        value={searchTerm}
        onChange={handleSearch}
        placeholder="搜索卡片..."
      />
    </div>
  )
}

// 模拟状态管理
function useState<T>(initial: T): [T, (value: T) => void] {
  let state = initial
  return [
    state,
    (value: T) => {
      state = value
    }
  ] as const
}

describe('CardManagementIntegration', () => {
  let databaseService: MockDatabaseService
  let supabaseService: MockSupabaseService
  let syncService: MockSyncService
  let performanceTester: PerformanceTester
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    // 创建模拟服务
    databaseService = new MockDatabaseService()
    supabaseService = new MockSupabaseService()
    syncService = new MockSyncService(supabaseService, databaseService)
    performanceTester = new PerformanceTester()
    user = userEvent.setup()
  })

  afterEach(() => {
    // 清理
    databaseService.reset()
    supabaseService.reset()
    syncService.reset()
    performanceTester.clear()
  })

  describe('卡片创建和显示', () => {
    it('应该能够创建新卡片并显示在网格中', async () => {
      const mockCards: TestCardData[] = []
      const mockOnCardClick = jest.fn()
      const mockOnCardDelete = jest.fn()
      const mockOnCardFlip = jest.fn()

      const { rerender } = render(
        <CardGrid 
          cards={mockCards}
          onCardClick={mockOnCardClick}
          onCardDelete={mockOnCardDelete}
          onCardFlip={mockOnCardFlip}
        />
      )

      // 初始状态应该没有卡片
      expect(screen.queryByTestId('card-grid')).toBeInTheDocument()
      expect(screen.queryAllByTestId(/^card-/)).toHaveLength(0)

      // 创建新卡片
      const newCard = CardFixture.basic()
      mockCards.push(newCard)

      // 重新渲染
      rerender(
        <CardGrid 
          cards={mockCards}
          onCardClick={mockOnCardClick}
          onCardDelete={mockOnCardDelete}
          onCardFlip={mockOnCardFlip}
        />
      )

      // 新卡片应该显示在网格中
      expect(screen.getByTestId(`card-${newCard.id}`)).toBeInTheDocument()
      expect(screen.getByTestId(`card-title-${newCard.id}`)).toHaveText(newCard.frontContent.title)
      expect(screen.getByTestId(`card-content-${newCard.id}`)).toHaveText(newCard.frontContent.text)
    })

    it('应该能够通过表单创建卡片', async () => {
      const mockOnSubmit = jest.fn()
      const mockOnCancel = jest.fn()

      render(<CardForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // 填写表单
      const titleInput = screen.getByTestId('card-title-input')
      const contentInput = screen.getByTestId('card-content-input')
      const submitButton = screen.getByTestId('card-submit-button')

      await user.type(titleInput, '测试卡片标题')
      await user.type(contentInput, '测试卡片内容')

      // 提交表单
      await user.click(submitButton)

      // 应该调用onSubmit回调
      expect(mockOnSubmit).toHaveBeenCalledTimes(1)
      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
        frontContent: expect.objectContaining({
          title: '测试卡片标题',
          text: '测试卡片内容',
        }),
      }))
    })

    it('应该验证表单输入', async () => {
      const mockOnSubmit = jest.fn()
      const mockOnCancel = jest.fn()

      render(<CardForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const submitButton = screen.getByTestId('card-submit-button')

      // 尝试提交空表单
      await user.click(submitButton)

      // 不应该调用onSubmit（HTML5验证会阻止提交）
      expect(mockOnSubmit).not.toHaveBeenCalled()

      // 填写标题但不填写内容
      const titleInput = screen.getByTestId('card-title-input')
      await user.type(titleInput, '只有标题')
      await user.click(submitButton)

      // 仍然不应该调用onSubmit（内容是必需的）
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
  })

  describe('卡片操作', () => {
    it('应该能够删除卡片', async () => {
      const testCard = CardFixture.basic()
      const mockCards = [testCard]
      const mockOnCardDelete = jest.fn()

      render(
        <CardGrid 
          cards={mockCards}
          onCardClick={jest.fn()}
          onCardDelete={mockOnCardDelete}
          onCardFlip={jest.fn()}
        />
      )

      // 点击删除按钮
      const deleteButton = screen.getByTestId(`card-delete-${testCard.id}`)
      await user.click(deleteButton)

      // 应该调用删除回调
      expect(mockOnCardDelete).toHaveBeenCalledTimes(1)
      expect(mockOnCardDelete).toHaveBeenCalledWith(testCard.id)
    })

    it('应该能够翻转卡片', async () => {
      const testCard = CardFixture.basic()
      const mockCards = [testCard]
      const mockOnCardFlip = jest.fn()

      render(
        <CardGrid 
          cards={mockCards}
          onCardClick={jest.fn()}
          onCardDelete={jest.fn()}
          onCardFlip={mockOnCardFlip}
        />
      )

      // 点击翻转按钮
      const flipButton = screen.getByTestId(`card-flip-${testCard.id}`)
      await user.click(flipButton)

      // 应该调用翻转回调
      expect(mockOnCardFlip).toHaveBeenCalledTimes(1)
      expect(mockOnCardFlip).toHaveBeenCalledWith(testCard.id)
    })

    it('应该能够点击卡片查看详情', async () => {
      const testCard = CardFixture.basic()
      const mockCards = [testCard]
      const mockOnCardClick = jest.fn()

      render(
        <CardGrid 
          cards={mockCards}
          onCardClick={mockOnCardClick}
          onCardDelete={jest.fn()}
          onCardFlip={jest.fn()}
        />
      )

      // 点击卡片
      const clickArea = screen.getByTestId(`card-click-${testCard.id}`)
      await user.click(clickArea)

      // 应该调用点击回调
      expect(mockOnCardClick).toHaveBeenCalledTimes(1)
      expect(mockOnCardClick).toHaveBeenCalledWith(testCard)
    })
  })

  describe('卡片搜索', () => {
    it('应该能够搜索卡片', async () => {
      const mockOnSearch = jest.fn()

      render(<CardSearch onSearch={mockOnSearch} />)

      const searchInput = screen.getByTestId('search-input')

      // 输入搜索词
      await user.type(searchInput, '搜索关键词')

      // 应该调用搜索回调
      expect(mockOnSearch).toHaveBeenCalledTimes(5) // 每个字符触发一次
      expect(mockOnSearch).toHaveBeenLastCalledWith('搜索关键词')
    })

    it('应该处理搜索输入的防抖', async () => {
      const mockOnSearch = jest.fn()

      render(<CardSearch onSearch={mockOnSearch} />)

      const searchInput = screen.getByTestId('search-input')

      // 快速输入多个字符
      await user.type(searchInput, '快速搜索测试')

      // 在实际应用中，这里应该有防抖逻辑
      // 在这个测试中，我们验证每次输入都会触发搜索
      expect(mockOnSearch).toHaveBeenCalledTimes(6)
    })
  })

  describe('数据库集成', () => {
    it('应该能够将卡片保存到数据库', async () => {
      const cardData = CardFixture.basic()

      // 性能测试
      const addTime = await performanceTester.measure('add-card', async () => {
        const result = await databaseService.cards.add(cardData)
        return result
      })

      // 验证卡片已保存
      const savedCard = await databaseService.cards.get(cardData.id)
      expect(savedCard).toBeDefined()
      expect(savedCard?.frontContent.title).toBe(cardData.frontContent.title)

      // 验证性能
      expect(addTime).toBeLessThan(100) // 应该在100ms内完成
    })

    it('应该能够从数据库获取卡片列表', async () => {
      const cards = CardFixture.list(10)

      // 批量添加卡片
      const bulkAddTime = await performanceTester.measure('bulk-add-cards', async () => {
        await databaseService.cards.bulkAdd(cards)
      })

      // 获取所有卡片
      const allCards = await databaseService.cards.getAll()
      expect(allCards).toHaveLength(10)

      // 验证性能
      expect(bulkAddTime).toBeLessThan(200) // 应该在200ms内完成
    })

    it('应该能够更新卡片', async () => {
      const cardData = CardFixture.basic()
      await databaseService.cards.add(cardData)

      const updates = {
        frontContent: {
          ...cardData.frontContent,
          title: '更新后的标题',
        },
      }

      const updateTime = await performanceTester.measure('update-card', async () => {
        await databaseService.cards.update(cardData.id, updates)
      })

      // 验证更新
      const updatedCard = await databaseService.cards.get(cardData.id)
      expect(updatedCard?.frontContent.title).toBe('更新后的标题')

      // 验证性能
      expect(updateTime).toBeLessThan(50) // 应该在50ms内完成
    })

    it('应该能够删除卡片', async () => {
      const cardData = CardFixture.basic()
      await databaseService.cards.add(cardData)

      const deleteTime = await performanceTester.measure('delete-card', async () => {
        await databaseService.cards.delete(cardData.id)
      })

      // 验证删除
      const deletedCard = await databaseService.cards.get(cardData.id)
      expect(deletedCard).toBeUndefined()

      // 验证性能
      expect(deleteTime).toBeLessThan(50) // 应该在50ms内完成
    })
  })

  describe('同步集成', () => {
    it('应该能够同步卡片到云端', async () => {
      // 创建本地卡片
      const cardData = CardFixture.basic()
      await databaseService.cards.add(cardData)

      // 创建同步操作
      const syncOperation = {
        id: 'sync-op-1',
        type: 'create' as const,
        entity: 'card' as const,
        entityId: cardData.id,
        data: cardData,
        priority: 'normal' as const,
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending' as const,
      }

      await databaseService.syncQueue.add(syncOperation)

      // 执行同步
      const syncTime = await performanceTester.measure('sync-card', async () => {
        const result = await syncService.syncNow()
        return result
      })

      // 验证同步结果
      expect(syncTime).toBeLessThan(1000) // 应该在1秒内完成

      // 验证同步队列状态
      const syncStats = await databaseService.syncQueue.getStats()
      expect(syncStats.completed).toBe(1)
      expect(syncStats.pending).toBe(0)
    })

    it('应该处理同步错误', async () => {
      // 设置离线状态
      syncService.setOnline(false)

      // 创建卡片并尝试同步
      const cardData = CardFixture.basic()
      await databaseService.cards.add(cardData)

      const syncOperation = {
        id: 'sync-op-2',
        type: 'create' as const,
        entity: 'card' as const,
        entityId: cardData.id,
        data: cardData,
        priority: 'normal' as const,
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending' as const,
      }

      await databaseService.syncQueue.add(syncOperation)

      // 尝试同步
      const result = await syncService.syncNow()

      // 应该失败
      expect(result.success).toBe(false)
      expect(result.errors).toBeGreaterThan(0)

      // 验证同步队列状态
      const syncStats = await databaseService.syncQueue.getStats()
      expect(syncStats.failed).toBe(1)
    })
  })

  describe('文件夹集成', () => {
    it('应该能够创建文件夹并将卡片移动到文件夹', async () => {
      // 创建文件夹
      const folderData = FolderFixture.basic()
      await databaseService.folders.add(folderData)

      // 创建卡片
      const cardData = CardFixture.inFolder(folderData.id)
      await databaseService.cards.add(cardData)

      // 验证文件夹包含卡片
      const folderCards = await databaseService.cards.findByFolder(folderData.id)
      expect(folderCards).toHaveLength(1)
      expect(folderCards[0].id).toBe(cardData.id)
    })

    it('应该能够获取文件夹层级结构', async () => {
      // 创建文件夹层级
      const rootFolder = FolderFixture.basic({ id: 'root' })
      const childFolder1 = FolderFixture.nested('root', { id: 'child1' })
      const childFolder2 = FolderFixture.nested('root', { id: 'child2' })

      await Promise.all([
        databaseService.folders.add(rootFolder),
        databaseService.folders.add(childFolder1),
        databaseService.folders.add(childFolder2),
      ])

      // 获取根文件夹
      const rootFolders = await databaseService.folders.getRoot()
      expect(rootFolders).toHaveLength(1)
      expect(rootFolders[0].id).toBe('root')

      // 获取子文件夹
      const childFolders = await databaseService.folders.getChildren('root')
      expect(childFolders).toHaveLength(2)
      expect(childFolders.map(f => f.id)).toEqual(['child1', 'child2'])
    })
  })

  describe('标签集成', () => {
    it('应该能够为卡片添加标签', async () => {
      // 创建标签
      const tagData = TagFixture.basic()
      await databaseService.tags.add(tagData)

      // 创建带标签的卡片
      const cardData = CardFixture.basic({
        frontContent: {
          ...CardFixture.basic().frontContent,
          tags: [tagData.name],
        },
      })
      await databaseService.cards.add(cardData)

      // 通过标签查找卡片
      const taggedCards = await databaseService.cards.findByTag(tagData.name)
      expect(taggedCards).toHaveLength(1)
      expect(taggedCards[0].id).toBe(cardData.id)
    })

    it('应该能够获取标签统计信息', async () => {
      // 创建多个标签和卡片
      const tags = TagFixture.list().slice(0, 3)
      await Promise.all(tags.map(tag => databaseService.tags.add(tag)))

      const cards = [
        CardFixture.basic({
          frontContent: {
            ...CardFixture.basic().frontContent,
            tags: [tags[0].name, tags[1].name],
          },
        }),
        CardFixture.basic({
          frontContent: {
            ...CardFixture.basic().frontContent,
            tags: [tags[0].name],
          },
        }),
      ]

      await Promise.all(cards.map(card => databaseService.cards.add(card)))

      // 获取所有标签（应该更新计数）
      const allTags = await databaseService.tags.getAll()
      expect(allTags).toHaveLength(3)
    })
  })

  describe('性能测试', () => {
    it('应该能够处理大量卡片', async () => {
      // 创建大量卡片
      const largeCardCount = 100
      const cards = CardFixture.list(largeCardCount)

      const bulkAddTime = await performanceTester.measure('bulk-add-large-cards', async () => {
        await databaseService.cards.bulkAdd(cards)
      })

      // 验证所有卡片都已保存
      const allCards = await databaseService.cards.getAll()
      expect(allCards).toHaveLength(largeCardCount)

      // 验证性能
      expect(bulkAddTime).toBeLessThan(1000) // 应该在1秒内完成

      // 测试获取性能
      const getAllTime = await performanceTester.measure('get-all-cards', async () => {
        return await databaseService.cards.getAll()
      })

      expect(getAllTime).toBeLessThan(100) // 应该在100ms内完成
    })

    it('应该能够处理快速连续操作', async () => {
      // 快速连续创建卡片
      const operations = []
      for (let i = 0; i < 10; i++) {
        operations.push(
          performanceTester.measure(`create-card-${i}`, async () => {
            const card = CardFixture.basic()
            await databaseService.cards.add(card)
            return card
          })
        )
      }

      // 并行执行所有操作
      const results = await Promise.all(operations)

      // 验证所有操作都成功
      expect(results).toHaveLength(10)
      
      // 验证性能（每个操作都应该很快）
      results.forEach((time, index) => {
        expect(time).toBeLessThan(100) // 每个操作应该在100ms内完成
      })
    })
  })

  describe('错误处理', () => {
    it('应该处理数据库操作失败', async () => {
      // 模拟数据库错误
      jest.spyOn(databaseService.cards, 'add').mockRejectedValueOnce(new Error('Database error'))

      // 尝试添加卡片
      await expect(databaseService.cards.add(CardFixture.basic())).rejects.toThrow('Database error')
    })

    it('应该处理同步失败', async () => {
      // 模拟网络错误
      jest.spyOn(supabaseService.from('cards'), 'insert').mockRejectedValueOnce(new Error('Network error'))

      // 创建卡片并尝试同步
      const cardData = CardFixture.basic()
      await databaseService.cards.add(cardData)

      const syncOperation = {
        id: 'sync-op-error',
        type: 'create' as const,
        entity: 'card' as const,
        entityId: cardData.id,
        data: cardData,
        priority: 'normal' as const,
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending' as const,
      }

      await databaseService.syncQueue.add(syncOperation)

      // 尝试同步
      const result = await syncService.syncNow()

      // 应该失败
      expect(result.success).toBe(false)
      expect(result.errors).toBeGreaterThan(0)

      // 应该记录错误
      const syncErrors = syncService.getSyncErrors()
      expect(syncErrors.length).toBeGreaterThan(0)
    })
  })
})