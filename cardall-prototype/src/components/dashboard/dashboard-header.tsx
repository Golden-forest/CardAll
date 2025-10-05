import React, { useState, useMemo } from 'react'
import { useCardAllCards } from '@/contexts/cardall-context'
// import { authService, type AuthState } from '@/services/auth' // 认证功能已禁用
// import { useAuthModal } from '@/contexts/auth-modal-context' // 认证功能已禁用
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Plus, 
  Search, 
  Settings
} from 'lucide-react'
// import { User, LogIn } from 'lucide-react' // 认证功能已禁用
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
// import { UserAvatar } from '@/components/ui/user-avatar' // 认证功能已禁用
import { formatCardContentForCopy, copyTextToClipboard } from '@/utils/copy-utils'
import { useScreenshot } from '@/hooks/use-screenshot'
import { ScreenshotPreviewModal } from '@/components/screenshot/screenshot-preview-modal'
import { DataIntegrityIndicator } from '@/components/data-integrity/data-integrity-indicator'

interface DashboardHeaderProps {
  // authState: AuthState // 认证功能已禁用
  className?: string
}

export function DashboardHeader({ className }: DashboardHeaderProps) {
  // const { openModal } = useAuthModal() // 认证功能已禁用
  // authState参数已移除，使用默认值
  const { 
    cards, 
    filter, 
    setFilter,
    getAllTags,
    getCardsWithTag
  } = useCardAllCards()
  const { toast } = useToast()
  const [showCreateModal, setShowCreateModal] = useState(false)

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

  // 处理创建卡片（无需认证）
  const handleCreateCard = async () => {
    // 认证检查已移除，直接显示创建模态框
    setShowCreateModal(true)
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

        {/* 搜索栏 */}
        <div className="flex-1 max-w-sm mx-4">
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

        {/* 操作按钮 */}
        <div className="flex items-center space-x-2">
          {/* 数据完整性指示器 */}
          <DataIntegrityIndicator showDetails={true} />

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

          {/* 用户区域已移除 - 应用现在完全本地化 */}
        </div>
      </div>

      {/* 截图预览模态框 */}
      {screenshot && (
        <ScreenshotPreviewModal
          screenshot={screenshot}
          onClose={clearScreenshot}
        />
      )}
    </div>
  )
}