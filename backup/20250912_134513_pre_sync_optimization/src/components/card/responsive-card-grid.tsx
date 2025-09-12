import React, { useState, useCallback, useRef } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  KeyboardSensor,
} from '@dnd-kit/core'
import { Card } from '@/types/card'
import { DraggableCard } from './draggable-card'
import { DragStatusIndicator } from './drag-status-indicator'
import { useResponsive, getGridColumns, getSpacing } from '@/hooks/use-responsive'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ResponsiveCardGridProps {
  cards: Card[]
  onCardUpdate: (id: string, updates: Partial<Card>) => void
  onCardDelete: (id: string) => void
  layout?: 'grid' | 'list' | 'masonry'
  className?: string
}

interface SnapZone {
  cardId: string
  direction: 'top' | 'bottom' | 'left' | 'right'
  rect: DOMRect
}

const SNAP_THRESHOLD = 40

export function ResponsiveCardGrid({
  cards,
  onCardUpdate,
  onCardDelete,
  layout = 'grid',
  className
}: ResponsiveCardGridProps) {
  const responsive = useResponsive()
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [snapZones, setSnapZones] = useState<SnapZone[]>([])
  const [activeSnapZone, setActiveSnapZone] = useState<SnapZone | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: responsive.isTouchDevice ? 8 : 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: (event, args) => {
        const { currentCoordinates } = args
        return {
          x: currentCoordinates.x,
          y: currentCoordinates.y
        }
      },
    })
  )

  // Calculate snap zones around each card
  const calculateSnapZones = useCallback((draggedCardId: string): SnapZone[] => {
    const zones: SnapZone[] = []
    
    cards.forEach((card) => {
      if (card.id === draggedCardId) return
      
      const element = document.querySelector(`[data-card-id="${card.id}"]`)
      if (!element) return
      
      const rect = element.getBoundingClientRect()
      const margin = responsive.isMobile ? SNAP_THRESHOLD / 2 : SNAP_THRESHOLD
      
      // Create snap zones for each direction
      zones.push(
        {
          cardId: card.id,
          direction: 'top',
          rect: new DOMRect(rect.left - margin, rect.top - margin, rect.width + 2 * margin, margin),
        },
        {
          cardId: card.id,
          direction: 'bottom',
          rect: new DOMRect(rect.left - margin, rect.bottom, rect.width + 2 * margin, margin),
        },
        {
          cardId: card.id,
          direction: 'left',
          rect: new DOMRect(rect.left - margin, rect.top - margin, margin, rect.height + 2 * margin),
        },
        {
          cardId: card.id,
          direction: 'right',
          rect: new DOMRect(rect.right, rect.top - margin, margin, rect.height + 2 * margin),
        }
      )
    })
    
    return zones
  }, [cards, responsive.isMobile])

  // Check if a point is within a snap zone
  const findSnapZone = useCallback((x: number, y: number, zones: SnapZone[]): SnapZone | null => {
    return zones.find(zone => 
      x >= zone.rect.left && 
      x <= zone.rect.right && 
      y >= zone.rect.top && 
      y <= zone.rect.bottom
    ) || null
  }, [])

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const card = cards.find(c => c.id === active.id)
    
    if (card) {
      setActiveCard(card)
      const zones = calculateSnapZones(card.id)
      setSnapZones(zones)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    if (!activeCard) return
    
    const { delta } = event
    const draggedElement = document.querySelector(`[data-card-id="${activeCard.id}"]`)
    
    if (!draggedElement) return
    
    const rect = draggedElement?.getBoundingClientRect()
    if (!rect) return []
    const centerX = rect.left + rect.width / 2 + (delta?.x || 0)
    const centerY = rect.top + rect.height / 2 + (delta?.y || 0)
    
    const snapZone = findSnapZone(centerX, centerY, snapZones)
    
    if (snapZone?.cardId !== activeSnapZone?.cardId || snapZone?.direction !== activeSnapZone?.direction) {
      setActiveSnapZone(snapZone)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    if (activeSnapZone && activeCard) {
      const targetCard = cards.find(c => c.id === activeSnapZone.cardId)
      
      if (targetCard) {
        toast.success(`Cards magnetically snapped ${activeSnapZone.direction}! 🧲`, {
          duration: 2000,
          icon: '🎯',
          style: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: '12px',
            fontWeight: 'bold',
          },
        })
        
        if (navigator.vibrate) {
          navigator.vibrate([50, 100, 50])
        }
      }
    } else if (activeCard) {
      toast.info('Card repositioned 📝', {
        duration: 1000,
        icon: '✨',
      })
    }
    
    setTimeout(() => {
      setActiveCard(null)
      setSnapZones([])
      setActiveSnapZone(null)
    }, 300)
  }

  // Get responsive grid classes
  const getGridClasses = () => {
    const baseClasses = "w-full transition-all duration-300"
    const spacing = getSpacing(responsive)
    
    switch (layout) {
      case 'list':
        return cn(baseClasses, 'flex flex-col', `gap-${spacing / 4}`)
      case 'masonry':
        return cn(baseClasses, `columns-${getGridColumns(responsive)} `, `gap-${spacing / 4}`)
      default:
        const columns = getGridColumns(responsive)
        return cn(baseClasses, `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-${columns} lg:grid-cols-${Math.min(columns + 1, 6)} gap-${spacing / 4}`)
    }
  }

  // Get responsive card size
  const getCardSize = () => {
    if (responsive.isMobile) return 'sm'
    if (responsive.isTablet) return 'md'
    return 'lg'
  }

  // Empty state component
  const EmptyState = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-96 text-center p-8"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-6"
      >
        <span className="text-4xl">📝</span>
      </motion.div>
      <motion.h3 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-xl font-semibold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
      >
        还没有卡片
      </motion.h3>
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-muted-foreground mb-6 max-w-md"
      >
        创建你的第一张知识卡片吧！开始构建你的个人知识库。
      </motion.p>
    </motion.div>
  )

  if (cards.length === 0) {
    return (
      <div className={cn(getGridClasses(), className)}>
        <EmptyState />
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="relative">
        {/* Cards Grid */}
        <div 
          ref={gridRef}
          className={cn(getGridClasses(), className)}
        >
          {cards.map((card) => (
            <motion.div
              key={card.id}
              data-card-id={card.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
              className={cn(
                'break-inside-avoid',
                layout === 'masonry' && 'mb-4'
              )}
            >
              <DraggableCard
                card={card}
                onUpdate={onCardUpdate}
                onDelete={onCardDelete}
                isSnapping={activeSnapZone?.cardId === card.id}
                snapDirection={activeSnapZone?.direction}
                size={getCardSize()}
              />
            </motion.div>
          ))}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeCard ? (
            <div className="opacity-90 transform rotate-2 scale-105 shadow-2xl">
              <DraggableCard
                card={activeCard}
                onUpdate={onCardUpdate}
                onDelete={onCardDelete}
                size={getCardSize()}
              />
            </div>
          ) : null}
        </DragOverlay>

        {/* Enhanced Snap Zone Visual Indicators */}
        <AnimatePresence>
          {activeCard && activeSnapZone && (
            <div className="fixed inset-0 pointer-events-none z-50">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.15 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 animate-pulse"
              />
              
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
              >
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center space-x-2">
                  <motion.span
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="text-xl"
                  >
                    🧲
                  </motion.span>
                  <span className="font-medium">Snap {activeSnapZone.direction}</span>
                </div>
              </motion.div>

              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    scale: 0, 
                    opacity: 0,
                    x: '50%',
                    y: '50%'
                  }}
                  animate={{ 
                    scale: [0, 1, 0],
                    opacity: [0, 0.6, 0],
                    x: `${50 + Math.cos(i * Math.PI / 3) * 30}%`,
                    y: `${50 + Math.sin(i * Math.PI / 3) * 30}%`
                  }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ 
                    duration: 1.5, 
                    delay: i * 0.1,
                    repeat: Infinity,
                    repeatDelay: 0.5
                  }}
                  className="absolute w-2 h-2 bg-blue-400 rounded-full"
                />
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Drag Status Indicator */}
        <DragStatusIndicator
          isDragging={!!activeCard}
          isSnapping={!!activeSnapZone}
          snapDirection={activeSnapZone?.direction}
          position={responsive.isMobile ? 'bottom-left' : 'top-right'}
        />
      </div>
    </DndContext>
  )
}