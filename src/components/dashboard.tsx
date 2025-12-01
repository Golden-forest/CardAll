import React, { useState, useMemo, useEffect } from 'react'
import { useCardAllCards, useCardAllFolders, useCardAllTags } from '@/contexts/cardall-context'
import { OptimizedMasonryGrid } from './card/optimized-masonry-grid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import {
  Plus,
  Search,
  Settings,
  Folder,
  Tag,
  FolderPlus,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { formatCardContentForCopy, copyTextToClipboard } from '@/utils/copy-utils'
import { useScreenshot } from '@/hooks/use-screenshot'
import { ScreenshotPreviewModal } from '@/components/screenshot/screenshot-preview-modal'
import { useToast } from '@/hooks/use-toast'
import {
  FolderContextMenu,
  CreateFolderDialog,
  DeleteFolderDialog
} from '@/components/folder'
import {
  TagContextMenu,
  RenameTagDialog,
  DeleteTagDialog,
  ConnectedTagPanel
} from '@/components/tag'
import { FolderPanelProvider } from '@/contexts/folder-panel-context'
import { AppConfig } from '@/config/app-config'

interface DashboardProps {
  className?: string
}

export function Dashboard({ className }: DashboardProps) {
  // Authentication state - 认证功能已删除
  // const [authState, setAuthState] = useState<AuthState>({
  //   user: null,
  //   session: null,
  //   loading: false,
  //   error: null
  // })
  // const { openModal } = useAuthModal() // 认证功能已删除

  const {
    cards,
    filter,
    setFilter,
    viewSettings,
    setViewSettings,
    dispatch: cardDispatch,
    flipCard,
    getAllTags,
    updateTagsInAllCards,
    getCardsWithTag
  } = useCardAllCards()
  
  const { 
    folderTree, 
    selectedFolderId, 
    setSelectedFolderId,
    dispatch: folderDispatch,
    getFolderById,
    folders
  } = useCardAllFolders()
  
  const { 
    tags, 
    popularTags, 
    renameTag, 
    deleteTagByName, 
    getAllTagNames 
  } = useCardAllTags()
  
  const { toast } = useToast()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [layoutSettings, setLayoutSettings] = useState({
    gap: 16,
    showLayoutControls: false
  })

  // 云端同步功能已删除，不再需要冲突解决系统

  // 认证功能已删除，不再监听认证状态变化

  // Folder management states
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false)
  const [showDeleteFolderDialog, setShowDeleteFolderDialog] = useState(false)
  const [editingFolder, setEditingFolder] = useState<{
    id: string
    name: string
    color: string
    icon: string
  } | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<{
    id: string
    name: string
    cardCount: number
    hasSubfolders: boolean
    subfolderCount: number
  } | null>(null)
  const [createFolderParentId, setCreateFolderParentId] = useState<string | undefined>()

  // Tag management states
  const [showRenameTagDialog, setShowRenameTagDialog] = useState(false)
  const [showDeleteTagDialog, setShowDeleteTagDialog] = useState(false)
  const [editingTagName, setEditingTagName] = useState('')
  const [deletingTagData, setDeletingTagData] = useState<{
    name: string
    cardCount: number
  } | null>(null)

  // 截图功能
  const {
    isCapturing,
    isDownloading,
    showPreview,
    previewData,
    captureScreenshot,
    confirmDownload,
    cancelPreview
  } = useScreenshot({
    onSuccess: (fileName) => {
      toast({
        title: "Screenshot saved!",
        description: `${fileName}.png has been downloaded successfully.`,
      })
    },
    onError: (error) => {
      toast({
        title: "Screenshot failed",
        description: error.message,
        variant: "destructive",
      })
    }
  })

  const handleCardFlip = (cardId: string) => {
    // 使用优化的flipCard函数替代直接dispatch
    if (flipCard) {
      flipCard(cardId)
    } else {
      // 降级到dispatch模式（向后兼容）
      cardDispatch({ type: 'FLIP_CARD', payload: cardId })
    }
  }

  const handleCardUpdate = (cardId: string, updates: any) => {
    cardDispatch({ 
      type: 'UPDATE_CARD', 
      payload: { id: cardId, updates } 
    })
  }

  const handleCardCopy = async (cardId: string) => {
    const card = cards.find((c: any) => c.id === cardId)
    if (card) {
      const content = card.isFlipped ? card.backContent : card.frontContent
      const textToCopy = formatCardContentForCopy(content.title, content.text)
      
      const success = await copyTextToClipboard(textToCopy)
      if (success) {
        console.log('Card content copied to clipboard')
      } else {
        console.error('Failed to copy card content')
      }
    }
  }

  const handleCardScreenshot = async (cardId: string) => {
    const card = cards.find((c: any) => c.id === cardId)
    if (!card) return

    // 查找卡片DOM元素
    const cardElement = document.querySelector(`[data-card-id="${cardId}"]`) as HTMLElement
    if (!cardElement) {
      toast({
        title: "Screenshot failed",
        description: "Could not find card element. Please try again.",
        variant: "destructive",
      })
      return
    }

    // 获取当前显示的内容标题
    const currentContent = card.isFlipped ? card.backContent : card.frontContent
    const cardTitle = currentContent.title || 'Untitled Card'

    // 执行截图
    await captureScreenshot(cardElement, cardTitle)
  }

  const handleCardShare = (cardId: string) => {
    // TODO: Implement share functionality
    console.log('Share card:', cardId)
  }

  const handleCardDelete = (cardId: string) => {
    cardDispatch({ type: 'DELETE_CARD', payload: cardId })
  }

  const handleCardMoveToFolder = (cardId: string, folderId: string | null) => {
    const card = cards.find((c: any) => c.id === cardId)
    if (!card) return

    const currentFolderId = card.folderId
    
    // Update card's folderId
    cardDispatch({
      type: 'UPDATE_CARD',
      payload: {
        id: cardId,
        updates: { folderId: folderId || undefined }
      }
    })

    // Update folder cardIds arrays
    if (currentFolderId) {
      // Remove from current folder
      const currentFolder = getFolderById(currentFolderId)
      if (currentFolder) {
        folderDispatch({
          type: 'UPDATE_FOLDER',
          payload: {
            id: currentFolderId,
            updates: {
              cardIds: currentFolder.cardIds.filter(id => id !== cardId)
            }
          }
        })
      }
    }

    if (folderId) {
      // Add to new folder
      const targetFolder = getFolderById(folderId)
      if (targetFolder) {
        folderDispatch({
          type: 'UPDATE_FOLDER',
          payload: {
            id: folderId,
            updates: {
              cardIds: [...targetFolder.cardIds, cardId]
            }
          }
        })
      }
    }

    // Show success message
    const targetFolderName = folderId ? getFolderById(folderId)?.name : 'Root'
    toast({
      title: "Card moved",
      description: `Card has been moved to "${targetFolderName}".`,
    })
  }

  const handleCreateCard = () => {
    const newCard = {
      frontContent: {
        title: '',
        text: 'Click to edit this card...',
        images: [],
        tags: [],
        lastModified: new Date()
      },
      backContent: {
        title: '',
        text: 'Add additional content here...',
        images: [],
        tags: [],
        lastModified: new Date()
      },
      style: {
        type: 'solid' as const,
        backgroundColor: '#ffffff',
        fontFamily: 'system-ui',
        fontSize: 'base' as const,
        fontWeight: 'normal' as const,
        textColor: '#1f2937',
        borderRadius: 'xl' as const,
        shadow: 'md' as const,
        borderWidth: 0
      },
      isFlipped: false,
      folderId: selectedFolderId || undefined
    }
    
    cardDispatch({ type: 'CREATE_CARD', payload: newCard })
  }

  const handleCreateFolder = () => {
    setCreateFolderParentId(undefined)
    setEditingFolder(null)
    setShowCreateFolderDialog(true)
  }

  const handleCreateSubfolder = (parentId: string) => {
    setCreateFolderParentId(parentId)
    setEditingFolder(null)
    setShowCreateFolderDialog(true)
  }

  const handleRenameFolder = (folderId: string) => {
    const folder = getFolderById(folderId)
    if (folder) {
      setEditingFolder({
        id: folderId,
        name: folder.name,
        color: folder.color,
        icon: folder.icon || 'Folder'
      })
      setCreateFolderParentId(undefined)
      setShowCreateFolderDialog(true)
    }
  }

  const handleDeleteFolder = (folderId: string) => {
    const folder = getFolderById(folderId)
    if (folder) {
      const subfolders = folders.filter((f: any) => f.parentId === folderId)
      setDeletingFolder({
        id: folderId,
        name: folder.name,
        cardCount: folder.cardIds.length,
        hasSubfolders: subfolders.length > 0,
        subfolderCount: subfolders.length
      })
      setShowDeleteFolderDialog(true)
    }
  }

  const handleConfirmCreateFolder = (folderData: {
    name: string
    color: string
    icon: string
    parentId?: string
  }) => {
    if (editingFolder) {
      // Update existing folder
      folderDispatch({
        type: 'UPDATE_FOLDER',
        payload: {
          id: editingFolder.id,
          updates: {
            name: folderData.name,
            color: folderData.color,
            icon: folderData.icon
          }
        }
      })
      toast({
        title: "Folder updated",
        description: `"${folderData.name}" has been updated successfully.`,
      })
    } else {
      // Create new folder
      folderDispatch({
        type: 'CREATE_FOLDER',
        payload: {
          name: folderData.name,
          color: folderData.color,
          icon: folderData.icon,
          cardIds: [],
          parentId: folderData.parentId,
          isExpanded: true
        }
      })
      toast({
        title: "Folder created",
        description: `"${folderData.name}" has been created successfully.`,
      })
    }
  }

  const handleConfirmDeleteFolder = () => {
    if (deletingFolder) {
      folderDispatch({
        type: 'DELETE_FOLDER',
        payload: deletingFolder.id,
        onDeleteCards: (cardIds: string[]) => {
          // Delete all cards in the folder
          cardIds.forEach(cardId => {
            cardDispatch({ type: 'DELETE_CARD', payload: cardId })
          })
        }
      })
      
      toast({
        title: "Folder deleted",
        description: `"${deletingFolder.name}" and ${deletingFolder.cardCount} cards have been deleted.`,
      })
      
      // If we're currently viewing the deleted folder, switch to all cards
      if (selectedFolderId === deletingFolder.id) {
        handleFolderSelect(null)
      }
    }
  }

  const handleTagFilter = (tagName: string) => {
    const isSelected = filter.tags.includes(tagName)
    setFilter({
      ...filter,
      tags: isSelected 
        ? filter.tags.filter(t => t !== tagName)
        : [...filter.tags, tagName]
    })
  }

  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId)
    setFilter({
      ...filter,
      folderId: folderId || undefined
    })
  }

  // Tag management handlers
  const handleRenameTag = (tagName: string) => {
    setEditingTagName(tagName)
    setShowRenameTagDialog(true)
  }

  const handleDeleteTag = (tagName: string) => {
    const cardsWithTag = getCardsWithTag(tagName)
    setDeletingTagData({
      name: tagName,
      cardCount: cardsWithTag.length
    })
    setShowDeleteTagDialog(true)
  }

  const handleConfirmRenameTag = (oldName: string, newName: string) => {
    const success = renameTag(oldName, newName)
    if (success) {
      // Update all cards with the new tag name
      updateTagsInAllCards(oldName, newName)
      
      toast({
        title: "Tag renamed",
        description: `"${oldName}" has been renamed to "${newName}".`,
      })

      // Close the dialog
      setShowRenameTagDialog(false)
      setEditingTagName('')
    } else {
      toast({
        title: "Rename failed",
        description: "A tag with this name already exists.",
        variant: "destructive",
      })
    }
  }

  const handleConfirmDeleteTag = () => {
    if (deletingTagData) {
      const success = deleteTagByName(deletingTagData.name)
      if (success) {
        // Remove tag from all cards
        updateTagsInAllCards(deletingTagData.name)
        
        // Remove from current filter if it's selected
        if (filter.tags.includes(deletingTagData.name)) {
          setFilter({
            ...filter,
            tags: filter.tags.filter(t => t !== deletingTagData.name)
          })
        }
        
        toast({
          title: "Tag deleted",
          description: `"${deletingTagData.name}" has been removed from ${deletingTagData.cardCount} cards.`,
        })

        // Close the dialog
        setShowDeleteTagDialog(false)
        setDeletingTagData(null)
      }
    }
  }

  const renderFolderTree = React.useCallback((folders: any[] = [], level = 0, visited = new Set()) => {
    // 防止无限递归
    if (level > 10) return null

    return folders.map(folder => {
      // 检查是否已经访问过这个文件夹（防止循环引用）
      if (visited.has(folder.id)) {
        console.warn('检测到循环引用的文件夹:', folder.id)
        return null
      }

      const hasChildren = folder.children && folder.children.length > 0
      const isExpanded = folder.isExpanded !== undefined ? folder.isExpanded : (hasChildren ? true : false)

      return (
        <div key={folder.id} className="space-y-1">
          <FolderContextMenu
            folderId={folder.id}
            folderName={folder.name}
            onRename={handleRenameFolder}
            onDelete={handleDeleteFolder}
            onCreateSubfolder={handleCreateSubfolder}
          >
            <Button
              variant={selectedFolderId === folder.id ? "secondary" : "ghost"}
              className="w-full justify-start text-sm mb-1"
              style={{ paddingLeft: `${level * 16 + 12}px` }}
              onClick={() => {
                // 如果有子文件夹，切换展开状态
                if (hasChildren) {
                  folderDispatch({
                    type: 'TOGGLE_FOLDER',
                    payload: folder.id
                  })
                }
                handleFolderSelect(folder.id)
              }}
            >
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                {/* 展开/折叠箭头图标 */}
                {hasChildren && (
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 flex-shrink-0 transition-transform duration-200",
                      !isExpanded && "-rotate-90"
                    )}
                  />
                )}

                {/* 文件夹图标 */}
                <Folder className="h-4 w-4 flex-shrink-0" style={{ color: folder.color }} />

                <span className="truncate">{folder.name}</span>
                {folder.cardIds && folder.cardIds.length > 0 && (
                  <Badge variant="secondary" className="text-xs ml-auto flex-shrink-0">
                    {folder.cardIds.length}
                  </Badge>
                )}
              </div>
            </Button>
          </FolderContextMenu>

          {/* 只有展开时才显示子文件夹 */}
          {hasChildren && isExpanded && (
            <div className="ml-2">
              {renderFolderTree(folder.children, level + 1, new Set(visited).add(folder.id))}
            </div>
          )}
        </div>
      )
    })
  }, [selectedFolderId, folderDispatch, handleFolderSelect, handleRenameFolder, handleDeleteFolder, handleCreateSubfolder])

  const renderCollapsedFolderTree = (folders: any[]) => {
    return folders.map(folder => (
      <div key={folder.id}>
        <FolderContextMenu
          folderId={folder.id}
          folderName={folder.name}
          onRename={handleRenameFolder}
          onDelete={handleDeleteFolder}
          onCreateSubfolder={handleCreateSubfolder}
        >
          <Button
            variant={selectedFolderId === folder.id ? "secondary" : "ghost"}
            className="w-full h-10 p-0 mb-1"
            onClick={() => handleFolderSelect(folder.id)}
            title={folder.name}
          >
            <Folder className="h-4 w-4" style={{ color: folder.color }} />
          </Button>
        </FolderContextMenu>
        {folder.children && folder.children.length > 0 && folder.isExpanded && (
          <div>
            {renderCollapsedFolderTree(folder.children)}
          </div>
        )}
      </div>
    ))
  }

  return (
    <FolderPanelProvider>
      <div className={cn("min-h-screen bg-background", className)}>
        {/* Top Navigation */}
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between px-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">CA</span>
              </div>
              <h1 className="text-xl font-bold">
                <span className="text-violet-600">Card</span>
                <span className="text-pink-500">All</span>
              </h1>
            </div>

            {/* Search - Centered */}
            <div className="absolute left-1/2 transform -translate-x-1/2 hidden md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search cards..."
                  value={filter.searchTerm}
                  onChange={(e) => setFilter({ ...filter, searchTerm: e.target.value })}
                  className="pl-10 rounded-full w-80"
                />
              </div>
            </div>
            
            {/* Search - Mobile (only when centered search is hidden) - Moved to right side */}
            <div className="md:hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={filter.searchTerm}
                  onChange={(e) => setFilter({ ...filter, searchTerm: e.target.value })}
                  className="pl-10 rounded-full w-48 mr-2"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Conflict Notification - 云端同步功能已删除，冲突通知已禁用 */}
              {/* Conflict notifications have been disabled as cloud sync functionality has been removed */}

              {/* Sync Status Indicator - 云端同步功能已删除，不再显示 */}
              {/* Sync status indicator has been removed as cloud sync functionality is disabled */}

  
              {/* Layout Controls Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Sliders className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Layout Settings</h4>
                      <p className="text-sm text-muted-foreground">
                        Customize the masonry layout appearance
                      </p>
                    </div>
                    
                    {/* Gap Size */}
                    <div className="space-y-2">
                      <Label>Gap Size: {layoutSettings.gap}px</Label>
                      <Slider
                        value={[layoutSettings.gap]}
                        onValueChange={([value]) => setLayoutSettings((prev: any) => ({ ...prev, gap: value }))}
                        max={32}
                        min={8}
                        step={4}
                        className="w-full"
                      />
                    </div>

                    {/* Card Size */}
                    <div className="space-y-2">
                      <Label>Card Size</Label>
                      <div className="flex gap-2">
                        {(['small', 'medium', 'large'] as const).map(size => (
                          <Button
                            key={size}
                            variant={viewSettings.cardSize === size ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setViewSettings((prev: any) => ({ ...prev, cardSize: size }))}
                          >
                            {size.charAt(0).toUpperCase() + size.slice(1)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Theme Toggle Button */}
              <ThemeToggle />

              {/* Add Card Button */}
              <Button
                onClick={handleCreateCard}
                variant="ghost"
                size="sm"
                className="text-black font-bold hover:bg-gray-100 rounded-full w-10 h-10 p-0 flex items-center justify-center"
              >
                <Plus className="h-6 w-6" />
                <span className="sr-only">Add Card</span>
              </Button>
              
            {/* Authentication Button - 认证功能已删除，不再显示 */}
              {/* Authentication functionality has been removed as cloud sync is disabled */}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex h-[calc(100vh-4rem)]">
          {/* Conflict Banner - 冲突功能已删除，不再显示 */}
          {/* Conflict banner has been removed as cloud sync functionality is disabled */}
          {/* Sidebar */}
          <aside 
            className={cn(
              "border-r transition-all duration-300 ease-in-out flex flex-col",
              sidebarCollapsed ? "w-16" : "w-72"
            )}
          >
            {/* Sidebar Header */}
            <div className="p-3 flex items-center justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="h-8 w-8 p-0"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 space-y-4">
                {/* Quick Actions */}
                {!sidebarCollapsed && (
                  <div>
                    <div className="space-y-2">
                      <Button 
                        className="w-full justify-start" 
                        onClick={handleCreateCard}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        New Card
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={handleCreateFolder}
                      >
                        <FolderPlus className="h-4 w-4 mr-2" />
                        New Folder
                      </Button>
                    </div>
                    <Separator className="my-4" />
                  </div>
                )}

                {/* Collapsed Quick Actions */}
                {sidebarCollapsed && (
                  <div className="space-y-2">
                    <Button 
                      variant="ghost"
                      size="sm"
                      className="w-full h-10 p-0"
                      onClick={handleCreateCard}
                      title="New Card"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost"
                      size="sm"
                      className="w-full h-10 p-0"
                      onClick={handleCreateFolder}
                      title="New Folder"
                    >
                      <FolderPlus className="h-4 w-4" />
                    </Button>
                    <Separator className="my-4" />
                  </div>
                )}

                {/* Folders */}
                <div>
                  {!sidebarCollapsed && (
                    <h3 className="text-sm font-medium mb-3">Folders</h3>
                  )}
                  <div className="space-y-1">
                    <Button 
                      variant={!selectedFolderId ? "secondary" : "ghost"}
                      className={cn(
                        "w-full text-sm",
                        sidebarCollapsed ? "h-10 p-0" : "justify-start"
                      )}
                      onClick={() => handleFolderSelect(null)}
                      title={sidebarCollapsed ? "All Cards" : undefined}
                    >
                      <Folder className="h-4 w-4" />
                      {!sidebarCollapsed && (
                        <>
                          <span className="ml-2">All Cards</span>
                          <Badge variant="secondary" className="ml-auto">
                            {cards.length}
                          </Badge>
                        </>
                      )}
                    </Button>
                    {sidebarCollapsed 
                      ? renderCollapsedFolderTree(folderTree)
                      : renderFolderTree(folderTree)
                    }
                  </div>
                </div>

                <Separator />

                {/* Tags */}
                <div>
                  {!sidebarCollapsed && (
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium">Tags</h3>
                      {filter.tags.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFilter({ ...filter, tags: [] })}
                          className="h-6 px-2 text-xs"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="space-y-1">
                    {popularTags(sidebarCollapsed ? 5 : 10).map((tag: any) => (
                      <TagContextMenu
                        key={tag.id}
                        tagName={tag.name}
                        onRename={handleRenameTag}
                        onDelete={handleDeleteTag}
                        disabled={sidebarCollapsed}
                      >
                        <Button 
                          variant={filter.tags.includes(tag.name) ? "secondary" : "ghost"}
                          className={cn(
                            "w-full text-sm",
                            sidebarCollapsed ? "h-10 p-0" : "justify-start"
                          )}
                          onClick={() => handleTagFilter(tag.name)}
                          title={sidebarCollapsed ? `${tag.name} (Right-click to expand sidebar for tag management)` : tag.name}
                        >
                          <Tag className="h-3 w-3" style={{ color: tag.color }} />
                          {!sidebarCollapsed && (
                            <>
                              <span className="ml-2">{tag.name}</span>
                              <Badge variant="secondary" className="ml-auto">
                                {tag.count}
                              </Badge>
                            </>
                          )}
                        </Button>
                      </TagContextMenu>
                    ))}
                  </div>
                </div>

                {/* Active Filters */}
                {!sidebarCollapsed && (filter.tags.length > 0 || filter.searchTerm) && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-medium mb-3">Active Filters</h3>
                      <div className="space-y-2">
                        {filter.searchTerm && (
                          <div className="flex items-center gap-2">
                            <Search className="h-3 w-3" />
                            <span className="text-xs text-muted-foreground">
                              "{filter.searchTerm}"
                            </span>
                          </div>
                        )}
                        {filter.tags.map((tagName: string) => (
                          <Badge 
                            key={tagName}
                            variant="secondary"
                            className="mr-1"
                          >
                            {tagName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </aside>

          {/* Masonry Card Grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <OptimizedMasonryGrid
                cards={cards}
                onCardFlip={handleCardFlip}
                onCardUpdate={handleCardUpdate}
                onCardCopy={handleCardCopy}
                onCardScreenshot={handleCardScreenshot}
                onCardShare={handleCardShare}
                onCardDelete={handleCardDelete}
                onMoveToFolder={handleCardMoveToFolder}
                cardSize={viewSettings.cardSize === 'small' ? 'sm' : viewSettings.cardSize === 'large' ? 'lg' : 'md'}
                enableVirtualization={cards.length > 20}
                gap={layoutSettings.gap}
                overscan={3}
              />
            </div>
          </div>
        </main>

        {/* Screenshot Preview Modal */}
        {/* Screenshot Preview Modal */}
        <ScreenshotPreviewModal
          isOpen={showPreview}
          onClose={cancelPreview}
          onConfirm={confirmDownload}
          previewUrl={previewData?.previewUrl || null}
          fileName={previewData?.fileName || ''}
          isDownloading={isDownloading}
        />

        {/* Folder Management Dialogs */}
        <CreateFolderDialog
          isOpen={showCreateFolderDialog}
          onClose={() => {
            setShowCreateFolderDialog(false)
            setEditingFolder(null)
            setCreateFolderParentId(undefined)
          }}
          onConfirm={handleConfirmCreateFolder}
          parentId={createFolderParentId}
          initialData={useMemo(() => editingFolder ? {
            name: editingFolder.name,
            color: editingFolder.color,
            icon: editingFolder.icon
          } : undefined, [editingFolder])}
          mode={editingFolder ? 'edit' : 'create'}
        />

        <DeleteFolderDialog
          isOpen={showDeleteFolderDialog}
          onClose={() => {
            setShowDeleteFolderDialog(false)
            setDeletingFolder(null)
          }}
          onConfirm={handleConfirmDeleteFolder}
          folderName={deletingFolder?.name || ''}
          cardCount={deletingFolder?.cardCount || 0}
          hasSubfolders={deletingFolder?.hasSubfolders || false}
          subfolderCount={deletingFolder?.subfolderCount || 0}
        />

        {/* Tag Management Dialogs */}
        <RenameTagDialog
          isOpen={showRenameTagDialog}
          onClose={() => {
            setShowRenameTagDialog(false)
            setEditingTagName('')
          }}
          onConfirm={handleConfirmRenameTag}
          tagName={editingTagName}
          existingTags={getAllTagNames()}
        />

        <DeleteTagDialog
          isOpen={showDeleteTagDialog}
          onClose={() => {
            setShowDeleteTagDialog(false)
            setDeletingTagData(null)
          }}
          onConfirm={handleConfirmDeleteTag}
          tagName={deletingTagData?.name || ''}
          cardCount={deletingTagData?.cardCount || 0}
        />

        {/* Tag Panel */}
        <ConnectedTagPanel />

        {/* Conflict Management Modals - 冲突功能已删除，不再显示 */}
        {/* Conflict management modals have been removed as cloud sync functionality is disabled */}
      </div>
    </FolderPanelProvider>
  )
}
