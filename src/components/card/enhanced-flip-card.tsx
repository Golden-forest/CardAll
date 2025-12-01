// Enhanced flip card with integrated style and tag selection
import React, { useCallback } from 'react'
import { Card as CardType } from '../../types/card'
import { FlipCard } from './flip-card'
import { useStylePanel } from '../../contexts/style-panel-context'
import { useTagPanel } from '../../contexts/tag-panel-context'
import { useFolderPanel } from '../../contexts/folder-panel-context'

interface EnhancedFlipCardProps {
  card: CardType
  onFlip: (cardId: string) => void
  onUpdate: (cardId: string, updates: Partial<CardType>) => void
  onCopy: (cardId: string) => void
  onScreenshot: (cardId: string) => void
  onShare: (cardId: string) => void
  onDelete: (cardId: string) => void
  onMoveToFolder?: (cardId: string, folderId: string | null) => void
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
  onDelete,
  onMoveToFolder,
  className,
  size = 'md'
}: EnhancedFlipCardProps) {
  const { openStylePanel } = useStylePanel()
  const { openTagPanel } = useTagPanel()
  const { openFolderPanel } = useFolderPanel()

  const handleStyleChangeClick = useCallback(() => {
    openStylePanel({
      targetCardId: card.id,
      currentStyle: card.style,
      onStyleApply: (newStyle) => {
        onUpdate(card.id, {
          style: newStyle,
          updatedAt: new Date()
        })
      },
      onPanelClose: () => {} // Add empty callback for panel close
    })
  }, [card.id, card.style, onUpdate, openStylePanel])

  const handleTagsChangeClick = useCallback(() => {
    // 注意：这里暂时使用card.isFlipped，因为EnhancedFlipCard无法直接访问FlipCard的内部状态
    const currentContent = card.isFlipped ? card.backContent : card.frontContent
    const contentKey = card.isFlipped ? 'backContent' : 'frontContent'

    openTagPanel({
      targetCardId: card.id,
      currentTags: currentContent.tags,
      onTagsApply: (newTags) => {
        onUpdate(card.id, {
          [contentKey]: {
            ...currentContent,
            tags: newTags,
            lastModified: new Date()
          },
          updatedAt: new Date()
        })
      },
      onPanelClose: () => {}
    })
  }, [card.id, card.isFlipped, card.backContent, card.frontContent, onUpdate, openTagPanel])

  const handleMoveToFolderClick = useCallback(() => {
    if (onMoveToFolder) {
      openFolderPanel({
        targetCardId: card.id,
        currentFolderId: card.folderId,
        onFolderApply: (folderId) => onMoveToFolder(card.id, folderId),
        onPanelClose: () => {}
      })
    }
  }, [card.id, card.folderId, onMoveToFolder, openFolderPanel])

  return (
    <FlipCard
      card={card}
      onFlip={onFlip}
      onUpdate={onUpdate}
      onCopy={onCopy}
      onScreenshot={onScreenshot}
      onShare={onShare}
      onDelete={onDelete}
      onStyleChange={handleStyleChangeClick}
      onTagsChange={handleTagsChangeClick}
      onMoveToFolder={onMoveToFolder ? handleMoveToFolderClick : undefined}
      className={className}
      size={size}
    />
  )
}

