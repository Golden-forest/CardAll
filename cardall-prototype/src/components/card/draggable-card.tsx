import React, { useRef, useEffect, useState } from 'react'
import { Card as CardType } from '../../types/card'
import { EnhancedFlipCard } from './enhanced-flip-card'
import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface DraggableCardProps {
  card: CardType
  onUpdate: (id: string, updates: Partial<CardType>) => void
  onDelete: (id: string) => void
  isSnapping?: boolean
  snapDirection?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
  size?: 'sm' | 'md' | 'lg'
  lazyLoad?: boolean
}

export function DraggableCard({
  card,
  onUpdate,
  onDelete,
  isSnapping = false,
  snapDirection,
  className,
  size = 'md',
  lazyLoad = false
}: DraggableCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(!lazyLoad)
  const observerRef = useRef<IntersectionObserver | null>(null)
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
    over,
  } = useDraggable({
    id: card.id,
    data: {
      card,
    },
  })

  // Merge refs for drag and snap functionality
  const setRefs = (element: HTMLDivElement | null) => {
    setNodeRef(element)
    if (cardRef) {
      cardRef.current = element
    }
  }

  // 懒加载逻辑
  useEffect(() => {
    if (!lazyLoad || !cardRef.current) return

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observerRef.current?.unobserve(entry.target)
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1
      }
    )

    observerRef.current.observe(cardRef.current)

    return () => {
      observerRef.current?.disconnect()
    }
  }, [lazyLoad])

  // Calculate drag transform with snap effect
  const getTransformStyle = () => {
    if (!transform) return undefined
    
    const x = transform.x
    const y = transform.y
    let rotation = 0
    let scale = 1

    if (isDragging) {
      // Add slight rotation and scale during drag
      rotation = Math.min(Math.max(x / 50, -10), 10)
      scale = 1.05
    }

    return {
      transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg) scale(${scale})`,
      zIndex: isDragging ? 1000 : 'auto',
    }
  }

  // Snap animation classes
  const getSnapClasses = () => {
    if (!isSnapping || !snapDirection) return ''
    
    const baseClasses = 'transition-all duration-300 ease-out'
    const snapEffects = {
      top: 'animate-pulse border-t-4 border-blue-500',
      bottom: 'animate-pulse border-b-4 border-blue-500',
      left: 'animate-pulse border-l-4 border-blue-500',
      right: 'animate-pulse border-r-4 border-blue-500',
    }
    
    return `${baseClasses} ${snapEffects[snapDirection]}`
  }

  // Drag shadow effect
  const getDragClasses = () => {
    if (!isDragging) return ''
    
    return `
      shadow-2xl 
      opacity-90 
      transition-all 
      duration-200 
      ease-out
    `
  }

  const cardStyle = {
    ...getTransformStyle(),
  }

  return (
    <div
      ref={setRefs}
      className={cn(
        'relative',
        'transition-all duration-200 ease-out',
        getSnapClasses(),
        getDragClasses(),
        isDragging && 'cursor-grabbing',
        !isDragging && 'cursor-grab',
        className
      )}
      style={cardStyle}
      {...listeners}
      {...attributes}
    >
      {/* Drag Handle Indicator */}
      <div 
        className={cn(
          'absolute -top-2 -left-2 z-20',
          'w-6 h-6 rounded-full',
          'bg-blue-500 text-white',
          'flex items-center justify-center',
          'text-xs font-bold',
          'shadow-lg',
          'transition-all duration-200',
          isDragging ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
        )}
      >
        ⚡
      </div>

      {/* Snap Direction Indicator */}
      <AnimatePresence>
        {isSnapping && snapDirection && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={cn(
              'absolute -top-8 left-1/2 transform -translate-x-1/2 z-20',
              'bg-blue-500 text-white px-2 py-1 rounded-md',
              'text-xs font-medium whitespace-nowrap',
              'shadow-lg'
            )}
          >
            🧲 Snap {snapDirection}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Magnetic Field Effect */}
      <AnimatePresence>
        {isSnapping && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 0.3 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className={cn(
              'absolute inset-0 rounded-xl',
              'bg-blue-400 blur-md',
              'pointer-events-none',
              'animate-pulse'
            )}
          />
        )}
      </AnimatePresence>

      {/* Main Card Content */}
      <div className={cn(
        'relative z-10',
        isSnapping && 'transform scale-105'
      )}>
        {isVisible ? (
          <EnhancedFlipCard
            card={card}
            onFlip={(cardId) => onUpdate(cardId, { isFlipped: !card.isFlipped })}
            onUpdate={onUpdate}
          onCopy={(cardId) => {
            // Copy card content to clipboard
            const content = card.isFlipped ? card.backContent : card.frontContent
            const textToCopy = `${card.frontContent.title}\n\n${content.text}`
            
            navigator.clipboard.writeText(textToCopy).then(() => {
              // You could add a toast notification here
              console.log('Card content copied to clipboard')
            })
          }}
          onScreenshot={(cardId) => {
            // Screenshot functionality would be implemented here
            console.log('Screenshot for card:', cardId)
          }}
          onShare={(cardId) => {
            // Share functionality would be implemented here
            console.log('Share card:', cardId)
          }}
          onDelete={onDelete}
          className={cn(
            'transition-all duration-200',
            isDragging && 'transform scale-105'
          )}
          size={size}
        />
      ) : (
        // 懒加载占位符
        <div className={cn(
          'bg-muted border border-dashed rounded-xl',
          'flex items-center justify-center',
          'animate-pulse',
          'min-h-[200px]'
        )}>
          <div className="text-center">
            <div className="w-8 h-8 mx-auto mb-2 bg-muted-foreground/20 rounded-full" />
            <div className="text-sm text-muted-foreground">加载中...</div>
          </div>
        </div>
      )}
      </div>

      {/* Dragging Overlay Effect */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
            exit={{ opacity: 0 }}
            className={cn(
              'absolute inset-0 rounded-xl',
              'bg-gradient-to-r from-blue-500 to-purple-500',
              'pointer-events-none'
            )}
          />
        )}
      </AnimatePresence>
    </div>
  )
}