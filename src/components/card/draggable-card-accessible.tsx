import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Card as CardType } from '@/types/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { 
  GripVertical, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight,
  Maximize2,
  Edit3,
  Copy,
  Camera,
  Share2,
  Trash2,
  Tag,
  FolderOpen
} from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { FlipCard } from './flip-card-accessible'

interface DraggableCardProps {
  card: CardType
  onUpdate: (id: string, updates: Partial<CardType>) => void
  onDelete: (id: string) => void
  onCopy: (id: string) => void
  onScreenshot: (id: string) => void
  onShare: (id: string) => void
  onStyleChange?: (cardId: string) => void
  onTagsChange?: (cardId: string) => void
  onMoveToFolder?: () => void
  isSnapping?: boolean
  snapDirection?: 'top' | 'bottom' | 'left' | 'right'
  size?: 'sm' | 'md' | 'lg'
  onPositionChange?: (cardId: string, newPosition: { x: number; y: number }) => void
  className?: string
}

export function DraggableCard({
  card,
  onUpdate,
  onDelete,
  onCopy,
  onScreenshot,
  onShare,
  onStyleChange,
  onTagsChange,
  onMoveToFolder,
  isSnapping,
  snapDirection,
  size = 'md',
  onPositionChange,
  className
}: DraggableCardProps) {
  const [isKeyboardDragging, setIsKeyboardDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 })
  const [showControls, setShowControls] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const announcementsRef = useRef<HTMLDivElement>(null)

  // DnD kit draggable attributes
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: card.id,
    disabled: isKeyboardDragging,
  })

  const style = transform ? {
    transform: CSS.Transform.toString(transform),
  } : undefined

  // 键盘拖拽移动
  const moveCard = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    const step = 20 // 每次移动的像素数
    const newPosition = { ...dragPosition }
    
    switch (direction) {
      case 'up':
        newPosition.y -= step
        break
      case 'down':
        newPosition.y += step
        break
      case 'left':
        newPosition.x -= step
        break
      case 'right':
        newPosition.x += step
        break
    }
    
    setDragPosition(newPosition)
    
    // 更新实际位置
    if (onPositionChange) {
      onPositionChange(card.id, newPosition)
    }
    
    // 朗读位置变化
    announce(`Card moved ${direction}`)
  }, [dragPosition, card.id, onPositionChange])

  // 开始键盘拖拽
  const startKeyboardDrag = useCallback(() => {
    setIsKeyboardDragging(true)
    setShowControls(true)
    announce('Keyboard drag mode activated. Use arrow keys to move, Space to drop.')
  }, [])

  // 结束键盘拖拽
  const endKeyboardDrag = useCallback(() => {
    setIsKeyboardDragging(false)
    setShowControls(false)
    setDragPosition({ x: 0, y: 0 })
    announce('Keyboard drag mode deactivated')
  }, [])

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isKeyboardDragging) {
      e.preventDefault()
      
      switch (e.key) {
        case 'ArrowUp':
          moveCard('up')
          break
        case 'ArrowDown':
          moveCard('down')
          break
        case 'ArrowLeft':
          moveCard('left')
          break
        case 'ArrowRight':
          moveCard('right')
          break
        case ' ':
        case 'Enter':
          endKeyboardDrag()
          break
        case 'Escape':
          endKeyboardDrag()
          break
      }
    } else {
      // 非拖拽模式下的快捷键
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault()
          setIsExpanded(!isExpanded)
          announce(isExpanded ? 'Card collapsed' : 'Card expanded')
          break
        case 'd':
        case 'D':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            startKeyboardDrag()
          }
          break
        case 'e':
        case 'E':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            onStyleChange?.(card.id)
            announce('Style change menu opened')
          }
          break
        case 'Delete':
          if (e.shiftKey) {
            e.preventDefault()
            onDelete(card.id)
            announce('Card deleted')
          }
          break
      }
    }
  }, [isKeyboardDragging, moveCard, endKeyboardDrag, startKeyboardDrag, isExpanded, card.id, onDelete, onStyleChange])

  // 屏幕阅读器公告
  const announce = useCallback((message: string) => {
    if (!announcementsRef.current) return
    
    const announcement = document.createElement('div')
    announcement.setAttribute('role', 'status')
    announcement.setAttribute('aria-live', 'polite')
    announcement.setAttribute('aria-atomic', 'true')
    announcement.className = 'sr-only'
    announcement.textContent = message
    
    announcementsRef.current.appendChild(announcement)
    
    setTimeout(() => {
      if (announcementsRef.current?.contains(announcement)) {
        announcementsRef.current.removeChild(announcement)
      }
    }, 1000)
  }, [])

  // 焦点管理
  useEffect(() => {
    if (isKeyboardDragging && cardRef.current) {
      cardRef.current.focus()
    }
  }, [isKeyboardDragging])

  // 监听全局键盘事件
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 如果按了Escape键，退出键盘拖拽模式
      if (e.key === 'Escape' && isKeyboardDragging) {
        endKeyboardDrag()
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isKeyboardDragging, endKeyboardDrag])

  // 拖拽状态描述
  const getDragStatusDescription = () => {
    if (isDragging) {
      return 'Dragging with mouse'
    }
    if (isKeyboardDragging) {
      return 'Dragging with keyboard - Use arrow keys to move'
    }
    if (isSnapping) {
      return `Snapping ${snapDirection} to nearby card`
    }
    return 'Draggable card'
  }

  return (
    <>
      {/* 屏幕阅读器公告区域 */}
      <div ref={announcementsRef} className="sr-only" aria-live="polite" />
      
      <div
        ref={(node) => {
          setNodeRef(node)
          if (cardRef) {
            cardRef.current = node
          }
        }}
        className={cn(
          'relative group transition-all duration-200',
          isDragging && 'opacity-50 scale-105 rotate-2',
          isKeyboardDragging && 'ring-2 ring-primary ring-offset-2',
          isSnapping && 'animate-pulse ring-2 ring-green-500 ring-offset-2',
          className
        )}
        style={{
          ...style,
          transform: isKeyboardDragging 
            ? `translate(${dragPosition.x}px, ${dragPosition.y}px)` 
            : style?.transform,
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="article"
        aria-label={`Card: ${card.frontContent.title || 'Untitled Card'}`}
        aria-roledescription={getDragStatusDescription()}
        aria-describedby={`card-status-${card.id}`}
        data-card-id={card.id}
      >
        {/* 卡片状态描述（屏幕阅读器专用） */}
        <div id={`card-status-${card.id}`} className="sr-only">
          {getDragStatusDescription()}
          {isKeyboardDragging && '. Press arrow keys to move, Space or Enter to drop, Escape to cancel.'}
          {!isKeyboardDragging && '. Press Ctrl+D to drag with keyboard, Space or Enter to expand/collapse.'}
        </div>

        {/* 拖拽手柄 */}
        <div
          className={cn(
            'absolute -top-3 -left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity',
            'bg-background border border-border rounded-md shadow-md',
            isKeyboardDragging && 'opacity-100'
          )}
        >
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onMouseDown={(e) => {
              // 防止与DnD kit冲突
              if (!isKeyboardDragging) {
                e.preventDefault()
              }
            }}
            onClick={startKeyboardDrag}
            aria-label="Start keyboard drag (Ctrl+D)"
            title="Start keyboard drag (Ctrl+D)"
          >
            <GripVertical className="w-4 h-4" />
          </Button>
        </div>

        {/* 键盘拖拽控制面板 */}
        {isKeyboardDragging && (
          <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 z-20">
            <div className="bg-background border border-border rounded-lg shadow-lg p-2">
              <div className="grid grid-cols-3 gap-1 mb-2">
                <div></div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => moveCard('up')}
                  aria-label="Move card up"
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <div></div>
                
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => moveCard('left')}
                  aria-label="Move card left"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 w-8 p-0"
                  onClick={endKeyboardDrag}
                  aria-label="Drop card"
                >
                  ×
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => moveCard('right')}
                  aria-label="Move card right"
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
                
                <div></div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => moveCard('down')}
                  aria-label="Move card down"
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <div></div>
              </div>
              <div className="text-xs text-center text-muted-foreground">
                Arrow keys: Move, Space: Drop, Esc: Cancel
              </div>
            </div>
          </div>
        )}

        {/* 扩展/折叠按钮 */}
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            'absolute -top-3 -right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity',
            isExpanded && 'opacity-100'
          )}
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Collapse card' : 'Expand card'}
          aria-expanded={isExpanded}
        >
          <Maximize2 className="w-4 h-4" />
        </Button>

        {/* 快捷操作按钮 */}
        <div
          className={cn(
            'absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1',
            isExpanded && 'opacity-100'
          )}
        >
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => onCopy(card.id)}
            aria-label="Copy card text"
          >
            <Copy className="w-3 h-3" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => onScreenshot(card.id)}
            aria-label="Take screenshot"
          >
            <Camera className="w-3 h-3" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => onShare(card.id)}
            aria-label="Share card"
          >
            <Share2 className="w-3 h-3" />
          </Button>
          
          {onStyleChange && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => onStyleChange(card.id)}
              aria-label="Change style"
            >
              <Edit3 className="w-3 h-3" />
            </Button>
          )}
          
          {onTagsChange && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => onTagsChange(card.id)}
              aria-label="Manage tags"
            >
              <Tag className="w-3 h-3" />
            </Button>
          )}
          
          {onMoveToFolder && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={onMoveToFolder}
              aria-label="Move to folder"
            >
              <FolderOpen className="w-3 h-3" />
            </Button>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(card.id)}
            aria-label="Delete card"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>

        {/* 主卡片内容 */}
        <div className={cn(
          'transition-all duration-200',
          isExpanded && 'scale-105 shadow-xl'
        )}>
          <FlipCard
            card={card}
            onFlip={(id) => {
              // 触发翻转回调
              onUpdate(id, { isFlipped: !card.isFlipped })
            }}
            onUpdate={onUpdate}
            onCopy={onCopy}
            onScreenshot={onScreenshot}
            onShare={onShare}
            onDelete={onDelete}
            onStyleChange={onStyleChange}
            onTagsChange={onTagsChange}
            onMoveToFolder={onMoveToFolder}
            size={size}
            className={cn(
              isDragging && 'cursor-grabbing',
              isKeyboardDragging && 'cursor-move'
            )}
          />
        </div>

        {/* 拖拽状态指示器 */}
        <div className="sr-only" role="status" aria-live="polite">
          {isDragging && 'Dragging card with mouse'}
          {isKeyboardDragging && 'Dragging card with keyboard'}
          {isSnapping && `Snapping ${snapDirection}`}
        </div>
      </div>
    </>
  )
}