/**
 * 虚拟滚动组件 - 小数据集优化版本
 * 针对实际数据量（9 cards, 8 folders, 13 tags）的轻量级实现
 */

import { Component, createSignal, createEffect, onCleanup, onMount } from 'solid-js'
import { batchOperationManager } from '../utils/batch-operation-manager'
import { getCardsOptimized, getFoldersOptimized, getTagsOptimized } from '../utils/lightweight-query-optimizer'

// ============================================================================
// 类型定义
// ============================================================================

interface VirtualScrollProps<T> {
  data: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => any
  overscan?: number
  onEndReached?: () => void
  endReachedThreshold?: number
  loading?: boolean
  emptyState?: any
}

interface InfiniteScrollProps<T> {
  fetchData: (page: number, limit: number) => Promise<{
    data: T[]
    totalCount: number
  }>
  renderItem: (item: T, index: number) => any
  itemHeight: number
  containerHeight: number
  pageSize?: number
  preloadThreshold?: number
  emptyState?: any
  loadingState?: any
  errorState?: any
}

// ============================================================================
// 虚拟滚动组件
// ============================================================================

export function VirtualScroll<T>(props: VirtualScrollProps<T>) {
  const [scrollTop, setScrollTop] = createSignal(0)
  const [containerElement, setContainerElement] = createSignal<HTMLDivElement | null>(null)

  // 计算虚拟滚动参数
  const totalHeight = () => props.data.length * props.itemHeight
  const startIndex = () => Math.max(0, Math.floor(scrollTop() / props.itemHeight) - (props.overscan || 5))
  const endIndex = () => Math.min(
    props.data.length - 1,
    Math.ceil((scrollTop() + props.containerHeight) / props.itemHeight) + (props.overscan || 5)
  )
  const visibleItems = () => props.data.slice(startIndex(), endIndex() + 1)
  const offsetY = () => startIndex() * props.itemHeight

  // 处理滚动事件
  const handleScroll = () => {
    if (!containerElement()) return
    
    const currentScrollTop = containerElement()!.scrollTop
    setScrollTop(currentScrollTop)

    // 检查是否滚动到底部
    if (props.onEndReached) {
      const scrollBottom = currentScrollTop + props.containerHeight
      const threshold = props.endReachedThreshold || 100
      
      if (totalHeight() - scrollBottom <= threshold) {
        props.onEndReached()
      }
    }
  }

  // 事件监听器
  createEffect(() => {
    const container = containerElement()
    if (!container) return

    container.addEventListener('scroll', handleScroll, { passive: true })
    onCleanup(() => {
      container.removeEventListener('scroll', handleScroll)
    })
  })

  return (
    <div
      ref={setContainerElement}
      style={{
        height: `${props.containerHeight}px`,
        overflow: 'auto',
        position: 'relative'
      }}
    >
      {props.loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          'z-index': 10
        }}>
          加载中...
        </div>
      )}
      
      {props.data.length === 0 && !props.loading && props.emptyState && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          'text-align': 'center',
          color: '#666'
        }}>
          {props.emptyState}
        </div>
      )}

      <div style={{ height: `${totalHeight()}px`, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: `${offsetY()}px`,
            width: '100%'
          }}
        >
          {visibleItems().map((item, index) => (
            <div key={startIndex() + index}>
              {props.renderItem(item, startIndex() + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// 无限滚动组件
// ============================================================================

export function InfiniteScroll<T>(props: InfiniteScrollProps<T>) {
  const [data, setData] = createSignal<T[]>([])
  const [currentPage, setCurrentPage] = createSignal(1)
  const [totalCount, setTotalCount] = createSignal(0)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [hasMore, setHasMore] = createSignal(true)

  // 加载数据
  const loadData = async (page: number, append = true) => {
    if (loading() || !hasMore()) return

    setLoading(true)
    setError(null)

    try {
      const result = await props.fetchData(page, props.pageSize || 20)
      
      if (append) {
        setData(prev => [...prev, ...result.data])
      } else {
        setData(result.data)
      }
      
      setTotalCount(result.totalCount)
      setHasMore(data().length < result.totalCount)
      setCurrentPage(page)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  // 刷新数据
  const refresh = async () => {
    setCurrentPage(1)
    setHasMore(true)
    await loadData(1, false)
  }

  // 加载更多
  const loadMore = async () => {
    if (hasMore()) {
      await loadData(currentPage() + 1, true)
    }
  }

  // 初始化加载
  onMount(() => {
    loadData(1, false)
  })

  return (
    <VirtualScroll
      data={data()}
      itemHeight={props.itemHeight}
      containerHeight={props.containerHeight}
      renderItem={props.renderItem}
      onEndReached={loadMore}
      endReachedThreshold={props.preloadThreshold || 200}
      loading={loading()}
      emptyState={props.emptyState}
    />
  )
}

// ============================================================================
// 预优化的数据获取组件
// ============================================================================

export function OptimizedCardList(props: {
  userId?: string
  folderId?: string
  itemHeight?: number
  containerHeight?: number
  onCardSelect?: (card: any) => void
}) {
  const [cards, setCards] = createSignal<any[]>([])
  const [loading, setLoading] = createSignal(true)
  const [totalCount, setTotalCount] = createSignal(0)

  // 获取卡片数据
  const fetchCards = async () => {
    setLoading(true)
    try {
      const result = await getCardsOptimized({
        userId: props.userId,
        folderId: props.folderId,
        limit: 100, // 小数据集直接加载更多
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      })
      
      setCards(result.data)
      setTotalCount(result.totalCount)
    } catch (error) {
      console.error('获取卡片失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 初始化和监听变化
  createEffect(() => {
    fetchCards()
  })

  // 渲染单个卡片
  const renderCard = (card: any, index: number) => {
    return (
      <div
        style={{
          height: `${props.itemHeight || 120}px`,
          padding: '12px',
          'border-bottom': '1px solid #eee',
          cursor: 'pointer',
          transition: 'background-color 0.2s'
        }}
        onClick={() => props.onCardSelect?.(card)}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div style={{ 'font-weight': 'bold', 'margin-bottom': '8px' }}>
          {card.frontContent.title}
        </div>
        <div style={{ 
          'font-size': '14px', 
          color: '#666',
          overflow: 'hidden',
          'text-overflow': 'ellipsis',
          'white-space': 'nowrap'
        }}>
          {card.frontContent.text || '无内容'}
        </div>
        <div style={{ 
          'font-size': '12px', 
          color: '#999',
          'margin-top': '8px'
        }}>
          更新时间: {new Date(card.updatedAt).toLocaleString()}
        </div>
      </div>
    )
  }

  const emptyState = (
    <div>
      <div style={{ 'font-size': '18px', 'margin-bottom': '8px' }}>暂无卡片</div>
      <div style={{ color: '#666' }}>创建您的第一张卡片开始学习</div>
    </div>
  )

  return (
    <VirtualScroll
      data={cards()}
      itemHeight={props.itemHeight || 120}
      containerHeight={props.containerHeight || 600}
      renderItem={renderCard}
      loading={loading()}
      emptyState={emptyState}
    />
  )
}

export function OptimizedFolderList(props: {
  userId?: string
  parentId?: string
  itemHeight?: number
  containerHeight?: number
  onFolderSelect?: (folder: any) => void
}) {
  const [folders, setFolders] = createSignal<any[]>([])
  const [loading, setLoading] = createSignal(true)

  const fetchFolders = async () => {
    setLoading(true)
    try {
      const result = await getFoldersOptimized({
        userId: props.userId,
        parentId: props.parentId,
        sortBy: 'name',
        sortOrder: 'asc'
      })
      
      setFolders(result.data)
    } catch (error) {
      console.error('获取文件夹失败:', error)
    } finally {
      setLoading(false)
    }
  }

  createEffect(() => {
    fetchFolders()
  })

  const renderFolder = (folder: any, index: number) => {
    return (
      <div
        style={{
          height: `${props.itemHeight || 60}px`,
          padding: '12px',
          'border-bottom': '1px solid #eee',
          cursor: 'pointer',
          display: 'flex',
          'align-items': 'center',
          transition: 'background-color 0.2s'
        }}
        onClick={() => props.onFolderSelect?.(folder)}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div style={{ 'margin-right': '12px' }}>📁</div>
        <div style={{ flex: 1 }}>
          <div style={{ 'font-weight': 'bold' }}>{folder.name}</div>
          {folder.description && (
            <div style={{ 'font-size': '12px', color: '#666' }}>
              {folder.description}
            </div>
          )}
        </div>
      </div>
    )
  }

  const emptyState = (
    <div>
      <div style={{ 'font-size': '18px', 'margin-bottom': '8px' }}>暂无文件夹</div>
      <div style={{ color: '#666' }}>创建文件夹来组织您的卡片</div>
    </div>
  )

  return (
    <VirtualScroll
      data={folders()}
      itemHeight={props.itemHeight || 60}
      containerHeight={props.containerHeight || 400}
      renderItem={renderFolder}
      loading={loading()}
      emptyState={emptyState}
    />
  )
}

export function OptimizedTagList(props: {
  userId?: string
  itemHeight?: number
  containerHeight?: number
  onTagSelect?: (tag: any) => void
}) {
  const [tags, setTags] = createSignal<any[]>([])
  const [loading, setLoading] = createSignal(true)

  const fetchTags = async () => {
    setLoading(true)
    try {
      const result = await getTagsOptimized({
        userId: props.userId,
        sortBy: 'name',
        sortOrder: 'asc'
      })
      
      setTags(result.data)
    } catch (error) {
      console.error('获取标签失败:', error)
    } finally {
      setLoading(false)
    }
  }

  createEffect(() => {
    fetchTags()
  })

  const renderTag = (tag: any, index: number) => {
    return (
      <div
        style={{
          height: `${props.itemHeight || 40}px`,
          padding: '8px 12px',
          'border-bottom': '1px solid #eee',
          cursor: 'pointer',
          display: 'flex',
          'align-items': 'center',
          transition: 'background-color 0.2s'
        }}
        onClick={() => props.onTagSelect?.(tag)}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div style={{ 
          'margin-right': '8px',
          'font-size': '14px'
        }}>
          🏷️
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ 'font-size': '14px' }}>{tag.name}</div>
        </div>
        <div style={{ 
          'font-size': '12px', 
          color: '#999',
          'background-color': '#f0f0f0',
          padding: '2px 6px',
          'border-radius': '12px'
        }}>
          {tag.count || 0}
        </div>
      </div>
    )
  }

  const emptyState = (
    <div>
      <div style={{ 'font-size': '18px', 'margin-bottom': '8px' }}>暂无标签</div>
      <div style={{ color: '#666' }}>创建标签来分类您的卡片</div>
    </div>
  )

  return (
    <VirtualScroll
      data={tags()}
      itemHeight={props.itemHeight || 40}
      containerHeight={props.containerHeight || 300}
      renderItem={renderTag}
      loading={loading()}
      emptyState={emptyState}
    />
  )
}

// ============================================================================
// 小数据集专用组件 - 无虚拟化
// ============================================================================

export function SimpleCardList(props: {
  cards: any[]
  onCardSelect?: (card: any) => void
}) {
  // 小数据集直接渲染，无需虚拟化
  return (
    <div style={{ 'max-height': '600px', overflow: 'auto' }}>
      {props.cards.length === 0 ? (
        <div style={{
          padding: '40px',
          'text-align': 'center',
          color: '#666'
        }}>
          <div style={{ 'font-size': '18px', 'margin-bottom': '8px' }}>暂无卡片</div>
          <div>创建您的第一张卡片开始学习</div>
        </div>
      ) : (
        props.cards.map((card, index) => (
          <div
            key={card.id}
            style={{
              padding: '12px',
              'border-bottom': '1px solid #eee',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onClick={() => props.onCardSelect?.(card)}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{ 'font-weight': 'bold', 'margin-bottom': '8px' }}>
              {card.frontContent.title}
            </div>
            <div style={{ 
              'font-size': '14px', 
              color: '#666',
              overflow: 'hidden',
              'text-overflow': 'ellipsis',
              'white-space': 'nowrap'
            }}>
              {card.frontContent.text || '无内容'}
            </div>
            <div style={{ 
              'font-size': '12px', 
              color: '#999',
              'margin-top': '8px'
            }}>
              更新时间: {new Date(card.updatedAt).toLocaleString()}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export function SimpleFolderList(props: {
  folders: any[]
  onFolderSelect?: (folder: any) => void
}) {
  return (
    <div style={{ 'max-height': '400px', overflow: 'auto' }}>
      {props.folders.length === 0 ? (
        <div style={{
          padding: '40px',
          'text-align': 'center',
          color: '#666'
        }}>
          <div style={{ 'font-size': '18px', 'margin-bottom': '8px' }}>暂无文件夹</div>
          <div>创建文件夹来组织您的卡片</div>
        </div>
      ) : (
        props.folders.map((folder, index) => (
          <div
            key={folder.id}
            style={{
              padding: '12px',
              'border-bottom': '1px solid #eee',
              cursor: 'pointer',
              display: 'flex',
              'align-items': 'center',
              transition: 'background-color 0.2s'
            }}
            onClick={() => props.onFolderSelect?.(folder)}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{ 'margin-right': '12px' }}>📁</div>
            <div style={{ flex: 1 }}>
              <div style={{ 'font-weight': 'bold' }}>{folder.name}</div>
              {folder.description && (
                <div style={{ 'font-size': '12px', color: '#666' }}>
                  {folder.description}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}