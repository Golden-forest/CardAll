import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Card as CardType, CardContent as CardContentType, ImageData } from '@/types/card'
import { Button } from '@/components/ui/button'
import { ColoredBadge } from '@/components/ui/colored-badge'
import { 
  FlipHorizontal, 
  Copy, 
  Camera, 
  Share2, 
  Edit3, 
  Palette,
  MoreHorizontal,
  Tag,
  Image as ImageIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface FlipCardProps {
  card: CardType
  onFlip: (cardId: string) => void
  onUpdate: (cardId: string, updates: Partial<CardType>) => void
  onCopy: (cardId: string) => void
  onScreenshot: (cardId: string) => void
  onShare: (cardId: string) => void
  onStyleChange?: (cardId: string) => void
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function FlipCard({
  card,
  onFlip,
  onUpdate,
  onCopy,
  onScreenshot,
  onShare,
  onStyleChange,
  className,
  size = 'md'
}: FlipCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const currentContent = card.isFlipped ? card.backContent : card.frontContent

  // Size variants - 确保所有尺寸都使用完整宽度
  const sizeClasses = {
    sm: 'w-full',
    md: 'w-full', 
    lg: 'w-full'
  }

  // 内容区域的padding控制，不限制宽度
  const contentPaddingClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5'
  }

  // Style generation based on card.style
  const getCardStyles = () => {
    const { style } = card
    const baseStyles: React.CSSProperties = {
      borderRadius: '1rem', // 统一使用16px圆角
      fontFamily: style.fontFamily,
      fontSize: style.fontSize === 'sm' ? '0.875rem' : 
                style.fontSize === 'lg' ? '1.125rem' : '1rem',
      fontWeight: style.fontWeight,
      color: style.textColor,
      borderWidth: style.borderWidth || 0,
      borderColor: style.borderColor,
    }

    if (style.type === 'gradient' && style.gradientColors) {
      baseStyles.background = `linear-gradient(135deg, ${style.gradientColors.join(', ')})`
    } else {
      baseStyles.backgroundColor = style.backgroundColor
    }

    // Add shadow
    const shadowClasses: Record<string, string> = {
      sm: 'shadow-sm',
      md: 'shadow-md',
      lg: 'shadow-lg',
      xl: 'shadow-xl',
      none: '',
      '2xl': 'shadow-2xl'
    }

    return {
      style: baseStyles,
      shadowClass: shadowClasses[style.shadow || 'md'] || 'shadow-md'
    }
  }

  const { style: cardStyles, shadowClass } = getCardStyles()

  const handleFlip = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onFlip(card.id)
  }, [card.id, onFlip])

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
  }

  const handleContentUpdate = (field: keyof CardContentType, value: any) => {
    const contentKey = card.isFlipped ? 'backContent' : 'frontContent'
    const updates = {
      [contentKey]: {
        ...currentContent,
        [field]: value,
        lastModified: new Date()
      }
    } as Partial<CardType>
    onUpdate(card.id, updates)
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleContentUpdate('title', e.target.value)
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleContentUpdate('text', e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false)
    }
    if (e.key === 'Enter' && e.ctrlKey) {
      setIsEditing(false)
    }
  }

  return (
    <div 
      className={cn("relative group", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Simplified Card Container with Fade Animation */}
      <div 
        ref={cardRef}
        className={cn(
          "relative transition-all duration-300 ease-in-out",
          sizeClasses[size]
        )}
        style={{ 
          minHeight: 'fit-content',
          width: '100%'
        }}
      >
        {/* Front Side */}
        {!card.isFlipped && (
          <div 
            className={cn(
              "w-full flex flex-col transition-opacity duration-300",
              shadowClass,
              contentPaddingClasses[size]
            )}
            style={{
              ...cardStyles,
              borderRadius: cardStyles.borderRadius
            }}
          >
            <CardSide
              content={card.frontContent}
              isEditing={isEditing && !card.isFlipped}
              onTitleChange={handleTitleChange}
              onTextChange={handleTextChange}
              onKeyDown={handleKeyDown}
              sideLabel="Front"
              isHovered={isHovered}
              onEdit={handleEdit}
              onFlip={handleFlip}
              onCopy={() => onCopy(card.id)}
              onScreenshot={() => onScreenshot(card.id)}
              onShare={() => onShare(card.id)}
              onStyleChange={onStyleChange ? () => onStyleChange(card.id) : undefined}
              card={card}
            />
          </div>
        )}

        {/* Back Side */}
        {card.isFlipped && (
          <div 
            className={cn(
              "w-full flex flex-col transition-opacity duration-300",
              shadowClass,
              contentPaddingClasses[size]
            )}
            style={{
              ...cardStyles,
              borderRadius: cardStyles.borderRadius
            }}
          >
            <CardSide
              content={card.backContent}
              isEditing={isEditing && card.isFlipped}
              onTitleChange={handleTitleChange}
              onTextChange={handleTextChange}
              onKeyDown={handleKeyDown}
              sideLabel="Back"
              isHovered={isHovered}
              onEdit={handleEdit}
              onFlip={handleFlip}
              onCopy={() => onCopy(card.id)}
              onScreenshot={() => onScreenshot(card.id)}
              onShare={() => onShare(card.id)}
              onStyleChange={onStyleChange ? () => onStyleChange(card.id) : undefined}
              card={card}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Card Side Component
interface CardSideProps {
  content: CardContentType
  isEditing: boolean
  onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  sideLabel: string
  isHovered: boolean
  onEdit: (e: React.MouseEvent) => void
  onFlip: (e: React.MouseEvent) => void
  onCopy: () => void
  onScreenshot: () => void
  onShare: () => void
  onStyleChange?: () => void
  card: CardType
}

function CardSide({
  content,
  isEditing,
  onTitleChange,
  onTextChange,
  onKeyDown,
  sideLabel,
  isHovered,
  onEdit,
  onFlip,
  onCopy,
  onScreenshot,
  onShare,
  onStyleChange,
  card
}: CardSideProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header with Title and Action Buttons */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 mr-2">
          {isEditing ? (
            <input
              type="text"
              value={content.title}
              onChange={onTitleChange}
              onKeyDown={onKeyDown}
              className="w-full bg-transparent border-none outline-none text-lg font-semibold resize-none"
              placeholder="Card title..."
              autoFocus
            />
          ) : (
            <h3 className="text-lg font-semibold text-left">
              {content.title || 'Untitled Card'}
            </h3>
          )}
        </div>

        {/* Action Buttons - Inline */}
        <div className={cn(
          "flex gap-1 transition-all duration-200 flex-shrink-0",
          isHovered || isEditing ? "opacity-100" : "opacity-60"
        )}>
          {/* Flip Button */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 rounded-md hover:bg-black/10"
            onClick={onFlip}
            title={`Flip to ${card.isFlipped ? 'Front' : 'Back'}`}
          >
            <FlipHorizontal className="h-3.5 w-3.5" />
          </Button>

          {/* More Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 rounded-md hover:bg-black/10"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onEdit}>
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Content
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCopy}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onScreenshot}>
                <Camera className="h-4 w-4 mr-2" />
                Screenshot
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {onStyleChange && (
                <DropdownMenuItem onClick={onStyleChange}>
                  <Palette className="h-4 w-4 mr-2" />
                  Change Style
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Images */}
      {content.images.length > 0 && (
        <div className="mb-3 flex-shrink-0">
          <div className="grid grid-cols-2 gap-2">
            {content.images.slice(0, 4).map((image: ImageData, index: number) => (
              <div key={index} className="relative aspect-video rounded-md overflow-hidden bg-muted">
                <img
                  src={image.url}
                  alt={image.alt || `Image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          {content.images.length > 4 && (
            <div className="text-xs text-muted-foreground mt-1 text-center">
              +{content.images.length - 4} more images
            </div>
          )}
        </div>
      )}

      {/* Text Content */}
      <div className="flex-1 mb-3">
        {isEditing ? (
          <textarea
            value={content.text}
            onChange={onTextChange}
            onKeyDown={onKeyDown}
            className="w-full h-full bg-transparent border-none outline-none resize-none text-sm leading-relaxed min-h-[100px]"
            placeholder="Add your content here..."
          />
        ) : (
          <div className="text-sm leading-relaxed text-left">
            <p className="whitespace-pre-wrap">
              {content.text || 'Click to add content...'}
            </p>
          </div>
        )}
      </div>

      {/* Footer with Tags and Image Count */}
      <div className="mt-auto">
        {/* Tags */}
        {content.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {content.tags.slice(0, 4).map((tag, index) => (
              <ColoredBadge key={index} className="text-xs">
                {tag}
              </ColoredBadge>
            ))}
            {content.tags.length > 4 && (
              <ColoredBadge className="text-xs" colorIndex={7}>
                +{content.tags.length - 4}
              </ColoredBadge>
            )}
          </div>
        )}

        {/* Image Count */}
        {content.images.length > 0 && (
          <div className="flex items-center justify-end text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              <span>{content.images.length}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
