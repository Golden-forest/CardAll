import React, { useMemo, useCallback, useRef, useEffect } from 'react'
import Masonry from 'react-masonry-css'
import { Card as CardType } from '@/types/card'
import { EnhancedFlipCard } from './enhanced-flip-card'
import { useResizeObserver } from '@/hooks/use-resize-observer'
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
  className
}: MasonryCardGridProps) {
  const masonryRef = useRef<HTMLDivElement>(null)
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Use ResizeObserver to detect container size changes
  const containerRef = useResizeObserver<HTMLDivElement>({
    onResize: () => {
      // Trigger masonry reflow when container resizes
      if (masonryRef.current) {
        window.dispatchEvent(new Event('resize'))
      }
    },
    debounceMs: 150
  })

  // Sort cards by creation date (newest first)
  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [cards])

  // Responsive breakpoints for columns
  const breakpointColumnsObj = useMemo(() => {
    // Type-safe breakpoint configuration
    const createBreakpoints = (config: Record<string | number, number>) => config

    // Adjust based on card size
    if (cardSize === 'sm') {
      return createBreakpoints({
        default: 5,
        1280: 5,
        1024: 4,
        768: 3,
        640: 2,
        480: 1
      })
    } else if (cardSize === 'lg') {
      return createBreakpoints({
        default: 3,
        1280: 3,
        1024: 2,
        768: 2,
        640: 1
      })
    }

    // Base columns for medium size
    return createBreakpoints({
      default: 4,  // 4 columns on large screens
      1280: 4,     // xl: 4 columns
      1024: 3,     // lg: 3 columns  
      768: 2,      // md: 2 columns
      640: 1       // sm: 1 column
    })
  }, [cardSize])

  // Handle card flip with improved reflow
  const handleCardFlip = useCallback((cardId: string) => {
    onCardFlip(cardId)
    
    // Multiple reflow attempts for better layout stability
    const triggerReflow = () => {
      if (masonryRef.current) {
        // Force reflow by triggering a resize event
        window.dispatchEvent(new Event('resize'))
        
        // Additional reflow after a short delay
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'))
        }, 50)
      }
    }
    
    // Immediate reflow
    requestAnimationFrame(triggerReflow)
    
    // Reflow after flip animation completes
    setTimeout(triggerReflow, 350)
  }, [onCardFlip])

  // Handle card updates with reflow
  const handleCardUpdate = useCallback((cardId: string, updates: Partial<CardType>) => {
    onCardUpdate(cardId, updates)
    
    // Debounced reflow for content changes
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current)
    }
    
    resizeTimeoutRef.current = setTimeout(() => {
      if (masonryRef.current) {
        window.dispatchEvent(new Event('resize'))
      }
    }, 150)
  }, [onCardUpdate])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
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
    <div ref={containerRef} className={cn("p-6", className)}>
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

      {/* Masonry Grid */}
      <div ref={masonryRef}>
        <Masonry
          breakpointCols={breakpointColumnsObj}
          className="my-masonry-grid"
          columnClassName="my-masonry-grid_column"
        >
          {sortedCards.map((card) => (
            <div key={card.id} className="mb-6"> {/* Vertical spacing between cards */}
              <EnhancedFlipCard
                card={card}
                onFlip={handleCardFlip}
                onUpdate={handleCardUpdate}
                onCopy={onCardCopy}
                onScreenshot={onCardScreenshot}
                onShare={onCardShare}
                size={cardSize}
                className="w-full"
              />
            </div>
          ))}
        </Masonry>
      </div>

      {/* Load More / Pagination */}
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

export default MasonryCardGrid