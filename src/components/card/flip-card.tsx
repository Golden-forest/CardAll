import React, { useState, useRef, useCallback, useMemo } from 'react'
import { Card as CardType, CardContent as CardContentType } from '@/types/card'
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
import { CardSide } from './card-side'
import { ImageGrid } from './image-grid'

interface FlipCardProps {
  card: CardType
  onFlip: (_cardId: string) => void
  onUpdate: (_cardId: string, _updates: Partial<CardType>) => void
  onCopy: (_cardId: string) => void
  onScreenshot: (_cardId: string) => void
  onShare: (_cardId: string) => void
  onDelete: (_cardId: string) => void
  onStyleChange?: (_cardId: string) => void
  onTagsChange?: (_cardId: string) => void
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
  const [tempContent, setTempContent] = useState<CardContentType | null>(null)
  const [isFlipping, setIsFlipping] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false) // 组件内部翻转状态
  const cardRef = useRef<HTMLDivElement>(null)

  const currentContent = isFlipped ? card.backContent : card.frontContent

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
      color: style.bodyTextColor || style.textColor,
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

  const { style: cardStyles, shadowClass, specialClasses } = useMemo(() => {
    return getCardStyles()
  }, [card.style])

  const handleFlip = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (isFlipping) return // 防止重复点击

    setIsFlipping(true)
    setIsFlipped(!isFlipped) // 切换内部翻转状态

    // 仍然调用onFlip以保持兼容性（如果父组件需要）
    onFlip(card.id)

    // 动画完成后重置状态
    setTimeout(() => {
      setIsFlipping(false)
    }, 600)
  }, [card.id, onFlip, isFlipping, isFlipped])

  // Start editing
  const startEditing = useCallback((field: 'title' | 'content') => {
    setTempContent(currentContent)
    setEditingField(field)
    setIsEditing(true)
  }, [currentContent])

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    startEditing('content')
  }, [startEditing])

  // Double click to edit
  const handleDoubleClick = useCallback((field: 'title' | 'content') => {
    startEditing(field)
  }, [startEditing])

  // Update temp content during editing
  const handleTempContentUpdate = useCallback((field: keyof CardContentType, value: any) => {
    if (tempContent) {
      setTempContent({
        ...tempContent,
        [field]: value,
        lastModified: new Date()
      })
    }
  }, [tempContent])

  // Save changes
  const handleSaveEdit = useCallback(() => {
    if (tempContent) {
      const contentKey = isFlipped ? 'backContent' : 'frontContent'
      const updates = {
        [contentKey]: tempContent
      } as Partial<CardType>
      onUpdate(card.id, updates)
    }
    setIsEditing(false)
    setEditingField(null)
    setTempContent(null)
  }, [tempContent, isFlipped, card.id, onUpdate])

  // Cancel changes
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditingField(null)
    setTempContent(null)
  }, [])

  // Legacy handlers for backward compatibility
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleTempContentUpdate('title', e.target.value)
  }, [handleTempContentUpdate])

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleTempContentUpdate('text', e.target.value)
  }, [handleTempContentUpdate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancelEdit()
    }
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSaveEdit()
    }
  }, [handleCancelEdit, handleSaveEdit])

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
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            willChange: 'transform'
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
              position: isFlipped ? 'absolute' : 'relative',
              opacity: isFlipped ? 0 : 1,
              willChange: 'opacity, transform'
            }}
          >
            <CardSide
              content={tempContent || card.frontContent}
              isEditing={isEditing && !isFlipped}
              editingField={editingField}
              _onTitleChange={handleTitleChange}
              _onTextChange={handleTextChange}
              onTempContentUpdate={handleTempContentUpdate}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onDoubleClick={handleDoubleClick}
              _onKeyDown={handleKeyDown}
              _sideLabel="Front"
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
              _card={card}
              isFlipping={isFlipping}
              isCurrentlyFlipped={isFlipped}
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
              position: isFlipped ? 'relative' : 'absolute',
              top: isFlipped ? 'auto' : '0',
              opacity: isFlipped ? 1 : 0,
              willChange: 'opacity, transform'
            }}
          >
            <CardSide
              content={tempContent || card.backContent}
              isEditing={isEditing && isFlipped}
              editingField={editingField}
              _onTitleChange={handleTitleChange}
              _onTextChange={handleTextChange}
              onTempContentUpdate={handleTempContentUpdate}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onDoubleClick={handleDoubleClick}
              _onKeyDown={handleKeyDown}
              _sideLabel="Back"
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
              _card={card}
              isFlipping={isFlipping}
              isCurrentlyFlipped={isFlipped}
            />
          </div>
        </div>
      </div>
    </div>
  )
}