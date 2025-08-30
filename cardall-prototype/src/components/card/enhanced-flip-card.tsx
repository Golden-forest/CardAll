// Enhanced flip card with integrated style and tag selection
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
      onStyleApply: (newStyle) => handleStyleChange(card.id, newStyle),
      onPanelClose: () => {} // Add empty callback for panel close
    })
  }

  const handleTagsChange = (cardId: string, newTags: string[]) => {
    const currentContent = card.isFlipped ? card.backContent : card.frontContent
    const contentKey = card.isFlipped ? 'backContent' : 'frontContent'
    
    onUpdate(cardId, {
      [contentKey]: {
        ...currentContent,
        tags: newTags,
        lastModified: new Date()
      },
      updatedAt: new Date()
    })
  }

  const handleTagsChangeClick = () => {
    const currentContent = card.isFlipped ? card.backContent : card.frontContent
    openTagPanel({
      targetCardId: card.id,
      currentTags: currentContent.tags,
      onTagsApply: (newTags) => handleTagsChange(card.id, newTags),
      onPanelClose: () => {}
    })
  }

  const handleMoveToFolderClick = () => {
    if (onMoveToFolder) {
      openFolderPanel({
        targetCardId: card.id,
        currentFolderId: card.folderId,
        onFolderApply: (folderId) => onMoveToFolder(card.id, folderId),
        onPanelClose: () => {}
      })
    }
  }

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

export default EnhancedFlipCard