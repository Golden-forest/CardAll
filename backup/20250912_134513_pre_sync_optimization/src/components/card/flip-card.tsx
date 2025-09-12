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

    // Handle different style types and add special classes
    let specialClasses = ''
    
    if (style.type === 'gradient' && style.gradientColors) {
      baseStyles.background = `linear-gradient(135deg, ${style.gradientColors.join(', ')})`
      
      // Add animation classes based on style ID or gradient colors
      if (style.gradientColors.includes('#8a2be2') && style.gradientColors.includes('#00ffff')) {
        specialClasses = 'gradient-wave-animation';
        // 确保渐变波浪样式不会干扰编辑功能
        baseStyles.position = 'relative';
      } else if (style.gradientColors.includes('#ee7752') && style.gradientColors.includes('#23d5ab')) {
        specialClasses = 'moving-gradient-animation';
      } else if (style.gradientColors.includes('#667eea')) {
        specialClasses = 'gradient-mesh-animation';
      }
    } else if (style.type === 'glass') {
      // Glass morphism effect
      baseStyles.background = style.backgroundColor || 'rgba(255, 255, 255, 0.15)'
      baseStyles.backdropFilter = 'blur(20px) saturate(180%)'
      baseStyles.WebkitBackdropFilter = 'blur(20px) saturate(180%)'
      baseStyles.border = `1px solid ${style.borderColor || 'rgba(255, 255, 255, 0.18)'}`
      specialClasses = 'glass-morphism'
    } else {
      // Handle special gradient backgrounds from backgroundColor field
      if (style.backgroundColor && style.backgroundColor.includes('linear-gradient')) {
        baseStyles.background = style.backgroundColor
        baseStyles.backgroundSize = '400% 400%'
        // Add gradient animation for gradient-mesh style
        if (style.backgroundColor.includes('#667eea')) {
          specialClasses = 'gradient-mesh-animation'
        }
      } else {
        baseStyles.backgroundColor = style.backgroundColor
        
        // Add animation classes based on solid colors and border
        if (style.backgroundColor === '#1a1a2e' && style.borderColor === '#4361ee') {
          specialClasses = 'pulse-border-animation';
        } else if (style.backgroundColor === '#0f172a') {
          specialClasses = 'glow-hover-animation';
        }
      }
    }

    // Add shadow
    const shadowClasses: Record<string, string> = {
      sm: 'shadow-sm',
      md: 'shadow-md',
      lg: 'shadow-lg',
      xl: 'shadow-xl',
      none: '',
      '2xl': 'shadow-2xl',
      glass: 'shadow-lg' // Custom glass shadow
    }

    return {
      style: baseStyles,
      shadowClass: shadowClasses[style.shadow || 'md'] || 'shadow-md',
      specialClasses
    }
  }

  const { style: cardStyles, shadowClass, specialClasses } = getCardStyles()

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
              specialClasses,
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
              specialClasses,
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

// Image Grid Component with Smart Centering
interface ImageGridProps {
  images: ImageData[]
}

function ImageGridComponent({ images }: ImageGridProps) {
  const displayImages = images.slice(0, 4)
  const imageCount = displayImages.length

  // Dynamic grid layout based on image count
  const getGridClassName = (count: number) => {
    switch (count) {
      case 1:
        return "flex justify-center" // Single image centered
      case 2:
        return "grid grid-cols-2 gap-2" // Two columns
      case 3:
        return "grid grid-cols-2 gap-2" // Two columns with special handling for 3rd image
      case 4:
      default:
        return "grid grid-cols-2 gap-2" // Standard 2x2 grid
    }
  }

  // Dynamic image container styles
  const getImageContainerClassName = (count: number, index: number) => {
    const baseClasses = "relative aspect-video rounded-md overflow-hidden bg-muted transition-all duration-200 hover:scale-[1.02]"
    
    if (count === 1) {
      // Single image: center and limit max width
      return `${baseClasses} max-w-xs w-full`
    }
    
    if (count === 3 && index === 2) {
      // Third image in 3-image layout: span both columns and center
      return `${baseClasses} col-span-2 max-w-xs mx-auto`
    }
    
    return baseClasses
  }

  return (
    <div className={getGridClassName(imageCount)}>
      {displayImages.map((image: ImageData, index: number) => (
        <div 
          key={index} 
          className={getImageContainerClassName(imageCount, index)}
        >
          <img
            src={image.url}
            alt={image.alt || `Image ${index + 1}`}
            className="w-full h-full object-cover transition-transform duration-200"
            loading="lazy"
          />
        </div>
      ))}
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
          <ImageGridComponent images={content.images} />
          {content.images.length > 4 && (
            <div className="text-xs text-muted-foreground mt-1 text-center">
              +{content.images.length - 4} more images
            </div>
          )}
        </div>
      )}

      {/* Text Content */}
      <div className="flex-1 mb-3 relative z-10">
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
            className="text-sm leading-relaxed text-left cursor-pointer hover:bg-black/5 rounded p-2 -m-2 transition-colors min-h-[100px] tiptap-editor relative z-10"
            onDoubleClick={(e) => {
              // 如果点击的是链接，不触发编辑
              if ((e.target as HTMLElement).tagName === 'A') {
                return
              }
              onDoubleClick('content')
            }}
            onClick={(e) => {
              // 处理链接点击
              const target = e.target as HTMLElement
              if (target.tagName === 'A') {
                e.stopPropagation()
                const href = target.getAttribute('href')
                if (href) {
                  window.open(href, '_blank', 'noopener,noreferrer')
                }
              }
            }}
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