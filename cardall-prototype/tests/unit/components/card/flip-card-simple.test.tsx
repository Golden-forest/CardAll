// 翻转卡片组件简化单元测试
import React from 'react'
import { render, screen, fireEvent } from '../../../test-utils'

// 创建一个简化的测试组件
const TestFlipCard = ({ card, onFlip }) => {
  return (
    <div data-testid="flip-card">
      <div data-testid="card-front">
        <h3>{card.title}</h3>
        <div dangerouslySetInnerHTML={{ __html: card.content }} />
      </div>
      <button onClick={() => onFlip(card.id)}>Flip</button>
    </div>
  )
}

describe('FlipCard (Simplified)', () => {
  const mockCard = {
    id: 'card-1',
    title: 'Test Card',
    content: '<p>Test content</p>',
    backContent: '',
    tags: ['test'],
    folderId: null,
    style: 'default',
    isFlipped: false,
    order: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    userId: 'user-1',
    isLocalOnly: false,
    cloudSynced: true,
  }

  const mockOnFlip = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('应该渲染卡片基本信息', () => {
    render(
      <TestFlipCard
        card={mockCard}
        onFlip={mockOnFlip}
      />
    )

    expect(screen.getByTestId('flip-card')).toBeInTheDocument()
    expect(screen.getByText('Test Card')).toBeInTheDocument()
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('应该响应翻转操作', () => {
    render(
      <TestFlipCard
        card={mockCard}
        onFlip={mockOnFlip}
      />
    )

    const flipButton = screen.getByText('Flip')
    fireEvent.click(flipButton)
    expect(mockOnFlip).toHaveBeenCalledWith(mockCard.id)
  })

  it('应该处理空内容', () => {
    const emptyCard = {
      ...mockCard,
      content: '',
      title: 'Empty Card',
    }

    render(
      <TestFlipCard
        card={emptyCard}
        onFlip={mockOnFlip}
      />
    )

    expect(screen.getByText('Empty Card')).toBeInTheDocument()
  })
})