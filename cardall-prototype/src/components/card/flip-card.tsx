import React, { useState, useRef, useCallback } from 'react'
import { Card as CardType, CardContent as CardContentType, ImageData } from '@/types/card'
import { Button } from '@/components/ui/button'
import { 
  Cat, 
  Copy, 
  Camera, 
  Share2, 
  Edit3, 
  Palette,
  MoreHorizontal,
  Tag,
  Image as ImageIcon,
  Trash2,
  FolderOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RichTextEditor } from './rich-text-editor'
import { TitleEditor } from './title-editor'
import { CardTags } from '../tag/card-tags'

interface FlipCardProps {
  card: CardType
  onFlip: (cardId: string) => void
  onUpdate: (cardId: string, updates: Partial<CardType>) => void
  onCopy: (cardId: string) => void
  onScreenshot: (cardId: string) => void
  onShare: (cardId: string) => void
  onDelete: (cardId: string) => void
  onStyleChange?: (cardId: string) => void
  onTagsChange?: (cardId: string) => void
  onMoveToFolder?: () => void
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
  onDelete,
  onStyleChange,
  onTagsChange,
  onMoveToFolder,
  className,
  size = 'md'
}: FlipCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingField, setEditingField] = useState<'title' | 'content' | null>(null)
  const [originalContent, setOriginalContent] = useState<CardContentType | null>(null)
  const [tempContent, setTempContent] = useState<CardContentType | null>(null)
  const [isFlipping, setIsFlipping] = useState(false)
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
    
    if (isFlipping) return // 防止重复点击
    
    setIsFlipping(true)
    onFlip(card.id)
    
    // 动画完成后重置状态
    setTimeout(() => {
      setIsFlipping(false)
    }, 600)
  }, [card.id, onFlip, isFlipping])

  // Start editing
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    startEditing('content')
  }

  // Double click to edit
  const handleDoubleClick = (field: 'title' | 'content') => {
    startEditing(field)
  }

  const startEditing = (field: 'title' | 'content') => {
    setOriginalContent(currentContent)
    setTempContent(currentContent)
    setEditingField(field)
    setIsEditing(true)
  }

  // Update temp content during editing
  const handleTempContentUpdate = (field: keyof CardContentType, value: any) => {
    if (tempContent) {
      setTempContent({
        ...tempContent,
        [field]: value,
        lastModified: new Date()
      })
    }
  }

  // Save changes
  const handleSaveEdit = () => {
    if (tempContent) {
      const contentKey = card.isFlipped ? 'backContent' : 'frontContent'
      const updates = {
        [contentKey]: tempContent
      } as Partial<CardType>
      onUpdate(card.id, updates)
    }
    setIsEditing(false)
    setEditingField(null)
    setOriginalContent(null)
    setTempContent(null)
  }

  // Cancel changes
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditingField(null)
    setOriginalContent(null)
    setTempContent(null)
  }

  // Legacy handlers for backward compatibility
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleTempContentUpdate('title', e.target.value)
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleTempContentUpdate('text', e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancelEdit()
    }
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSaveEdit()
    }
  }

  return (
    <div 
      className={cn("relative group", className)}
      data-card-id={card.id}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 3D Flip Animation Container */}
      <div 
        className="flip-card-container"
        style={{
          perspective: '1000px',
          width: '100%',
          minHeight: 'fit-content'
        }}
      >
        <div 
          ref={cardRef}
          className={cn(
            "flip-card-inner relative transition-all duration-700 ease-in-out",
            sizeClasses[size]
          )}
          style={{ 
            minHeight: 'fit-content',
            width: '100%',
            transformStyle: 'preserve-3d',
            transform: card.isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
          }}
        >
          {/* Front Side */}
          <div 
            className={cn(
              "flip-card-face flip-card-front w-full flex flex-col transition-all duration-300 relative",
              shadowClass,
              contentPaddingClasses[size]
            )}
            style={{
              ...cardStyles,
              borderRadius: cardStyles.borderRadius,
              backfaceVisibility: 'hidden',
              position: card.isFlipped ? 'absolute' : 'relative',
              opacity: card.isFlipped ? 0 : 1
            }}
          >
            <CardSide
              content={tempContent || card.frontContent}
              isEditing={isEditing && !card.isFlipped}
              editingField={editingField}
              onTitleChange={handleTitleChange}
              onTextChange={handleTextChange}
              onTempContentUpdate={handleTempContentUpdate}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onDoubleClick={handleDoubleClick}
              onKeyDown={handleKeyDown}
              sideLabel="Front"
              isHovered={isHovered}
              onEdit={handleEdit}
              onFlip={handleFlip}
              onCopy={() => onCopy(card.id)}
              onScreenshot={() => onScreenshot(card.id)}
              onShare={() => onShare(card.id)}
              onDelete={() => onDelete(card.id)}
              onStyleChange={onStyleChange ? () => onStyleChange(card.id) : undefined}
              onTagsChange={onTagsChange ? () => onTagsChange(card.id) : undefined}
              onMoveToFolder={onMoveToFolder}
              card={card}
              isFlipping={isFlipping}
            />
          </div>

          {/* Back Side */}
          <div 
            className={cn(
              "flip-card-face flip-card-back w-full flex flex-col transition-all duration-300 relative",
              shadowClass,
              contentPaddingClasses[size]
            )}
            style={{
              ...cardStyles,
              borderRadius: cardStyles.borderRadius,
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              position: card.isFlipped ? 'relative' : 'absolute',
              top: card.isFlipped ? 'auto' : '0',
              opacity: card.isFlipped ? 1 : 0
            }}
          >
            <CardSide
              content={tempContent || card.backContent}
              isEditing={isEditing && card.isFlipped}
              editingField={editingField}
              onTitleChange={handleTitleChange}
              onTextChange={handleTextChange}
              onTempContentUpdate={handleTempContentUpdate}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onDoubleClick={handleDoubleClick}
              onKeyDown={handleKeyDown}
              sideLabel="Back"
              isHovered={isHovered}
              onEdit={handleEdit}
              onFlip={handleFlip}
              onCopy={() => onCopy(card.id)}
              onScreenshot={() => onScreenshot(card.id)}
              onShare={() => onShare(card.id)}
              onDelete={() => onDelete(card.id)}
              onStyleChange={onStyleChange ? () => onStyleChange(card.id) : undefined}
              onTagsChange={onTagsChange ? () => onTagsChange(card.id) : undefined}
              onMoveToFolder={onMoveToFolder}
              card={card}
              isFlipping={isFlipping}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Card Side Component
