import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card as CardType } from '@/types/card'
import { EnhancedFlipCard } from './enhanced-flip-card'
import { useMasonryLayout, MasonryItem } from '@/hooks/use-masonry-layout'
import { cn } from '@/lib/utils'

interface MasonryCardGridProps {
  cards: CardType[]
  onCardFlip: (cardId: string) => void
  onCardUpdate: (cardId: string, updates: Partial<CardType>) => void
  onCardCopy: (cardId: string) => void
  onCardScreenshot: (cardId: string) => void
  onCardShare: (cardId: string) => void
  onCardStyleChange?: (cardId: string) => void
  cardSize?: 'sm' | 'md' | 'lg'
  className?: string
  gap?: number
}

interface CardWithHeight extends CardType {
  estimatedHeight?: number
}

export function MasonryCardGrid({
  cards,
  onCardFlip,
  onCardUpdate,
  onCardCopy,
  onCardScreenshot,
  onCardShare,
  onCardStyleChange,
  cardSize = 'md',
  className,
  gap = 16
}: MasonryCardGridProps) {
  const [cardHeights, setCardHeights] = useState<Map<string, number>>(new Map())
  const [isInitialized, setIsInitialized] = useState(false)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Estimate initial card heights based on content
  const estimateCardHeight = useCallback((card: CardType): number => {
    const baseHeight = cardSize === 'sm' ? 200 : cardSize === 'lg' ? 300 : 250
    const titleLines = Math.ceil(card.frontContent.title.length / 30)
    const textLines = Math.ceil(card.frontContent.text.length / 50)
    const imageHeight = card.frontContent.images.length > 0 ? 120 : 0
    const tagHeight = card.frontContent.tags.length > 0 ? 32 : 0
    
    return baseHeight + (titleLines * 20) + (textLines * 16) + imageHeight + tagHeight
  }, [cardSize])

  // Create masonry items from cards
  const masonryItems: MasonryItem[] = cards.map(card => ({
    id: card.id,
    height: cardHeights.get(card.id) || estimateCardHeight(card)
  }))

  // Configure masonry layout with responsive breakpoints
  const {
    containerRef,
    positions,
    containerHeight,
    config,
    updateItemHeight
  } = useMasonryLayout({
    items: masonryItems,
    gap,
    minColumnWidth: cardSize === 'sm' ? 240 : cardSize === 'lg' ? 320 : 280,
    maxColumns: cardSize === 'sm' ? 6 : cardSize === 'lg' ? 3 : 4,
    breakpoints: {
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      '2xl': 1536
    }
  })

  // Measure actual card heights after render
  const measureCardHeight = useCallback((cardId: string) => {
    const cardElement = cardRefs.current.get(cardId)
    if (!cardElement) return

    // Use ResizeObserver for accurate height measurement
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const newHeight = entry.contentRect.height
        const currentHeight = cardHeights.get(cardId)
        
        if (Math.abs(newHeight - (currentHeight || 0)) > 5) {
          setCardHeights(prev => new Map(prev.set(cardId, newHeight)))
          updateItemHeight(cardId, newHeight)
        }
      }
    })

    resizeObserver.observe(cardElement)
    return () => resizeObserver.disconnect()
  }, [cardHeights, updateItemHeight])

  // Initialize card height measurements
  useEffect(() => {
    if (!isInitialized && cards.length > 0) {
      // Set initial estimated heights
      const initialHeights = new Map<string, number>()
      cards.forEach(card => {
        initialHeights.set(card.id, estimateCardHeight(card))
      })
      setCardHeights(initialHeights)
      setIsInitialized(true)
    }
  }, [cards, estimateCardHeight, isInitialized])

  // Measure card heights after DOM updates
  useEffect(() => {
    const cleanupFunctions: (() => void)[] = []
    
    cards.forEach(card => {
      const cleanup = measureCardHeight(card.id)
      if (cleanup) cleanupFunctions.push(cleanup)
    })

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup())
    }
  }, [cards, measureCardHeight])

  // Handle card ref assignment
  const setCardRef = useCallback((cardId: string, element: HTMLDivElement | null) => {
    if (element) {
      cardRefs.current.set(cardId, element)
    } else {
      cardRefs.current.delete(cardId)
    }
  }, [])

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

  return (
    <div className={cn("p-6", className)}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Your Cards</h2>
            <p className="text-muted-foreground">
              {cards.length} {cards.length === 1 ? 'card' : 'cards'} • {config.columns} columns
            </p>
          </div>
        </div>
      </div>

      {/* Masonry Container */}
      <div
        ref={containerRef}
        className="relative w-full"
        style={{ height: containerHeight }}
      >
        {cards.map((card) => {
          const position = positions.get(card.id)
          if (!position) return null

          return (
            <div
              key={card.id}
              ref={(el) => setCardRef(card.id, el)}
              className="absolute transition-all duration-300 ease-out"
              style={{
                transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                width: position.width,
                willChange: 'transform'
              }}
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
          )
        })}
      </div>

      {/* Load More Indicator */}
      {cards.length > 50 && (
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            Showing {Math.min(50, cards.length)} of {cards.length} cards
          </p>
        </div>
      )}
    </div>
  )
}