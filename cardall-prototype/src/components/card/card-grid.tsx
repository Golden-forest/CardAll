import React, { useMemo } from 'react'
import { Card as CardType } from '@/types/card'
import { EnhancedFlipCard } from './enhanced-flip-card'
import { MasonryCardGrid } from './masonry-card-grid'
import { cn } from '@/lib/utils'

interface CardGridProps {
  cards: CardType[]
  onCardFlip: (cardId: string) => void
  onCardUpdate: (cardId: string, updates: Partial<CardType>) => void
  onCardCopy: (cardId: string) => void
  onCardScreenshot: (cardId: string) => void
  onCardShare: (cardId: string) => void
  onCardStyleChange?: (cardId: string) => void
  layout?: 'grid' | 'masonry' | 'list'
  cardSize?: 'sm' | 'md' | 'lg'
  className?: string
}

export function CardGrid({
  cards,
  onCardFlip,
  onCardUpdate,
  onCardCopy,
  onCardScreenshot,
  onCardShare,
  onCardStyleChange,
  layout = 'masonry',
  cardSize = 'md',
  className
}: CardGridProps) {
  // Sort cards by creation date (newest first)
  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [cards])

  if (cards.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 mx-auto rounded-full bg-muted flex items-center justify-center">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">+</span>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">No cards yet</h3>
            <p className="text-muted-foreground max-w-sm">
              Create your first knowledge card to get started. Click the + button to begin.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const getGridClasses = () => {
    switch (layout) {
      case 'grid':
        return cn(
          "grid gap-8 auto-rows-max", // 增加间距到32px
          cardSize === 'sm' && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
          cardSize === 'md' && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          cardSize === 'lg' && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        )
      case 'masonry':
        return cn(
          "columns-1 gap-8", // 增加列间距
          cardSize === 'sm' && "sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5",
          cardSize === 'md' && "sm:columns-2 lg:columns-3 xl:columns-4",
          cardSize === 'lg' && "sm:columns-2 lg:columns-3"
        )
      case 'list':
        return "flex flex-col gap-6" // 增加列表间距
      default:
        return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
    }
  }

  // Use new MasonryCardGrid for masonry layout
  if (layout === 'masonry') {
    return (
      <MasonryCardGrid
        cards={cards}
        onCardFlip={onCardFlip}
        onCardUpdate={onCardUpdate}
        onCardCopy={onCardCopy}
        onCardScreenshot={onCardScreenshot}
        onCardShare={onCardShare}
        onCardStyleChange={onCardStyleChange}
        cardSize={cardSize}
        className={className}
      />
    )
  }

  // Fallback to original grid/list layouts
  return (
    <div className={cn("p-6", className)}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Your Cards</h2>
            <p className="text-muted-foreground">
              {cards.length} {cards.length === 1 ? 'card' : 'cards'}
            </p>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className={getGridClasses()}>
        {sortedCards.map((card) => (
          <div 
            key={card.id} 
            className="break-inside-avoid"
          >
            <EnhancedFlipCard
              card={card}
              onFlip={onCardFlip}
              onUpdate={onCardUpdate}
              onCopy={onCardCopy}
              onScreenshot={onCardScreenshot}
              onShare={onCardShare}
              size={cardSize}
              className="w-full"
            />
          </div>
        ))}
      </div>

      {/* Load More / Pagination could go here */}
      {cards.length > 20 && (
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            Showing {Math.min(20, cards.length)} of {cards.length} cards
          </p>
        </div>
      )}
    </div>
  )
}