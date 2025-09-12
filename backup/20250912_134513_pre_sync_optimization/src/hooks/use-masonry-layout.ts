import { useState, useEffect, useCallback, useRef } from 'react'
import { useResizeObserver } from './use-resize-observer'

export interface MasonryItem {
  id: string
  height: number
  element?: HTMLElement
}

export interface MasonryPosition {
  x: number
  y: number
  width: number
  height: number
}

export interface MasonryLayoutConfig {
  columns: number
  gap: number
  containerWidth: number
}

export interface UseMasonryLayoutOptions {
  items: MasonryItem[]
  gap?: number
  minColumnWidth?: number
  maxColumns?: number
  breakpoints?: {
    sm: number
    md: number
    lg: number
    xl: number
    '2xl': number
  }
}

export function useMasonryLayout({
  items,
  gap = 16,
  minColumnWidth = 280,
  maxColumns = 5,
  breakpoints = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536
  }
}: UseMasonryLayoutOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [positions, setPositions] = useState<Map<string, MasonryPosition>>(new Map())
  const [containerHeight, setContainerHeight] = useState(0)
  const [config, setConfig] = useState<MasonryLayoutConfig>({
    columns: 1,
    gap,
    containerWidth: 0
  })

  // Calculate optimal number of columns based on container width
  const calculateColumns = useCallback((containerWidth: number): number => {
    if (containerWidth === 0) return 1
    
    // Calculate based on breakpoints for responsive behavior
    let maxCols = maxColumns
    if (containerWidth < breakpoints.sm) maxCols = 1
    else if (containerWidth < breakpoints.md) maxCols = 2
    else if (containerWidth < breakpoints.lg) maxCols = 3
    else if (containerWidth < breakpoints.xl) maxCols = 4
    
    // Calculate optimal columns based on min column width
    const availableWidth = containerWidth - gap
    const possibleColumns = Math.floor(availableWidth / (minColumnWidth + gap))
    
    return Math.min(Math.max(1, possibleColumns), maxCols)
  }, [gap, minColumnWidth, maxColumns, breakpoints])

  // Calculate positions for all items
  const calculatePositions = useCallback((
    items: MasonryItem[],
    columns: number,
    containerWidth: number,
    gap: number
  ): { positions: Map<string, MasonryPosition>; totalHeight: number } => {
    if (columns === 0 || containerWidth === 0) {
      return { positions: new Map(), totalHeight: 0 }
    }

    // Calculate column width ensuring all columns are exactly the same width
    const totalGapWidth = gap * (columns - 1)
    const availableWidth = containerWidth - totalGapWidth
    const columnWidth = Math.floor(availableWidth / columns)
    
    const columnHeights = new Array(columns).fill(0)
    const newPositions = new Map<string, MasonryPosition>()

    items.forEach((item) => {
      // Find the shortest column
      const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights))
      const x = shortestColumnIndex * (columnWidth + gap)
      const y = columnHeights[shortestColumnIndex]

      // Set position for this item with consistent width
      newPositions.set(item.id, {
        x,
        y,
        width: columnWidth,
        height: item.height
      })

      // Update column height
      columnHeights[shortestColumnIndex] += item.height + gap
    })

    const totalHeight = Math.max(...columnHeights) - gap

    return { positions: newPositions, totalHeight }
  }, [])

  // Handle container resize
  const handleResize = useCallback((entries: ResizeObserverEntry[]) => {
    const entry = entries[0]
    if (!entry) return

    const containerWidth = entry.contentRect.width
    const columns = calculateColumns(containerWidth)

    setConfig(prev => ({
      ...prev,
      columns,
      containerWidth
    }))
  }, [calculateColumns])

  // Use resize observer to watch container
  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const resizeObserver = new ResizeObserver((entries) => {
      handleResize(entries)
    })

    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
    }
  }, [handleResize])

  // Recalculate layout when items or config changes
  useEffect(() => {
    if (items.length === 0 || config.containerWidth === 0) {
      setPositions(new Map())
      setContainerHeight(0)
      return
    }

    const { positions: newPositions, totalHeight } = calculatePositions(
      items,
      config.columns,
      config.containerWidth,
      gap
    )

    setPositions(newPositions)
    setContainerHeight(totalHeight)
  }, [items, config, gap, calculatePositions])

  // Get position for a specific item
  const getItemPosition = useCallback((itemId: string): MasonryPosition | undefined => {
    return positions.get(itemId)
  }, [positions])

  // Update item height (useful when content changes)
  const updateItemHeight = useCallback((itemId: string, newHeight: number) => {
    const itemIndex = items.findIndex(item => item.id === itemId)
    if (itemIndex === -1) return

    // Update the item height and recalculate layout
    const updatedItems = [...items]
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], height: newHeight }

    const { positions: newPositions, totalHeight } = calculatePositions(
      updatedItems,
      config.columns,
      config.containerWidth,
      gap
    )

    setPositions(newPositions)
    setContainerHeight(totalHeight)
  }, [items, config, gap, calculatePositions])

  return {
    containerRef,
    positions,
    containerHeight,
    config,
    getItemPosition,
    updateItemHeight
  }
}