import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card } from '@/types/card';
import { DraggableCard } from './draggable-card';
import { useResizeObserver } from '@/hooks/use-resize-observer';

interface VirtualizedCardGridProps {
  cards: Card[];
  onCardUpdate: (id: string, updates: Partial<Card>) => void;
  onCardDelete: (id: string) => void;
  layout?: 'grid' | 'list';
  cardSize?: 'sm' | 'md' | 'lg';
  containerHeight?: number;
  overscanCount?: number;
  enableVirtualization?: boolean;
}

interface VisibleRange {
  startIndex: number;
  endIndex: number;
  scrollTop: number;
}

interface ItemMeasurements {
  [key: string]: {
    height: number;
    width: number;
    top: number;
  };
}

const DEFAULT_ITEM_HEIGHT = {
  sm: 200,
  md: 250,
  lg: 300
};

const GRID_COLUMNS = {
  grid: {
    sm: 4,
    md: 3,
    lg: 2
  },
  list: {
    sm: 1,
    md: 1,
    lg: 1
  }
};

export function VirtualizedCardGrid({
  cards,
  onCardUpdate,
  onCardDelete,
  layout = 'grid',
  cardSize = 'md',
  containerHeight = 600,
  overscanCount = 3,
  enableVirtualization = true
}: VirtualizedCardGridProps) {
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({
    startIndex: 0,
    endIndex: 0,
    scrollTop: 0
  });

  const [itemMeasurements, setItemMeasurements] = useState<ItemMeasurements>({});
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollTimeout, setScrollTimeout] = useState<NodeJS.Timeout | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // 计算列数和项目尺寸
  const { columns, itemHeight } = useMemo(() => {
    const cols = GRID_COLUMNS[layout][cardSize];
    const height = DEFAULT_ITEM_HEIGHT[cardSize];
    return { columns: cols, itemHeight: height };
  }, [layout, cardSize]);

  // 计算总高度
  const totalHeight = useMemo(() => {
    if (!enableVirtualization || cards.length === 0) return 'auto';

    const rowCount = Math.ceil(cards.length / columns);
    return rowCount * itemHeight;
  }, [cards.length, columns, itemHeight, enableVirtualization]);

  // 计算项目的位置
  const getItemPosition = useCallback((index: number) => {
    if (!enableVirtualization) return { top: 0, left: 0 };

    const row = Math.floor(index / columns);
    const col = index % columns;

    return {
      top: row * itemHeight,
      left: (col * 100) / columns
    };
  }, [columns, itemHeight, enableVirtualization]);

  // 计算可见项目范围
  const calculateVisibleRange = useCallback((scrollTop: number) => {
    if (!enableVirtualization) {
      return {
        startIndex: 0,
        endIndex: cards.length - 1,
        scrollTop
      };
    }

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) * columns - overscanCount * columns);
    const endIndex = Math.min(
      cards.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) * columns + overscanCount * columns
    );

    return {
      startIndex: Math.max(0, startIndex),
      endIndex: Math.min(cards.length - 1, endIndex),
      scrollTop
    };
  }, [cards.length, columns, itemHeight, containerHeight, overscanCount, enableVirtualization]);

  // 处理滚动事件
  const handleScroll = useCallback(() => {
    if (!scrollElementRef.current) return;

    const scrollTop = scrollElementRef.current.scrollTop;
    const newRange = calculateVisibleRange(scrollTop);

    setVisibleRange(newRange);
    setIsScrolling(true);

    // 清除之前的超时
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    // 设置新的超时来重置滚动状态
    const timeout = setTimeout(() => {
      setIsScrolling(false);
    }, 150);

    setScrollTimeout(timeout);
  }, [calculateVisibleRange, scrollTimeout]);

  // 更新项目测量值
  const updateItemMeasurements = useCallback((index: number, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const position = getItemPosition(index);

    setItemMeasurements(prev => ({
      ...prev,
      [index]: {
        height: rect.height,
        width: rect.width,
        top: position.top
      }
    }));
  }, [getItemPosition]);

  // 获取可见项目
  const getVisibleItems = useCallback(() => {
    if (!enableVirtualization) {
      return cards.map((card, index) => ({ card, index }));
    }

    const { startIndex, endIndex } = visibleRange;
    const items = [];

    for (let i = startIndex; i <= endIndex; i++) {
      if (i < cards.length) {
        items.push({
          card: cards[i],
          index: i
        });
      }
    }

    return items;
  }, [cards, visibleRange, enableVirtualization]);

  // 使用 Resize Observer 监听容器大小变化
  useResizeObserver(containerRef, (entry) => {
    if (entry.contentRect.height !== containerHeight) {
      // 容器高度变化时重新计算可见范围
      handleScroll();
    }
  });

  // 初始化滚动监听
  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll, { passive: true });
      // 初始计算可见范围
      handleScroll();
    }

    return () => {
      if (scrollElement) {
        scrollElement.removeEventListener('scroll', handleScroll);
      }
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [handleScroll, scrollTimeout]);

  // 卡片数据变化时重新计算
  useEffect(() => {
    handleScroll();
  }, [cards.length, columns]);

  const visibleItems = getVisibleItems();

  const getGridClasses = () => {
    const baseClasses = "relative";

    if (!enableVirtualization) {
      switch (layout) {
        case 'list':
          return `${baseClasses} flex flex-col gap-4`;
        default:
          return `${baseClasses} grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`;
      }
    }

    return baseClasses;
  };

  const getItemStyle = (index: number) => {
    if (!enableVirtualization) return {};

    const position = getItemPosition(index);
    const measurements = itemMeasurements[index];

    return {
      position: 'absolute' as const,
      top: `${position.top}px`,
      left: `${position.left}%`,
      width: `${100 / columns}%`,
      height: measurements?.height || 'auto',
      opacity: isScrolling ? 0.8 : 1,
      transition: isScrolling ? 'none' : 'opacity 0.2s ease-in-out'
    };
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

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden"
      style={{ height: enableVirtualization ? `${containerHeight}px` : 'auto' }}
    >
      <div
        ref={scrollElementRef}
        className="h-full overflow-y-auto overflow-x-hidden"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'hsl(var(--muted-foreground)) hsl(var(--muted))'
        }}
      >
        <div
          className={getGridClasses()}
          style={{
            height: enableVirtualization ? `${totalHeight}px` : 'auto',
            minHeight: enableVirtualization ? `${totalHeight}px` : 'auto'
          }}
        >
          {visibleItems.map(({ card, index }) => (
            <div
              key={card.id}
              data-card-id={card.id}
              data-index={index}
              style={getItemStyle(index)}
              className="break-inside-avoid"
              ref={(element) => {
                if (element && !itemMeasurements[index]) {
                  updateItemMeasurements(index, element);
                }
              }}
            >
              <DraggableCard
                card={card}
                onUpdate={onCardUpdate}
                onDelete={onCardDelete}
                lazyLoad={enableVirtualization && index > visibleRange.endIndex - 10}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 性能指标显示 (开发模式) */}
      {process.env.NODE_ENV === 'development' && enableVirtualization && (
        <div className="absolute top-2 right-2 bg-black/80 text-white p-2 rounded text-xs">
          <div>总卡片: {cards.length}</div>
          <div>可见: {visibleItems.length}</div>
          <div>渲染: {visibleRange.endIndex - visibleRange.startIndex + 1}</div>
          <div>虚拟化: {enableVirtualization ? '启用' : '禁用'}</div>
        </div>
      )}
    </div>
  );
}