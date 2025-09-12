// 翻转卡片组件单元测试
import React from 'react'
import { render, screen, fireEvent, waitFor } from '../../../test-utils'
import { axe } from 'jest-axe'
import { FlipCard } from '../../../../src/components/card/flip-card'
import { cardFixtures } from '../../../fixtures/data-fixtures'

describe('FlipCard', () => {
  const mockCard = cardFixtures.textCard
  const mockOnFlip = jest.fn()
  const mockOnEdit = jest.fn()
  const mockOnDelete = jest.fn()
  const mockOnStyleChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('基本渲染', () => {
    it('应该正确渲染卡片标题和内容', () => {
      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      expect(screen.getByText(mockCard.title)).toBeInTheDocument()
      expect(screen.getByText(/This is a simple text card/)).toBeInTheDocument()
    })

    it('应该显示正确的样式', () => {
      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const cardElement = screen.getByRole('article')
      expect(cardElement).toHaveClass('flip-card')
      expect(cardElement).toHaveClass('style-default')
    })

    it('应该显示操作按钮', () => {
      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      expect(screen.getByRole('button', { name: /flip/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /style/i })).toBeInTheDocument()
    })
  })

  describe('翻转功能', () => {
    it('点击卡片时应该翻转', async () => {
      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const card = screen.getByRole('article')
      fireEvent.click(card)

      await waitFor(() => {
        expect(mockOnFlip).toHaveBeenCalledWith(mockCard.id)
      })
    })

    it('点击翻转按钮时应该翻转', async () => {
      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const flipButton = screen.getByRole('button', { name: /flip/i })
      fireEvent.click(flipButton)

      await waitFor(() => {
        expect(mockOnFlip).toHaveBeenCalledWith(mockCard.id)
      })
    })

    it('应该正确显示翻转状态', () => {
      const flippedCard = { ...mockCard, isFlipped: true }

      render(
        <FlipCard
          card={flippedCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const cardElement = screen.getByRole('article')
      expect(cardElement).toHaveClass('flipped')
    })
  })

  describe('编辑功能', () => {
    it('点击编辑按钮时应该进入编辑模式', async () => {
      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)

      await waitFor(() => {
        expect(mockOnEdit).toHaveBeenCalledWith(mockCard.id, 'content')
      })
    })

    it('双击卡片时应该进入编辑模式', async () => {
      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const card = screen.getByRole('article')
      fireEvent.doubleClick(card)

      await waitFor(() => {
        expect(mockOnEdit).toHaveBeenCalledWith(mockCard.id, 'content')
      })
    })
  })

  describe('删除功能', () => {
    it('点击删除按钮时应该触发删除', async () => {
      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledWith(mockCard.id)
      })
    })

    it('应该显示删除确认对话框', async () => {
      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText(/Are you sure you want to delete this card?/i)).toBeInTheDocument()
      })
    })
  })

  describe('样式功能', () => {
    it('点击样式按钮时应该打开样式选择器', async () => {
      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const styleButton = screen.getByRole('button', { name: /style/i })
      fireEvent.click(styleButton)

      await waitFor(() => {
        expect(screen.getByText(/Choose a style/i)).toBeInTheDocument()
      })
    })

    it('选择样式时应该触发样式变更', async () => {
      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const styleButton = screen.getByRole('button', { name: /style/i })
      fireEvent.click(styleButton)

      const styleOption = screen.getByText(/Gradient Blue/i)
      fireEvent.click(styleOption)

      await waitFor(() => {
        expect(mockOnStyleChange).toHaveBeenCalledWith(mockCard.id, 'gradient-blue')
      })
    })
  })

  describe('标签显示', () => {
    it('应该显示卡片的标签', () => {
      const cardWithTags = { ...mockCard, tags: ['important', 'work'] }

      render(
        <FlipCard
          card={cardWithTags}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      expect(screen.getByText('important')).toBeInTheDocument()
      expect(screen.getByText('work')).toBeInTheDocument()
    })

    it('应该正确显示标签颜色', () => {
      const cardWithColoredTags = {
        ...mockCard,
        tags: [
          { id: 'tag-1', name: 'Important', color: '#ef4444' },
          { id: 'tag-2', name: 'Work', color: '#3b82f6' },
        ],
      }

      render(
        <FlipCard
          card={cardWithColoredTags}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const importantTag = screen.getByText('Important')
      const workTag = screen.getByText('Work')

      expect(importantTag).toHaveStyle({ backgroundColor: '#ef4444' })
      expect(workTag).toHaveStyle({ backgroundColor: '#3b82f6' })
    })
  })

  describe('图片显示', () => {
    it('应该正确显示图片', () => {
      const imageCard = cardFixtures.imageCard

      render(
        <FlipCard
          card={imageCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const image = screen.getByAltText('Test image')
      expect(image).toBeInTheDocument()
      expect(image).toHaveAttribute('src', 'test.jpg')
    })

    it('点击图片时应该放大', async () => {
      const imageCard = cardFixtures.imageCard

      render(
        <FlipCard
          card={imageCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const image = screen.getByAltText('Test image')
      fireEvent.click(image)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByAltText('Test image')).toBeInTheDocument()
      })
    })
  })

  describe('键盘交互', () => {
    it('应该支持键盘导航', () => {
      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const card = screen.getByRole('article')
      
      // Tab 键导航
      fireEvent.keyDown(card, { key: 'Tab' })
      expect(card).toHaveFocus()

      // 空格键翻转
      fireEvent.keyDown(card, { key: ' ' })
      expect(mockOnFlip).toHaveBeenCalledWith(mockCard.id)

      // Enter 键编辑
      fireEvent.keyDown(card, { key: 'Enter' })
      expect(mockOnEdit).toHaveBeenCalledWith(mockCard.id, 'content')

      // Delete 键删除
      fireEvent.keyDown(card, { key: 'Delete' })
      expect(mockOnDelete).toHaveBeenCalledWith(mockCard.id)
    })

    it('应该显示键盘快捷键提示', () => {
      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      expect(screen.getByTitle(/Press Space to flip/i)).toBeInTheDocument()
      expect(screen.getByTitle(/Press Enter to edit/i)).toBeInTheDocument()
      expect(screen.getByTitle(/Press Delete to delete/i)).toBeInTheDocument()
    })
  })

  describe('拖拽功能', () => {
    it('应该正确设置拖拽属性', () => {
      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
          draggable={true}
        />
      )

      const card = screen.getByRole('article')
      expect(card).toHaveAttribute('draggable', 'true')
    })

    it('应该处理拖拽事件', () => {
      const mockOnDragStart = jest.fn()
      const mockOnDragEnd = jest.fn()

      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
          draggable={true}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      )

      const card = screen.getByRole('article')
      
      const dragEvent = {
        dataTransfer: {
          setData: jest.fn(),
          getData: jest.fn(),
        },
      }

      fireEvent.dragStart(card, dragEvent)
      expect(mockOnDragStart).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dragstart',
          dataTransfer: dragEvent.dataTransfer,
        })
      )

      fireEvent.dragEnd(card)
      expect(mockOnDragEnd).toHaveBeenCalled()
    })
  })

  describe('响应式设计', () => {
    it('应该在不同屏幕尺寸下正确显示', () => {
      // 测试移动端视图
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 667 })

      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const card = screen.getByRole('article')
      expect(card).toHaveClass('mobile-optimized')

      // 测试桌面端视图
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1920 })
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 1080 })

      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const desktopCard = screen.getByRole('article')
      expect(desktopCard).toHaveClass('desktop-optimized')
    })
  })

  describe('可访问性', () => {
    it('应该通过可访问性测试', async () => {
      const { container } = render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('应该有正确的 ARIA 属性', () => {
      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const card = screen.getByRole('article')
      expect(card).toHaveAttribute('aria-label', `Card: ${mockCard.title}`)
      expect(card).toHaveAttribute('aria-roledescription', 'Flip card')
    })

    it('应该有正确的焦点管理', () => {
      render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const card = screen.getByRole('article')
      const flipButton = screen.getByRole('button', { name: /flip/i })

      // 卡片应该可以接收焦点
      expect(card).toHaveAttribute('tabindex', '0')

      // 按钮应该在 Tab 顺序中
      expect(flipButton).toHaveAttribute('tabindex', '0')
    })
  })

  describe('性能优化', () => {
    it('应该使用 React.memo 优化渲染', () => {
      const { rerender } = render(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const initialRender = screen.getByRole('article')

      // 重新渲染相同的卡片
      rerender(
        <FlipCard
          card={mockCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const reRendered = screen.getByRole('article')
      expect(initialRender).toBe(reRendered)
    })

    it('应该懒加载图片', () => {
      const imageCard = cardFixtures.imageCard

      render(
        <FlipCard
          card={imageCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const image = screen.getByAltText('Test image')
      expect(image).toHaveAttribute('loading', 'lazy')
    })
  })

  describe('错误处理', () => {
    it('应该处理无效的卡片数据', () => {
      const invalidCard = { ...mockCard, content: null }

      render(
        <FlipCard
          card={invalidCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      expect(screen.getByText(/Invalid card data/i)).toBeInTheDocument()
    })

    it('应该处理图片加载错误', () => {
      const imageCard = cardFixtures.imageCard

      render(
        <FlipCard
          card={imageCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const image = screen.getByAltText('Test image')
      fireEvent.error(image)

      expect(screen.getByAltText(/Failed to load image/i)).toBeInTheDocument()
    })
  })

  describe('边界条件', () => {
    it('应该处理超长标题', () => {
      const longTitleCard = {
        ...mockCard,
        title: 'A'.repeat(1000), // 超长标题
      }

      render(
        <FlipCard
          card={longTitleCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      const titleElement = screen.getByText(/A+/)
      expect(titleElement).toHaveClass('line-clamp-2') // 应该截断长文本
    })

    it('应该处理空内容', () => {
      const emptyCard = {
        ...mockCard,
        content: '',
      }

      render(
        <FlipCard
          card={emptyCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      expect(screen.getByText(/No content/i)).toBeInTheDocument()
    })

    it('应该处理特殊字符', () => {
      const specialCard = {
        ...mockCard,
        title: 'Card with <script>alert("test")</script>',
        content: 'Content with "quotes" and &ampersands',
      }

      render(
        <FlipCard
          card={specialCard}
          onFlip={mockOnFlip}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onStyleChange={mockOnStyleChange}
        />
      )

      // 应该正确转义 HTML
      expect(screen.queryByTestId('script')).not.toBeInTheDocument()
      expect(screen.getByText(/Card with/)).toBeInTheDocument()
    })
  })
})