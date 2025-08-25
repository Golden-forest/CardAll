// Enhanced flip card with integrated style selection

import React, { useState } from 'react'
import { Card as CardType } from '../../types/card'
import { FlipCard } from './flip-card'
import { StylePanel } from './styles/style-panel'
import { useStyleSelection } from '../../hooks/use-style-selection'

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
  const handleStyleChange = (cardId: string, newStyle: any) => {
    onUpdate(cardId, { 
      style: newStyle,
      updatedAt: new Date()
    })
  }

  const {
    isPanelOpen,
    openStylePanel,
    closeStylePanel,
    styleApplicationContext
  } = useStyleSelection({
    cardId: card.id,
    currentStyle: card.style,
    onStyleChange: handleStyleChange
  })

  const handleStyleChangeClick = () => {
    openStylePanel()
  }

  return (
    <>
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

      <StylePanel
        isOpen={isPanelOpen}
        onClose={closeStylePanel}
        context={styleApplicationContext}
      />
    </>
  )
}

export default EnhancedFlipCard