// 组件交互集成测试
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { axe } from 'jest-axe'
import { DndProvider } from '@dnd-kit/core'
import { CardOperationsProvider } from '@/contexts/cardall-context'
import { Dashboard } from '@/components/dashboard/dashboard-main'
import { FlipCard } from '@/components/card/flip-card'
import { MagneticCardGrid } from '@/components/card/magnetic-card-grid'
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar'
import { mockDataUtils, performanceUtils } from '@/tests/test-utils'
import { cardFixtures, folderFixtures, tagFixtures } from '@/tests/fixtures/data-fixtures'

// 测试组件渲染包装器
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <DndProvider>
    <CardOperationsProvider>
      {children}
    </CardOperationsProvider>
  </DndProvider>
)

describe('Component Integration', () => {
  describe('Dashboard完整交互流程', () => {
    it('应该支持完整的卡片创建流程', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )
      
      // 点击创建卡片按钮
      const createButton = screen.getByText(/create card/i)
      fireEvent.click(createButton)
      
      // 填写卡片信息
      const titleInput = screen.getByPlaceholderText(/card title/i)
      const contentInput = screen.getByPlaceholderText(/card content/i)
      
      fireEvent.change(titleInput, { target: { value: 'Test Card' } })
      fireEvent.change(contentInput, { target: { value: 'Test content' } })
      
      // 保存卡片
      const saveButton = screen.getByText(/save/i)
      fireEvent.click(saveButton)
      
      // 验证卡片创建成功
      await waitFor(() => {
        expect(screen.getByText('Test Card')).toBeInTheDocument()
      })
    })

    it('应该支持卡片编辑流程', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )
      
      // 双击卡片进行编辑
      const card = screen.getByText('Test Card')
      fireEvent.doubleClick(card)
      
      // 编辑卡片内容
      const titleInput = screen.getByDisplayValue('Test Card')
      fireEvent.change(titleInput, { target: { value: 'Updated Card' } })
      
      // 保存更改
      const updateButton = screen.getByText(/update/i)
      fireEvent.click(updateButton)
      
      // 验证卡片更新成功
      await waitFor(() => {
        expect(screen.getByText('Updated Card')).toBeInTheDocument()
      })
    })

    it('应该支持卡片删除流程', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )
      
      // 点击删除按钮
      const deleteButton = screen.getByRole('button', { name: /delete/i })
      fireEvent.click(deleteButton)
      
      // 确认删除
      const confirmButton = screen.getByText(/confirm/i)
      fireEvent.click(confirmButton)
      
      // 验证卡片删除成功
      await waitFor(() => {
        expect(screen.queryByText('Test Card')).not.toBeInTheDocument()
      })
    })

    it('应该支持标签管理流程', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )
      
      // 打开标签管理
      const tagButton = screen.getByText(/tags/i)
      fireEvent.click(tagButton)
      
      // 创建新标签
      const newTagInput = screen.getByPlaceholderText(/new tag/i)
      fireEvent.change(newTagInput, { target: { value: 'Important' } })
      
      const addButton = screen.getByText(/add tag/i)
      fireEvent.click(addButton)
      
      // 验证标签创建成功
      await waitFor(() => {
        expect(screen.getByText('Important')).toBeInTheDocument()
      })
      
      // 为卡片添加标签
      const card = screen.getByText('Test Card')
      fireEvent.click(card)
      
      const tagCheckbox = screen.getByLabelText('Important')
      fireEvent.click(tagCheckbox)
      
      // 验证标签已添加到卡片
      await waitFor(() => {
        expect(screen.getByText('Important')).toBeInTheDocument()
      })
    })

    it('应该支持文件夹管理流程', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )
      
      // 打开文件夹管理
      const folderButton = screen.getByText(/folders/i)
      fireEvent.click(folderButton)
      
      // 创建新文件夹
      const newFolderInput = screen.getByPlaceholderText(/folder name/i)
      fireEvent.change(newFolderInput, { target: { value: 'Work' } })
      
      const createFolderButton = screen.getByText(/create folder/i)
      fireEvent.click(createFolderButton)
      
      // 验证文件夹创建成功
      await waitFor(() => {
        expect(screen.getByText('Work')).toBeInTheDocument()
      })
      
      // 将卡片拖拽到文件夹
      const card = screen.getByText('Test Card')
      const folder = screen.getByText('Work')
      
      fireEvent.dragStart(card)
      fireEvent.drop(folder)
      
      // 验证卡片已移动到文件夹
      await waitFor(() => {
        expect(folder).toContainElement(screen.getByText('Test Card'))
      })
    })
  })

  describe('FlipCard与Grid交互', () => {
    it('应该支持卡片翻转功能', async () => {
      const mockCard = cardFixtures.textCard
      const mockOnFlip = jest.fn()
      
      render(
        <TestWrapper>
          <FlipCard
            card={mockCard}
            onFlip={mockOnFlip}
            onEdit={jest.fn()}
            onDelete={jest.fn()}
            onStyleChange={jest.fn()}
          />
        </TestWrapper>
      )
      
      // 点击卡片进行翻转
      const card = screen.getByRole('article')
      fireEvent.click(card)
      
      // 验证翻转回调被调用
      await waitFor(() => {
        expect(mockOnFlip).toHaveBeenCalledWith(mockCard.id)
      })
      
      // 验证卡片显示背面内容
      await waitFor(() => {
        expect(screen.getByText(/additional information/i)).toBeInTheDocument()
      })
    })

    it('应该支持卡片样式切换', async () => {
      const mockCard = cardFixtures.textCard
      const mockOnStyleChange = jest.fn()
      
      render(
        <TestWrapper>
          <FlipCard
            card={mockCard}
            onFlip={jest.fn()}
            onEdit={jest.fn()}
            onDelete={jest.fn()}
            onStyleChange={mockOnStyleChange}
          />
        </TestWrapper>
      )
      
      // 打开样式选择器
      const styleButton = screen.getByRole('button', { name: /style/i })
      fireEvent.click(styleButton)
      
      // 选择新样式
      const gradientOption = screen.getByText(/gradient blue/i)
      fireEvent.click(gradientOption)
      
      // 验证样式变更回调被调用
      await waitFor(() => {
        expect(mockOnStyleChange).toHaveBeenCalledWith(mockCard.id, 'gradient-blue')
      })
    })

    it('应该支持卡片拖拽功能', async () => {
      const cards = [cardFixtures.textCard, cardFixtures.imageCard]
      const mockOnDragEnd = jest.fn()
      
      render(
        <TestWrapper>
          <MagneticCardGrid
            cards={cards}
            onDragEnd={mockOnDragEnd}
            onCardClick={jest.fn()}
          />
        </TestWrapper>
      )
      
      // 开始拖拽卡片
      const card = screen.getByText('Simple Text Card')
      fireEvent.dragStart(card)
      
      // 模拟拖拽到新位置
      const dragEvent = {
        active: { id: card.id },
        over: { id: cards[1].id },
      }
      
      // 触发拖拽结束
      fireEvent.dragEnd(card, dragEvent)
      
      // 验证拖拽回调被调用
      await waitFor(() => {
        expect(mockOnDragEnd).toHaveBeenCalledWith(dragEvent)
      })
    })
  })

  describe('Sidebar与主界面交互', () => {
    it('应该支持通过侧边栏筛选卡片', async () => {
      render(
        <TestWrapper>
          <DashboardSidebar />
          <MagneticCardGrid
            cards={[cardFixtures.textCard, cardFixtures.imageCard]}
            onDragEnd={jest.fn()}
            onCardClick={jest.fn()}
          />
        </TestWrapper>
      )
      
      // 通过标签筛选
      const tagFilter = screen.getByText('text')
      fireEvent.click(tagFilter)
      
      // 验证筛选结果
      await waitFor(() => {
        expect(screen.getByText('Simple Text Card')).toBeInTheDocument()
        expect(screen.queryByText('Image Card')).not.toBeInTheDocument()
      })
    })

    it('应该支持通过文件夹筛选卡片', async () => {
      const cards = [
        { ...cardFixtures.textCard, folderId: 'folder-1' },
        { ...cardFixtures.imageCard, folderId: 'folder-2' },
      ]
      
      render(
        <TestWrapper>
          <DashboardSidebar />
          <MagneticCardGrid
            cards={cards}
            onDragEnd={jest.fn()}
            onCardClick={jest.fn()}
          />
        </TestWrapper>
      )
      
      // 通过文件夹筛选
      const folderFilter = screen.getByText('Folder 1')
      fireEvent.click(folderFilter)
      
      // 验证筛选结果
      await waitFor(() => {
        expect(screen.getByText('Simple Text Card')).toBeInTheDocument()
        expect(screen.queryByText('Image Card')).not.toBeInTheDocument()
      })
    })

    it('应该支持搜索功能', async () => {
      render(
        <TestWrapper>
          <DashboardSidebar />
          <MagneticCardGrid
            cards={[cardFixtures.textCard, cardFixtures.imageCard]}
            onDragEnd={jest.fn()}
            onCardClick={jest.fn()}
          />
        </TestWrapper>
      )
      
      // 输入搜索关键词
      const searchInput = screen.getByPlaceholderText(/search/i)
      fireEvent.change(searchInput, { target: { value: 'Simple' } })
      
      // 验证搜索结果
      await waitFor(() => {
        expect(screen.getByText('Simple Text Card')).toBeInTheDocument()
        expect(screen.queryByText('Image Card')).not.toBeInTheDocument()
      })
    })
  })

  describe('响应式设计交互', () => {
    it('应该在移动端适配触摸操作', async () => {
      // 模拟移动端设备
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 667 })
      
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )
      
      // 验证移动端布局
      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('mobile-optimized')
      
      // 测试触摸滑动
      const card = screen.getByText('Test Card')
      fireEvent.touchStart(card, { touches: [{ clientX: 0, clientY: 0 }] })
      fireEvent.touchMove(card, { touches: [{ clientX: 100, clientY: 0 }] })
      fireEvent.touchEnd(card)
      
      // 验证滑动响应
      await waitFor(() => {
        expect(card).toHaveClass('swiped')
      })
    })

    it('应该在桌面端适配拖拽操作', async () => {
      // 模拟桌面端设备
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1920 })
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 1080 })
      
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )
      
      // 验证桌面端布局
      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('desktop-optimized')
      
      // 测试拖拽操作
      const card = screen.getByText('Test Card')
      fireEvent.dragStart(card)
      
      // 验证拖拽响应
      await waitFor(() => {
        expect(card).toHaveClass('dragging')
      })
    })
  })

  describe('键盘导航交互', () => {
    it('应该支持键盘导航', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )
      
      // 使用Tab键导航
      const card = screen.getByText('Test Card')
      
      fireEvent.keyDown(card, { key: 'Tab' })
      expect(card).toHaveFocus()
      
      // 使用空格键激活卡片
      fireEvent.keyDown(card, { key: ' ' })
      expect(card).toHaveClass('active')
      
      // 使用Enter键编辑卡片
      fireEvent.keyDown(card, { key: 'Enter' })
      expect(screen.getByDisplayValue('Test Card')).toBeInTheDocument()
      
      // 使用Delete键删除卡片
      fireEvent.keyDown(card, { key: 'Delete' })
      expect(screen.getByText(/confirm delete/i)).toBeInTheDocument()
    })

    it('应该支持快捷键操作', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )
      
      // 使用Ctrl+N创建新卡片
      fireEvent.keyDown(document, { key: 'n', ctrlKey: true })
      expect(screen.getByPlaceholderText(/card title/i)).toBeInTheDocument()
      
      // 使用Ctrl+F搜索
      fireEvent.keyDown(document, { key: 'f', ctrlKey: true })
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
      
      // 使用Ctrl+T管理标签
      fireEvent.keyDown(document, { key: 't', ctrlKey: true })
      expect(screen.getByText(/tags/i)).toBeInTheDocument()
    })
  })

  describe('可访问性交互', () => {
    it('应该支持屏幕阅读器', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )
      
      const card = screen.getByText('Test Card')
      
      // 验证ARIA属性
      expect(card).toHaveAttribute('role', 'article')
      expect(card).toHaveAttribute('aria-label', expect.stringContaining('Test Card'))
      
      // 验证实时区域更新
      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toBeInTheDocument()
    })

    it('应该通过可访问性测试', async () => {
      const { container } = render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('性能优化交互', () => {
    it('应该优化大量卡片的渲染性能', async () => {
      const cards = mockDataUtils.generateCards(100)
      
      const renderTime = await performanceUtils.measureRenderTime(() => {
        render(
          <TestWrapper>
            <MagneticCardGrid
              cards={cards}
              onDragEnd={jest.fn()}
              onCardClick={jest.fn()}
            />
          </TestWrapper>
        )
      })
      
      expect(renderTime).toBeLessThan(1000) // 应该在1秒内完成渲染
    })

    it('应该优化拖拽性能', async () => {
      const cards = mockDataUtils.generateCards(50)
      
      render(
        <TestWrapper>
          <MagneticCardGrid
            cards={cards}
            onDragEnd={jest.fn()}
            onCardClick={jest.fn()}
          />
        </TestWrapper>
      )
      
      const card = screen.getByText('Card 1')
      
      // 测试拖拽性能
      const dragStartTime = performance.now()
      
      // 模拟连续拖拽操作
      for (let i = 0; i < 10; i++) {
        fireEvent.dragStart(card)
        fireEvent.dragOver(card)
        fireEvent.drop(card)
      }
      
      const dragEndTime = performance.now()
      expect(dragEndTime - dragStartTime).toBeLessThan(500) // 应该在500ms内完成
    })
  })

  describe('错误处理交互', () => {
    it('应该优雅处理网络错误', async () => {
      // 模拟网络错误
      jest.spyOn(global, 'fetch').mockImplementationOnce(() => 
        Promise.reject(new Error('Network error'))
      )
      
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )
      
      // 尝试同步操作
      const syncButton = screen.getByText(/sync/i)
      fireEvent.click(syncButton)
      
      // 验证错误提示
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })
      
      // 验证重试按钮
      expect(screen.getByText(/retry/i)).toBeInTheDocument()
    })

    it('应该优雅处理数据验证错误', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )
      
      // 尝试创建无效卡片
      const createButton = screen.getByText(/create card/i)
      fireEvent.click(createButton)
      
      // 不填写标题，直接保存
      const saveButton = screen.getByText(/save/i)
      fireEvent.click(saveButton)
      
      // 验证验证错误提示
      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument()
      })
    })
  })
})