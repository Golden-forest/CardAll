import React, { useState, useEffect, useMemo } from 'react'
import { useCardAllCards, useCardAllFolders, useCardAllTags } from '@/contexts/cardall-context'
import { useStorageAdapter } from '@/hooks/use-cards-adapter'
import { authService, type AuthState } from '@/services/auth'
import { FolderPanelProvider } from '@/contexts/folder-panel-context'
import { OptimizedMasonryGrid } from '../card/optimized-masonry-grid'
import { DashboardHeader } from './dashboard-header'
import { DashboardSidebar } from './dashboard-sidebar'
import { MigrationStatusBanner } from '../storage/migration-status-banner'
import { cn } from '@/lib/utils'

interface DashboardProps {
  className?: string
}

export function Dashboard({ className }: DashboardProps) {
  // Authentication state
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: false,
    error: null
  })

  // UI state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  // Context hooks
  const {
    cards,
    filter,
    setFilter,
    viewSettings,
    setViewSettings
  } = useCardAllCards()

  const {
    selectedFolderId,
    setSelectedFolderId,
    folders,
    isLoading: foldersLoading
  } = useCardAllFolders()

  const { tags } = useCardAllTags()

  // Storage adapter for migration status
  const {
    mode,
    isReady,
    migrationProgress,
    isMigrating
  } = useStorageAdapter()

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange(setAuthState)
    return unsubscribe
  }, [])

  // 计算过滤后的卡片
  const filteredCards = useMemo(() => {
    let cardsToShow = cards.allCards || []

    // 按文件夹筛选
    if (selectedFolderId) {
      cardsToShow = cardsToShow.filter(card => card.folderId === selectedFolderId)
    }

    // 按标签筛选
    if (filter.tag) {
      cardsToShow = cardsToShow.filter(card =>
        card.frontContent.tags?.includes(filter.tag) ||
        card.backContent.tags?.includes(filter.tag)
      )
    }

    // 按搜索词筛选
    if (filter.search) {
      const searchLower = filter.search.toLowerCase()
      cardsToShow = cardsToShow.filter(card => {
        const searchableContent = [
          ...extractTextFromContent(card.frontContent),
          ...extractTextFromContent(card.backContent)
        ].join(' ').toLowerCase()

        return searchableContent.includes(searchLower)
      })
    }

    // 按创建时间倒序排序
    return cardsToShow.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [cards.allCards, selectedFolderId, filter.tag, filter.search])

  // 提取文本内容的辅助函数
  const extractTextFromContent = (content: any): string[] => {
    if (!content) return []
    
    const texts: string[] = []
    
    if (content.type === 'doc') {
      content.content?.forEach((node: any) => {
        if (node.type === 'paragraph') {
          const paragraphText = node.content?.map((textNode: any) => 
            textNode.text || ''
          ).join('') || ''
          if (paragraphText.trim()) {
            texts.push(paragraphText)
          }
        } else if (node.type === 'heading') {
          const headingText = node.content?.map((textNode: any) => 
            textNode.text || ''
          ).join('') || ''
          if (headingText.trim()) {
            texts.push(headingText)
          }
        }
      })
    }
    
    return texts
  }

  // 切换侧边栏
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  return (
    <FolderPanelProvider>
      <div className={cn('flex flex-col h-screen bg-background', className)}>
        {/* 迁移状态横幅 */}
        <MigrationStatusBanner />

        {/* 头部 */}
        <DashboardHeader authState={authState} />

        {/* 主体内容 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 侧边栏 */}
          <DashboardSidebar
            collapsed={sidebarCollapsed}
            onToggle={toggleSidebar}
          />

          {/* 主内容区 */}
          <main className="flex-1 overflow-hidden p-6">
            <div className="max-w-7xl mx-auto h-full">
              {/* 系统未就绪状态 */}
              {!isReady && (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">
                      {isMigrating ? '正在迁移数据...' : '系统初始化中...'}
                    </p>
                  </div>
                </div>
              )}

              {/* 加载状态 */}
              {isReady && (foldersLoading || cards.loading) && (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">加载中...</p>
                  </div>
                </div>
              )}

              {/* 卡片网格 */}
              {isReady && !foldersLoading && !cards.loading && (
                <OptimizedMasonryGrid
                  cards={filteredCards}
                  gap={viewSettings.gap || 16}
                  enableVirtualization={filteredCards.length > 50}
                />
              )}

              {/* 空状态 */}
              {isReady && !foldersLoading && !cards.loading && filteredCards.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-lg font-semibold mb-2">还没有卡片</h3>
                  <p className="text-muted-foreground mb-4">
                    {selectedFolderId || filter.tag || filter.search
                      ? '没有找到符合条件的卡片'
                      : '创建你的第一张知识卡片吧！'
                    }
                  </p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </FolderPanelProvider>
  )
}