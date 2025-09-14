import React, { useState, useCallback, useMemo } from 'react';
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
} from '@dnd-kit/core';
import { Card } from '@/types/card';
import { DraggableCard } from './draggable-card';
import { VirtualizedCardGrid } from './virtualized-card-grid';
import { SmartPaginationManager, type PaginationConfig } from '@/services/smart-pagination-manager';
import { toast } from 'sonner';

interface MagneticCardGridProps {
  cards: Card[];
  onCardUpdate: (id: string, updates: Partial<Card>) => void;
  onCardDelete: (id: string) => void;
  layout?: 'grid' | 'list';
  cardSize?: 'sm' | 'md' | 'lg';
  enableVirtualization?: boolean;
  paginationConfig?: Partial<PaginationConfig>;
}

interface SnapZone {
  cardId: string;
  direction: 'top' | 'bottom' | 'left' | 'right';
  rect: DOMRect;
}

const SNAP_THRESHOLD = 40; // pixels

export function MagneticCardGrid({
  cards,
  onCardUpdate,
  onCardDelete,
  layout = 'grid',
  cardSize = 'md',
  enableVirtualization = true,
  paginationConfig,
}: MagneticCardGridProps) {
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [snapZones, setSnapZones] = useState<SnapZone[]>([]);
  const [activeSnapZone, setActiveSnapZone] = useState<SnapZone | null>(null);

  // 创建分页管理器
  const paginationManager = useMemo(() => {
    if (!enableVirtualization) return null;

    const defaultConfig: PaginationConfig = {
      pageSize: 50,
      prefetchCount: 2,
      maxCacheSize: 100,
      enableSmartPrefetching: true,
      enableMemoryOptimization: true,
      ...paginationConfig
    };

    return new SmartPaginationManager(
      defaultConfig,
      async (page: number, pageSize: number) => {
        const startIndex = (page - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, cards.length);
        return cards.slice(startIndex, endIndex);
      }
    );
  }, [enableVirtualization, paginationConfig, cards.length]);

  // 智能虚拟化：根据数据量决定是否启用
  const shouldUseVirtualization = useMemo(() => {
    return enableVirtualization && cards.length > 50;
  }, [enableVirtualization, cards.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Calculate snap zones around each card
  const calculateSnapZones = useCallback((draggedCardId: string): SnapZone[] => {
    const zones: SnapZone[] = [];
    
    cards.forEach((card) => {
      if (card.id === draggedCardId) return;
      
      const element = document.querySelector(`[data-card-id="${card.id}"]`);
      if (!element) return;
      
      const rect = element.getBoundingClientRect();
      const margin = SNAP_THRESHOLD;
      
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
      );
    });
    
    return zones;
  }, [cards]);

  // Check if a point is within a snap zone
  const findSnapZone = useCallback((x: number, y: number, zones: SnapZone[]): SnapZone | null => {
    return zones.find(zone => 
      x >= zone.rect.left && 
      x <= zone.rect.right && 
      y >= zone.rect.top && 
      y <= zone.rect.bottom
    ) || null;
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = cards.find(c => c.id === active.id);
    
    if (card) {
      setActiveCard(card);
      const zones = calculateSnapZones(card.id);
      setSnapZones(zones);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!activeCard) return;
    
    const { delta } = event;
    const draggedElement = document.querySelector(`[data-card-id="${activeCard.id}"]`);
    
    if (!draggedElement) return;
    
    const rect = draggedElement?.getBoundingClientRect();
    if (!rect) return [];
    const centerX = rect.left + rect.width / 2 + (delta?.x || 0);
    const centerY = rect.top + rect.height / 2 + (delta?.y || 0);
    
    const snapZone = findSnapZone(centerX, centerY, snapZones);
    setActiveSnapZone(snapZone);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (activeSnapZone && activeCard) {
      // Create magnetic snap effect
      const targetCard = cards.find(c => c.id === activeSnapZone.cardId);
      
      if (targetCard) {
        // Show snap success feedback
        toast.success(`Cards magnetically snapped ${activeSnapZone.direction}! 🧲`, {
          duration: 2000,
        });
        
        // Here you could implement actual card combination logic
        // For now, we'll just show the visual feedback
        console.log('Magnetic snap:', {
          draggedCard: activeCard.frontContent.title,
          targetCard: targetCard.frontContent.title,
          direction: activeSnapZone.direction,
        });
      }
    }
    
    // Reset state
    setActiveCard(null);
    setSnapZones([]);
    setActiveSnapZone(null);
  };

  const getGridClasses = () => {
    const baseClasses = "w-full p-6";
    
    switch (layout) {
      case 'list':
        return `${baseClasses} flex flex-col gap-4`;
      default:
        return `${baseClasses} grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`;
    }
  };

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
          <span className="text-4xl">📋</span>
        </div>
        <h3 className="text-lg font-semibold mb-2">No cards yet</h3>
        <p className="text-muted-foreground mb-4">
          Create your first card to get started with CardAll
        </p>
      </div>
    );
  }

  // 使用虚拟化网格或传统网格
  const CardGrid = shouldUseVirtualization ? VirtualizedCardGrid : ({ cards, onCardUpdate, onCardDelete, layout, cardSize }: any) => (
    <div className={getGridClasses()}>
      {cards.map((card: Card) => (
        <div key={card.id} data-card-id={card.id} className="break-inside-avoid">
          <DraggableCard
            card={card}
            onUpdate={onCardUpdate}
            onDelete={onCardDelete}
            isSnapping={activeSnapZone?.cardId === card.id}
            snapDirection={activeSnapZone?.direction}
          />
        </div>
      ))}
    </div>
  );

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
        <CardGrid
          cards={cards}
          onCardUpdate={onCardUpdate}
          onCardDelete={onCardDelete}
          layout={layout}
          cardSize={cardSize}
          enableVirtualization={shouldUseVirtualization}
        />

        {/* Drag Overlay */}
        <DragOverlay>
          {activeCard ? (
            <div className="opacity-90 transform rotate-2 scale-105 shadow-2xl">
              <DraggableCard
                card={activeCard}
                onUpdate={onCardUpdate}
                onDelete={onCardDelete}
              />
            </div>
          ) : null}
        </DragOverlay>

        {/* Snap Zone Visual Indicators */}
        {activeCard && activeSnapZone && (
          <div className="fixed inset-0 pointer-events-none z-50">
            <div className="absolute inset-0 bg-blue-500/10 animate-pulse" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg animate-bounce">
                🧲 Snap {activeSnapZone.direction}
              </div>
            </div>
          </div>
        )}

        {/* 性能优化指示器 (开发模式) */}
        {process.env.NODE_ENV === 'development' && shouldUseVirtualization && (
          <div className="absolute bottom-2 left-2 bg-black/80 text-white p-2 rounded text-xs">
            <div>虚拟化模式: 启用</div>
            <div>卡片数量: {cards.length}</div>
            <div>内存优化: 活跃</div>
          </div>
        )}
      </div>
    </DndContext>
  );
}