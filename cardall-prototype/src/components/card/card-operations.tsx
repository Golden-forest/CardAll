import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, Search, Settings, Sliders } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { formatCardContentForCopy, copyTextToClipboard } from '@/utils/copy-utils'
import { useScreenshot } from '@/hooks/use-screenshot'
import { ScreenshotPreviewModal } from '@/components/screenshot/screenshot-preview-modal'

interface CardOperationsProps {
  filter: any
  setFilter: (filter: any) => void
  viewSettings: any
  setViewSettings: (settings: any) => void
  dispatch: (action: any) => Promise<void>
  getAllTags: () => string[]
  updateTagsInAllCards: (updates: Record<string, string>) => Promise<void>
  getCardsWithTag: (tagName: string) => any[]
  layoutSettings: any
  setLayoutSettings: (settings: any) => void
}

export function CardOperations({
  filter,
  setFilter,
  viewSettings,
  setViewSettings,
  dispatch,
  getAllTags,
  updateTagsInAllCards,
  getCardsWithTag,
  layoutSettings,
  setLayoutSettings
}: CardOperationsProps) {
  const { toast } = useToast()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const { captureScreenshot, isCapturing, previewImage, showPreview, hidePreview } = useScreenshot()

  // 创建卡片
  const handleCreateCard = async () => {
    try {
      await dispatch({
        type: 'CREATE_CARD',
        payload: {
          frontContent: {
            title: '新卡片',
            content: '',
            tags: [],
            images: []
          },
          backContent: {
            title: '背面',
            content: '',
            tags: [],
            images: []
          },
          folderId: filter.selectedFolderId || null,
          style: 'default'
        }
      })
      
      toast({
        title: "卡片创建成功",
        description: "新卡片已添加到您的收藏中"
      })
    } catch (error) {
      console.error('Failed to create card:', error)
      toast({
        title: "创建失败",
        description: "无法创建新卡片，请稍后重试",
        variant: "destructive"
      })
    }
  }

  // 复制选中卡片的内容
  const handleCopySelected = async () => {
    try {
      const selectedCards = filter.selectedCardIds || []
      if (selectedCards.length === 0) {
        toast({
          title: "没有选中的卡片",
          description: "请先选择要复制的卡片",
          variant: "destructive"
        })
        return
      }

      const cardsData = selectedCards.map(id => {
        const card = getCardsWithTag('').find(c => c.id === id)
        return card ? formatCardContentForCopy(card.frontContent || '', card.backContent || '') : ''
      }).filter(Boolean)

      const combinedContent = cardsData.join('\n\n---\n\n')
      
      if (await copyTextToClipboard(combinedContent)) {
        toast({
          title: "复制成功",
          description: `已复制 ${selectedCards.length} 张卡片的内容`
        })
      } else {
        toast({
          title: "复制失败",
          description: "无法复制到剪贴板",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Failed to copy cards:', error)
      toast({
        title: "复制失败",
        description: "复制过程中发生错误",
        variant: "destructive"
      })
    }
  }

  // 截图选中卡片
  const handleScreenshotSelected = async () => {
    try {
      const selectedCards = filter.selectedCardIds || []
      if (selectedCards.length === 0) {
        toast({
          title: "没有选中的卡片",
          description: "请先选择要截图的卡片",
          variant: "destructive"
        })
        return
      }

      // 创建一个临时容器来包含选中的卡片
      const container = document.createElement('div')
      container.style.position = 'absolute'
      container.style.left = '-9999px'
      container.style.backgroundColor = 'white'
      container.style.padding = '20px'
      container.style.borderRadius = '8px'
      
      // 查找所有选中的卡片元素并克隆
      const cardElements = document.querySelectorAll('[data-card-id]')
      cardElements.forEach(element => {
        const cardId = element.getAttribute('data-card-id')
        if (selectedCards.includes(cardId || '')) {
          const clone = element.cloneNode(true) as HTMLElement
          clone.style.margin = '10px'
          container.appendChild(clone)
        }
      })
      
      // 如果没有找到卡片元素，显示错误
      if (container.children.length === 0) {
        toast({
          title: "无法找到卡片元素",
          description: "请确保卡片已正确渲染",
          variant: "destructive"
        })
        return
      }
      
      // 将临时容器添加到文档中
      document.body.appendChild(container)
      
      try {
        await captureScreenshot(container, `cards-${selectedCards.join('-')}`)
      } finally {
        // 清理临时容器
        document.body.removeChild(container)
      }
    } catch (error) {
      console.error('Failed to screenshot cards:', error)
      toast({
        title: "截图失败",
        description: "无法生成截图",
        variant: "destructive"
      })
    }
  }

  // 处理搜索
  const handleSearch = (searchTerm: string) => {
    setFilter(prev => ({ ...prev, searchTerm }))
  }

  // 处理标签过滤
  const handleTagFilter = (tagName: string) => {
    setFilter(prev => ({
      ...prev,
      selectedTagIds: prev.selectedTagIds?.includes(tagName)
        ? prev.selectedTagIds.filter(id => id !== tagName)
        : [...(prev.selectedTagIds || []), tagName]
    }))
  }

  // 清除所有过滤器
  const handleClearFilters = () => {
    setFilter(prev => ({
      ...prev,
      searchTerm: '',
      selectedTagIds: [],
      selectedFolderId: null
    }))
  }

  return (
    <div className="space-y-4">
      {/* 搜索和操作栏 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="搜索卡片..."
            value={filter.searchTerm || ''}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Button
          onClick={handleCreateCard}
          size="sm"
          className="bg-blue-500 hover:bg-blue-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          新建卡片
        </Button>
        
        <Button
          onClick={handleCopySelected}
          size="sm"
          variant="outline"
          disabled={!filter.selectedCardIds?.length}
        >
          复制选中
        </Button>
        
        <Button
          onClick={handleScreenshotSelected}
          size="sm"
          variant="outline"
          disabled={!filter.selectedCardIds?.length || isCapturing}
        >
          {isCapturing ? '截图中...' : '截图选中'}
        </Button>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline">
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>显示布局控制</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLayoutSettings(prev => ({ 
                    ...prev, 
                    showLayoutControls: !prev.showLayoutControls 
                  }))}
                >
                  <Sliders className="h-4 w-4" />
                </Button>
              </div>
              
              {layoutSettings.showLayoutControls && (
                <>
                  <div className="space-y-2">
                    <Label>间距: {layoutSettings.gap}px</Label>
                    <Slider
                      value={[layoutSettings.gap]}
                      onValueChange={([value]) => 
                        setLayoutSettings(prev => ({ ...prev, gap: value }))
                      }
                      max={32}
                      min={8}
                      step={4}
                      className="w-full"
                    />
                  </div>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* 过滤器显示 */}
      {(filter.searchTerm || filter.selectedTagIds?.length || filter.selectedFolderId) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">当前过滤器:</span>
          
          {filter.searchTerm && (
            <Badge variant="secondary" className="gap-1">
              搜索: {filter.searchTerm}
              <button
                onClick={() => setFilter(prev => ({ ...prev, searchTerm: '' }))}
                className="ml-1 hover:bg-gray-200 rounded-full w-4 h-4 flex items-center justify-center text-xs"
              >
                ×
              </button>
            </Badge>
          )}
          
          {filter.selectedTagIds?.map(tagId => (
            <Badge key={tagId} variant="secondary" className="gap-1">
              标签: {tagId}
              <button
                onClick={() => handleTagFilter(tagId)}
                className="ml-1 hover:bg-gray-200 rounded-full w-4 h-4 flex items-center justify-center text-xs"
              >
                ×
              </button>
            </Badge>
          ))}
          
          {filter.selectedFolderId && (
            <Badge variant="secondary" className="gap-1">
              文件夹: {filter.selectedFolderId}
              <button
                onClick={() => setFilter(prev => ({ ...prev, selectedFolderId: null }))}
                className="ml-1 hover:bg-gray-200 rounded-full w-4 h-4 flex items-center justify-center text-xs"
              >
                ×
              </button>
            </Badge>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClearFilters}
            className="h-6 px-2 text-xs"
          >
            清除全部
          </Button>
        </div>
      )}

      {/* 截图预览模态框 */}
      {showPreview && previewImage && (
        <ScreenshotPreviewModal
          imageUrl={previewImage}
          onClose={hidePreview}
        />
      )}
    </div>
  )
}