interface CardSideProps {
  content: CardContentType
  isEditing: boolean
  editingField: 'title' | 'content' | null
  onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onTempContentUpdate: (field: keyof CardContentType, value: any) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDoubleClick: (field: 'title' | 'content') => void
  onKeyDown: (e: React.KeyboardEvent) => void
  sideLabel: string
  isHovered: boolean
  onEdit: (e: React.MouseEvent) => void
  onFlip: (e: React.MouseEvent) => void
  onCopy: () => void
  onScreenshot: () => void
  onShare: () => void
  onDelete: () => void
  onStyleChange?: () => void
  onTagsChange?: () => void
  onMoveToFolder?: () => void
  card: CardType
  isFlipping: boolean
}

function CardSide({
  content,
  isEditing,
  editingField,
  onTitleChange,
  onTextChange,
  onTempContentUpdate,
  onSaveEdit,
  onCancelEdit,
  onDoubleClick,
  onKeyDown,
  sideLabel,
  isHovered,
  onEdit,
  onFlip,
  onCopy,
  onScreenshot,
  onShare,
  onDelete,
  onStyleChange,
  onTagsChange,
  onMoveToFolder,
  card,
  isFlipping
}: CardSideProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header with Title and Action Buttons */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 mr-2">
          {isEditing && editingField === 'title' ? (
            <TitleEditor
              content={content.title}
              onUpdate={(value) => onTempContentUpdate('title', value)}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
              autoFocus
            />
          ) : (
            <h3 
              className="text-lg font-semibold text-left cursor-pointer hover:bg-black/5 rounded px-1 py-0.5 -mx-1 transition-colors"
              onDoubleClick={() => onDoubleClick('title')}
            >
              {content.title || 'Untitled Card'}
            </h3>
          )}
        </div>

        {/* Action Buttons - Inline */}
        <div className={cn(
          "flex gap-1 transition-all duration-200 flex-shrink-0",
          isHovered || isEditing ? "opacity-100" : "opacity-60"
        )}>
          {/* Flip Button with Cat Icon */}
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-7 w-7 p-0 rounded-md hover:bg-black/10 transition-all duration-200",
              isFlipping && "animate-pulse"
            )}
            onClick={onFlip}
            title={`Flip to ${card.isFlipped ? 'Front' : 'Back'}`}
            disabled={isFlipping}
          >
            <Cat className={cn(
              "h-3.5 w-3.5 transition-transform duration-200",
              isFlipping && "scale-110"
            )} />
          </Button>

          {/* More Actions */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <div
                className="h-7 w-7 rounded-md hover:bg-black/10 flex items-center justify-center cursor-pointer transition-colors group"
                onMouseEnter={(e) => {
                  e.stopPropagation()
                  // Programmatically trigger the dropdown
                  const event = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                  })
                  e.currentTarget.dispatchEvent(event)
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </div>
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
              {onTagsChange && (
                <DropdownMenuItem onClick={onTagsChange}>
                  <Tag className="h-4 w-4 mr-2" />
                  Manage Tags
                </DropdownMenuItem>
              )}
              {onMoveToFolder && (
                <DropdownMenuItem onClick={onMoveToFolder}>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Move to Folder
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Card
              </DropdownMenuItem>
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
        {isEditing && editingField === 'content' ? (
          <RichTextEditor
            content={content.text}
            placeholder="Add your content here..."
            onUpdate={(value) => onTempContentUpdate('text', value)}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
            autoFocus
          />
        ) : (
          <div 
            className="text-sm leading-relaxed text-left cursor-pointer hover:bg-black/5 rounded p-2 -m-2 transition-colors min-h-[100px]"
            onDoubleClick={() => onDoubleClick('content')}
          >
            <div 
              className="whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ 
                __html: content.text || '<span class="text-muted-foreground">Click to add content...</span>' 
              }}
            />
          </div>
        )}
      </div>

      {/* Footer with Tags and Image Count */}
      <div className="mt-auto">
        {/* Tags */}
        <CardTags tags={content.tags} size="sm" />

        {/* Image Count */}
        {content.images.length > 0 && (
          <div className="flex items-center justify-end text-xs text-muted-foreground mt-2">
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