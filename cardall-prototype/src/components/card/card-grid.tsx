import React, { useState, useRef } from 'react'
import { Card } from '@/types/card'
import { FlipCard } from './flip-card'
import { cn } from '@/lib/utils'

interface CardGridProps {
  cards: Card[]
  onCardUpdate: (cardId: string, updates: Partial<Card>) => void
  onCardCopy: (cardId: string) => void
  onCardScreenshot: (cardId: string) => void
  onCardShare: (cardId: string) => void
  className?: string
}

export function CardGrid({
  cards,
  onCardUpdate,
  onCardCopy,
  onCardScreenshot,
  onCardShare,
  className
}: CardGridProps) {
  const [draggedCard, setDraggedCard] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const gridRef = useRef<HTMLDivElement>(null)

  const handleCardFlip = (cardId: string) => {
    const card = cards.find(c => c.id === cardId)
    if (card) {
      onCardUpdate(cardId, { isFlipped: !card.isFlipped })
    }
  }

  const handleCardEdit = (cardId: string, content: any) => {
    onCardUpdate(cardId, content)
  }

  const handleCardStyleChange = (cardId: string, theme: any) => {
    onCardUpdate(cardId, { theme })
  }

  // Drag start
  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    setDraggedCard(cardId)
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    e.dataTransfer.effectAllowed = 'move'
  }

  // Drag end
  const handleDragEnd = () => {
    setDraggedCard(null)
    setDragOffset({ x: 0, y: 0 })
  }

  // Drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  // Drop card
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedCard || !gridRef.current) return

    const gridRect = gridRef.current.getBoundingClientRect()
    const newPosition = {
      x: e.clientX - gridRect.left - dragOffset.x,
      y: e.clientY - gridRect.top - dragOffset.y
    }

    // Check magnetic snap
    const targetCard = findNearbyCard(newPosition, draggedCard)
    if (targetCard) {
      // Implement magnetic snap logic
      const magneticPosition = calculateMagneticPosition(newPosition, targetCard)
      onCardUpdate(draggedCard, { position: magneticPosition })
    } else {
      onCardUpdate(draggedCard, { position: newPosition })
    }

    handleDragEnd()
  }

  // Find nearby cards
  const findNearbyCard = (position: { x: number; y: number }, excludeId: string) => {
    const threshold = 50 // Snap distance threshold
    return cards.find(card => {
      if (card.id === excludeId) return false
      const distance = Math.sqrt(
        Math.pow(card.position.x - position.x, 2) + 
        Math.pow(card.position.y - position.y, 2)
      )
      return distance < threshold
    })
  }

  // Calculate magnetic snap position
  const calculateMagneticPosition = (
    dragPosition: { x: number; y: number }, 
    targetCard: Card
  ) => {
    // Simplified snap logic, should be more complex in reality
    return {
      x: targetCard.position.x + targetCard.size.width + 20,
      y: targetCard.position.y
    }
  }

  return (
    <div
      ref={gridRef}
      className={cn(
        "relative min-h-screen p-8",
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
        "auto-rows-min",
        className
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {cards.map((card) => (
        <div
          key={card.id}
          draggable
          onDragStart={(e) => handleDragStart(e, card.id)}
          onDragEnd={handleDragEnd}
          className={cn(
            "transform transition-transform duration-200",
            draggedCard === card.id && "scale-105 rotate-2 opacity-80"
          )}
        >
          <FlipCard
            card={card}
            onFlip={handleCardFlip}
            onEdit={handleCardEdit}
            onCopy={onCardCopy}
            onScreenshot={onCardScreenshot}
            onShare={onCardShare}
            onStyleChange={handleCardStyleChange}
            className="h-full"
          />
        </div>
      ))}
    </div>
  )
}