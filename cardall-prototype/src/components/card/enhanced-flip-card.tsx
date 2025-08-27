// Enhanced flip card with integrated style selection

import React from 'react'
import { Card as CardType } from '../../types/card'
import { FlipCard } from './flip-card'
import { useStylePanel } from '../../contexts/style-panel-context'

interface EnhancedFlipCardProps {
  card: CardType
  onFlip: (cardId: string) => void
  onUpdate: (cardId: string, updates: Partial<CardType>) => void
  onCopy: (cardId: string) => void
  onScreenshot: (cardId: string) => void
  onShare: (cardId: string) => void
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function EnhancedFlipCard({
  card,
  onFlip,
  onUpdate,
  onCopy,
  onScreenshot,
  onShare,
  className,
  size = 'md'
}: EnhancedFlipCardProps) {
  const { openStylePanel } = useStylePanel()

  const handleStyleChange = (cardId: string, newStyle: any) => {
    onUpdate(cardId, { 
      style: newStyle,
      updatedAt: new Date()
    })
  }

  const handleStyleChangeClick = () => {
    openStylePanel({
      targetCardId: card.id,
      currentStyle: card.style,
      onStyleApply: (newStyle) => handleStyleChange(card.id, newStyle)
    })
  }

  return (
    <FlipCard
      card={card}
      onFlip={onFlip}
      onUpdate={onUpdate}
      onCopy={onCopy}
      onScreenshot={onScreenshot}
      onShare={onShare}
      onStyleChange={handleStyleChangeClick}
      className={className}
      size={size}
    />
  )
}

export default EnhancedFlipCard