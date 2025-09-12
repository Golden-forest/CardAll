import React, { useState, useRef, useCallback, useEffect } from 'react'
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
import { ImageZoomModal } from './image-zoom-modal'

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
  const [imageZoomState, setImageZoomState] = useState<{
    isOpen: boolean
    images: ImageData[]
    initialIndex: number
  }>({ isOpen: false, images: [], initialIndex: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const flipButtonRef = useRef<HTMLButtonElement>(null)

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

  const handleFlip = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    
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

  // 键盘翻转支持
  const handleCardKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isEditing) return
    
    // 空格键或回车键翻转卡片
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault()
      handleFlip()
    }
    
    // F键聚焦到翻转按钮
    if (e.key === 'f' && !e.repeat) {
      e.preventDefault()
      flipButtonRef.current?.focus()
    }
    
    // E键进入编辑模式
    if (e.key === 'e' && !e.repeat) {
      e.preventDefault()
      startEditing('content')
    }
    
    // Escape键取消编辑
    if (e.key === 'Escape' && isEditing) {
      e.preventDefault()
      handleCancelEdit()
    }
    
    // Tab键导航到下一个交互元素
    if (e.key === 'Tab' && !e.shiftKey) {
      const focusableElements = cardRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusableElements && focusableElements.length > 0) {
        const firstElement = focusableElements[0] as HTMLElement
        if (document.activeElement === focusableElements[focusableElements.length - 1]) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }
    
    // Shift+Tab键导航到上一个交互元素
    if (e.key === 'Tab' && e.shiftKey) {
      const focusableElements = cardRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusableElements && focusableElements.length > 0) {
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement
        if (document.activeElement === focusableElements[0]) {
          e.preventDefault()
          lastElement.focus()
        }
      }
    }
  }, [isEditing, isFlipping, card.id, onFlip])

  // 图片点击放大处理
  const handleImageClick = useCallback((images: ImageData[], imageIndex: number) => {
    setImageZoomState({
      isOpen: true,
      images,
      initialIndex: imageIndex
    })
  }, [])

  // 关闭图片放大
  const closeImageZoom = useCallback(() => {
    setImageZoomState(prev => ({ ...prev, isOpen: false }))
  }, [])

  // 焦点管理
  useEffect(() => {
    if (isEditing && editingField) {
      const editor = cardRef.current?.querySelector(`[data-editor-field=\"${editingField}\"]`) as HTMLElement
      editor?.focus()
    }
  }, [isEditing, editingField])

  // 屏幕阅读器通知
  const announceFlip = useCallback(() => {
    const announcement = card.isFlipped ? 'Card flipped to back side' : 'Card flipped to front side'
    const announcementElement = document.createElement('div')
    announcementElement.setAttribute('role', 'status')
    announcementElement.setAttribute('aria-live', 'polite')
    announcementElement.setAttribute('aria-atomic', 'true')
    announcementElement.className = 'sr-only'
    announcementElement.textContent = announcement
    document.body.appendChild(announcementElement)
    
    setTimeout(() => {
      document.body.removeChild(announcementElement)
    }, 1000)
  }, [card.isFlipped])

  useEffect(() => {
    if (!isFlipping) {
      announceFlip()
    }
  }, [isFlipping, announceFlip])

  return (
    <>
      <div 
        className={cn("relative group", className)}
        data-card-id={card.id}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onKeyDown={handleCardKeyDown}
        tabIndex={0}
        role="article"
        aria-label={`Card: ${currentContent.title || 'Untitled Card'}`}
        aria-roledescription="Interactive card with flip functionality"
        aria-describedby={`card-description-${card.id}`}
      >
        {/* Screen reader only description */}
        <div id={`card-description-${card.id}`} className="sr-only">
          This is an interactive card. Press Space or Enter to flip, E to edit, F to focus flip button.
        </div>

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
            aria-live="polite"
            aria-atomic="true"
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
              role="region"
              aria-label="Front side of card"
              aria-hidden={card.isFlipped}
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
                flipButtonRef={flipButtonRef}
                onImageClick={handleImageClick}
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
              role="region"
              aria-label="Back side of card"
              aria-hidden={!card.isFlipped}
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
                flipButtonRef={flipButtonRef}
                onImageClick={handleImageClick}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {imageZoomState.isOpen && (
        <ImageZoomModal
          images={imageZoomState.images}
          initialIndex={imageZoomState.initialIndex}
          onClose={closeImageZoom}
        />
      )}
    </>
  )
}

// Image Grid Component with Smart Centering
interface ImageGridProps {
  images: ImageData[]
  onImageClick?: (images: ImageData[], index: number) => void
}

function ImageGridComponent({ images, onImageClick }: ImageGridProps) {
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
    const baseClasses = "relative aspect-video rounded-md overflow-hidden bg-muted transition-all duration-200 hover:scale-[1.02] cursor-pointer group"
    
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
          onClick={() => onImageClick?.(images, index)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onImageClick?.(images, index)
            }
          }}
          aria-label={`View image ${index + 1} of ${images.length}: ${image.alt || 'Image'}`}
        >
          <img
            src={image.url}
            alt={image.alt || `Image ${index + 1}`}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
          {/* 放大提示图标 */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="bg-white/90 rounded-full p-2 transform scale-90 group-hover:scale-100 transition-transform duration-200">
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3-3H7" />
              </svg>
            </div>
          </div>
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
  onFlip: (e?: React.MouseEvent) => void
  onCopy: () => void
  onScreenshot: () => void
  onShare: () => void
  onDelete: () => void
  onStyleChange?: () => void
  onTagsChange?: () => void
  onMoveToFolder?: () => void
  card: CardType
  isFlipping: boolean
  flipButtonRef?: React.RefObject<HTMLButtonElement>
  onImageClick?: (images: ImageData[], index: number) => void
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
  isFlipping,
  flipButtonRef,
  onImageClick
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
              data-editor-field="title"
            />
          ) : (
            <h3 
              className="text-lg font-semibold text-left cursor-pointer hover:bg-black/5 rounded px-1 py-0.5 -mx-1 transition-colors"
              onDoubleClick={() => onDoubleClick('title')}
              tabIndex={0}
              role="heading"
              aria-level={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onDoubleClick('title')
                }
              }}
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
            ref={flipButtonRef}
            size="sm"
            variant="ghost"
            className={cn(
              "h-7 w-7 p-0 rounded-md hover:bg-black/10 transition-all duration-200",
              isFlipping && "animate-pulse"
            )}
            onClick={onFlip}
            title={`Flip to ${card.isFlipped ? 'Front' : 'Back'} (F key)`}
            disabled={isFlipping}
            data-flip-button
            aria-label={`Flip card to ${card.isFlipped ? 'front' : 'back'} side`}
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
                tabIndex={0}
                role="button"
                aria-label="More actions"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.currentTarget.click()
                  }
                }}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onEdit}>
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Content (E key)
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
          <ImageGridComponent 
            images={content.images} 
            onImageClick={onImageClick}
          />
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
            data-editor-field="content"
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
            tabIndex={0}
            role="article"
            aria-label="Card content"
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
                e.preventDefault()
                onDoubleClick('content')
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