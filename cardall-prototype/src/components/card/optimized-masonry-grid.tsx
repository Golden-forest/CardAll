import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Card as CardType } from '@/types/card'
import { EnhancedFlipCard } from './enhanced-flip-card'
import { useMasonryLayout, MasonryItem } from '@/hooks/use-masonry-layout'
import { cn } from '@/lib/utils'

interface OptimizedMasonryGridProps {
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
  enableVirtualization?: boolean
  overscan?: number
}

export function OptimizedMasonryGrid({
  cards,
  onCardFlip,
  onCardUpdate,
  onCardCopy,
  onCardScreenshot,
  onCardShare,
  onCardStyleChange,
  cardSize = 'md',
  className,
  gap = 16,
  enableVirtualization = true,
  overscan = 5
}: OptimizedMasonryGridProps) {
  const [cardHeights, setCardHeights] = useState<Map<string, number>>(new Map())
  const [isInitialized, setIsInitialized] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Sort cards by creation date (newest first)
  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [cards])

  // Estimate initial card heights based on content and size
  const estimateCardHeight = useCallback((card: CardType): number => {
    const sizeMultipliers = { sm: 0.8, md: 1, lg: 1.3 }
    const multiplier = sizeMultipliers[cardSize]
    
    const baseHeight = 200 * multiplier
    const titleHeight = Math.min(Math.ceil(card.frontContent.title.length / 25), 3) * 24 * multiplier
    const textHeight = Math.min(Math.ceil(card.frontContent.text.length / 40), 8) * 18 * multiplier
    const imageHeight = card.frontContent.images.length > 0 ? 120 * multiplier : 0
    const tagHeight = card.frontContent.tags.length > 0 ? 32 * multiplier : 0
    const paddingHeight = 32 * multiplier
    
    return Math.round(baseHeight + titleHeight + textHeight + imageHeight + tagHeight + paddingHeight)
  }, [cardSize])

  // Create masonry items from cards
  const masonryItems: MasonryItem[] = useMemo(() => 
    sortedCards.map(card => ({
      id: card.id,
      height: cardHeights.get(card.id) || estimateCardHeight(card)
    })), [sortedCards, cardHeights, estimateCardHeight])

  // Configure masonry layout with responsive settings
  const masonryConfig = useMemo(() => {
    // Ensure consistent column widths across all sizes
    const configs = {
      sm: { minColumnWidth: 240, maxColumns: 5 },
      md: { minColumnWidth: 280, maxColumns: 4 },
      lg: { minColumnWidth: 320, maxColumns: 3 }
    }
    return configs[cardSize]
  }, [cardSize])

  const {
    containerRef,
    positions,
    containerHeight: masonryHeight,
    config,
    updateItemHeight
  } = useMasonryLayout({
    items: masonryItems,
    gap,
    ...masonryConfig,
    breakpoints: {
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      '2xl': 1536
    }
  })

  // Virtual scrolling: calculate visible items
  const visibleItems = useMemo(() => {
    if (!enableVirtualization || !scrollContainerRef.current) {
      return sortedCards
    }

    const viewportHeight = scrollContainerRef.current.clientHeight
    const startY = scrollTop - overscan * 100
    const endY = scrollTop + viewportHeight + overscan * 100

    return sortedCards.filter(card => {
      const position = positions.get(card.id)
      if (!position) return true // Include items without position (not yet calculated)
      
      return position.y + position.height >= startY && position.y <= endY
    })
  }, [sortedCards, positions, scrollTop, enableVirtualization, overscan])

  // Handle scroll for virtual scrolling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (enableVirtualization) {
      setScrollTop(e.currentTarget.scrollTop)
    }
  }, [enableVirtualization])

  // Measure actual card heights
  const measureCardHeight = useCallback((cardId: string) => {
    const cardElement = cardRefs.current.get(cardId)
    if (!cardElement) return

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const newHeight = entry.contentRect.height
        const currentHeight = cardHeights.get(cardId)
        
        // Only update if height changed significantly
        if (Math.abs(newHeight - (currentHeight || 0)) > 3) {
          setCardHeights(prev => {
            const updated = new Map(prev)
            updated.set(cardId, newHeight)
            return updated
          })
          updateItemHeight(cardId, newHeight)
        }
      }
    })

    resizeObserver.observe(cardElement)
    return () => resizeObserver.disconnect()
  }, [cardHeights, updateItemHeight])

  // Initialize card heights
  useEffect(() => {
    if (!isInitialized && sortedCards.length > 0) {
      const initialHeights = new Map<string, number>()
      sortedCards.forEach(card => {
        initialHeights.set(card.id, estimateCardHeight(card))
      })
      setCardHeights(initialHeights)
      setIsInitialized(true)
    }
  }, [sortedCards, estimateCardHeight, isInitialized])

  // Set up height measurements for visible cards
  useEffect(() => {
    const cleanupFunctions: (() => void)[] = []
    
    visibleItems.forEach(card => {
      const cleanup = measureCardHeight(card.id)
      if (cleanup) cleanupFunctions.push(cleanup)
    })

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup())
    }
  }, [visibleItems, measureCardHeight])

  // Handle card ref assignment
  const setCardRef = useCallback((cardId: string, element: HTMLDivElement | null) => {
    if (element) {
      cardRefs.current.set(cardId, element)
    } else {
      cardRefs.current.delete(cardId)
    }
  }, [])

  // Update container height for scroll container
  useEffect(() => {
    if (scrollContainerRef.current) {
      setContainerHeight(scrollContainerRef.current.clientHeight)
    }
  }, [])

  if (sortedCards.length === 0) {
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
    <div className={cn("flex flex-col", className)} style={{ height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="flex-shrink-0 p-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Your Cards</h2>
            <p className="text-muted-foreground">
              {sortedCards.length} {sortedCards.length === 1 ? 'card' : 'cards'} • {config.columns} columns
              {enableVirtualization && ` • ${visibleItems.length} visible`}
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Masonry Container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto px-6"
        onScroll={handleScroll}
      >
        <div
          ref={containerRef}
          className="relative w-full"
          style={{ height: masonryHeight }}
        >
          {visibleItems.map((card) => {
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
        {sortedCards.length > 100 && (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              {enableVirtualization 
                ? `Showing ${visibleItems.length} of ${sortedCards.length} cards (virtualized)`
                : `Showing all ${sortedCards.length} cards`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}