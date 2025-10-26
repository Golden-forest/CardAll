import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useCardAllCards } from '@/contexts/cardall-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Plus,
  Search,
  Settings,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { formatCardContentForCopy, copyTextToClipboard } from '@/utils/copy-utils'
import { useScreenshot } from '@/hooks/use-screenshot'
import { ScreenshotPreviewModal } from '@/components/screenshot/screenshot-preview-modal'
import { AppConfig } from '@/config/app-config'

interface DashboardHeaderProps {
  className?: string
  authState?: any
}

export function DashboardHeader({ className, authState }: DashboardHeaderProps) {
  const {
    cards,
    filter,
    setFilter,
    getAllTags,
    getCardsWithTag
  } = useCardAllCards()
  const { toast } = useToast()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 截图功能
  const { 
    screenshot, 
    isScreenshotting, 
    takeScreenshot, 
    clearScreenshot 
  } = useScreenshot()

  // 计算统计数据
  const stats = useMemo(() => {
    const allCards = cards.allCards || []
    const allTags = getAllTags() || []
    const filteredCards = getCardsWithTag(filter.tag) || []

    return {
      totalCards: allCards.length,
      totalTags: allTags.length,
      filteredCards: filteredCards.length
    }
  }, [cards.allCards, getAllTags, filter.tag, getCardsWithTag])

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isSearchOpen])

  // 处理创建卡片
  const handleCreateCard = async () => {
    setShowCreateModal(true)
  }

  // 处理搜索
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // 搜索逻辑已通过输入框的onChange处理
  }

  // 处理截图
  const handleScreenshot = async () => {
    try {
      await takeScreenshot('.masonry-grid')
      toast({
        title: '截图成功',
        description: '已成功捕获卡片区域截图'
      })
    } catch (error) {
      toast({
        title: '截图失败',
        description: '请确保浏览器支持截图功能',
        variant: 'destructive'
      })
    }
  }

  // 处理复制所有内容
  const handleCopyAll = async () => {
    try {
      const allCards = getCardsWithTag(filter.tag)
      if (allCards.length === 0) {
        toast({
          title: '没有内容',
          description: '当前没有可复制的卡片内容',
          variant: 'destructive'
        })
        return
      }

      const allContent = allCards.map(card => 
        formatCardContentForCopy(card)
      ).join('\n\n')

      await copyTextToClipboard(allContent)
      toast({
        title: '复制成功',
        description: `已复制 ${allCards.length} 张卡片的内容`
      })
    } catch (error) {
      toast({
        title: '复制失败',
        description: '请检查剪贴板权限设置',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className={cn(
      'border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
      className
    )}>
      <div className="container flex h-16 items-center">
        {/* Logo和标题 */}
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold">CardAll</h1>
          <div className="hidden sm:flex items-center space-x-2 text-sm text-muted-foreground">
            <span>{stats.totalCards} 卡片</span>
            <span>•</span>
            <span>{stats.totalTags} 标签</span>
            {filter.tag && (
              <>
                <span>•</span>
                <span>筛选: {stats.filteredCards}</span>
              </>
            )}
          </div>
        </div>

        {/* 搜索栏 - 桌面端显示搜索框 */}
        <div className="hidden md:flex flex-1 max-w-sm mx-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索卡片内容..."
              value={filter.search || ''}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="pl-8"
            />
          </div>
        </div>

        {/* 搜索按钮 - 移动端显示 */}
        <div className="flex md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAll}
            disabled={stats.totalCards === 0}
          >
            复制全部
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleScreenshot}
            disabled={isScreenshotting}
          >
            {isScreenshotting ? '截图中...' : '截图'}
          </Button>

          <Button
            onClick={handleCreateCard}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            新建卡片
          </Button>

                  </div>
      </div>

      {/* 截图预览模态框 */}
      {screenshot && (
        <ScreenshotPreviewModal
          screenshot={screenshot}
          onClose={clearScreenshot}
        />
      )}

      {/* 移动端搜索覆盖层 */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-background/95 backdrop-blur md:hidden',
          isSearchOpen ? 'block' : 'hidden'
        )}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSearchOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <form onSubmit={handleSearch} className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="搜索卡片内容..."
                value={filter.search || ''}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}