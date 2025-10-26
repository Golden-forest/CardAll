import React, { useState, useMemo, useCallback } from 'react'
import { useCardAllFolders, useCardAllTags } from '@/contexts/cardall-context'
import { useCardAllCards } from '@/contexts/cardall-context'
import { useStorageAdapter } from '@/hooks/use-cards-adapter'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import {
  Folder,
  Tag,
  FolderPlus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Sliders
} from 'lucide-react'
import { cn } from '@/lib/utils'
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

interface DashboardSidebarProps {
  collapsed: boolean
  onToggle: () => void
  className?: string
}

export function DashboardSidebar({ collapsed, onToggle, className }: DashboardSidebarProps) {
  const { 
    folderTree, 
    selectedFolderId, 
    setSelectedFolderId,
    dispatch: folderDispatch,
    getFolderById,
    folders,
    isLoading: foldersLoading
  } = useCardAllFolders()
  
  const { 
    tags, 
    popularTags, 
    renameTag, 
    deleteTagByName, 
    getAllTagNames 
  } = useCardAllTags()

  const {
    filter,
    setFilter,
    viewSettings,
    setViewSettings
  } = useCardAllCards()

  // Storage adapter for migration status
  const {
    isReady,
    isUsingLocalStorage,
    isUsingIndexedDB
  } = useStorageAdapter()

  // 文件夹状态
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false)
  const [showDeleteFolderDialog, setShowDeleteFolderDialog] = useState(false)
  const [editingFolder, setEditingFolder] = useState<{ id: string; name: string } | null>(null)
  const [contextMenuFolder, setContextMenuFolder] = useState<{ id: string; name: string } | null>(null)

  // 标签状态
  const [contextMenuTag, setContextMenuTag] = useState<{ name: string; color: string } | null>(null)
  const [showRenameTagDialog, setShowRenameTagDialog] = useState(false)
  const [showDeleteTagDialog, setShowDeleteTagDialog] = useState(false)
  const [editingTagName, setEditingTagName] = useState('')

  // 布局设置
  const [showLayoutControls, setShowLayoutControls] = useState(false)

  // 优化的文件夹渲染函数
  const renderFolderTree = useCallback((folders: any[] = [], level = 0) => {
    if (collapsed && level > 0) return null

    return folders.map((folder) => {
      const hasChildren = folder.children && folder.children.length > 0
      const isExpanded = folder.isExpanded !== undefined ? folder.isExpanded : (hasChildren ? true : false)

      return (
        <div key={folder.id} className="space-y-1">
          <div
            className={cn(
              "flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer group",
              selectedFolderId === folder.id && "bg-accent text-accent-foreground"
            )}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => {
              // 如果有子文件夹，切换展开状态
              if (hasChildren) {
                folderDispatch({
                  type: 'TOGGLE_FOLDER',
                  payload: folder.id
                })
              }
              setSelectedFolderId(folder.id)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              setContextMenuFolder({ id: folder.id, name: folder.name })
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
              <Folder className="h-4 w-4 flex-shrink-0" />

              <span className="truncate text-sm">{folder.name}</span>
              {folder.cardIds && folder.cardIds.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-auto flex-shrink-0">
                  {folder.cardIds.length}
                </Badge>
              )}
            </div>
          </div>

          {/* 只有展开时才显示子文件夹 */}
          {hasChildren && isExpanded && (
            <div className="ml-2">
              {renderFolderTree(folder.children, level + 1)}
            </div>
          )}
        </div>
      )
    })
  }, [collapsed, selectedFolderId, setSelectedFolderId, folderDispatch, isReady])

  // 优化的折叠文件夹渲染
  const renderCollapsedFolderTree = useCallback((folders: any[] = []) => {
    return folders.map((folder) => (
      <div key={folder.id}>
        <div
          className={cn(
            "flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer",
            selectedFolderId === folder.id && "bg-accent text-accent-foreground"
          )}
          onClick={() => setSelectedFolderId(folder.id)}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenuFolder({ id: folder.id, name: folder.name })
          }}
        >
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <Folder className="h-4 w-4 flex-shrink-0" />
            <span className="truncate text-sm">{folder.name}</span>
            {folder.cardIds && folder.cardIds.length > 0 && (
              <Badge variant="secondary" className="text-xs ml-auto flex-shrink-0">
                {folder.cardIds.length}
              </Badge>
            )}
          </div>
        </div>

        {folder.children && folder.children.length > 0 && (
          <div className="ml-4 border-l border-border pl-2">
            {renderCollapsedFolderTree(folder.children)}
          </div>
        )}
      </div>
    ))
  }, [selectedFolderId, setSelectedFolderId, isReady])

  // 计算文件夹统计
  const folderStats = useMemo(() => {
    const totalFolders = folders.length
    const selectedFolder = selectedFolderId ? getFolderById(selectedFolderId) : null
    const selectedFolderCards = selectedFolder?.cardIds?.length || 0
    
    return {
      totalFolders,
      selectedFolderCards
    }
  }, [folders, selectedFolderId, getFolderById])

  // 处理文件夹操作
  const handleCreateFolder = () => {
    setShowCreateFolderDialog(true)
  }

  const handleEditFolder = (folder: { id: string; name: string }) => {
    setEditingFolder(folder)
  }

  const handleDeleteFolder = (folder: { id: string; name: string }) => {
    setContextMenuFolder(folder)
    setShowDeleteFolderDialog(true)
  }

  // 处理标签操作
  const handleTagContextMenu = (tag: { name: string; color: string }) => {
    setContextMenuTag(tag)
    setEditingTagName(tag.name)
  }

  const handleRenameTag = () => {
    if (contextMenuTag && editingTagName && editingTagName !== contextMenuTag.name) {
      renameTag(contextMenuTag.name, editingTagName)
    }
    setShowRenameTagDialog(false)
    setContextMenuTag(null)
  }

  const handleDeleteTag = () => {
    if (contextMenuTag) {
      deleteTagByName(contextMenuTag.name)
    }
    setShowDeleteTagDialog(false)
    setContextMenuTag(null)
  }

  // 清除标签筛选
  const handleClearTagFilter = () => {
    setFilter({ ...filter, tag: '' })
  }

  if (collapsed) {
    return (
      <div className={cn("w-14 md:w-14 border-r bg-background", className)}>
        <div className="flex flex-col h-full">
          {/* 切换按钮 */}
          <div className="p-2 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="w-full justify-center"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* 快速操作 */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCreateFolder}
              className="w-full justify-center"
              title="新建文件夹"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("w-40 md:w-64 border-r bg-background", className)}>
      <div className="flex flex-col h-full">
        {/* 头部 */}
        <div className="p-4 md:p-4 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold truncate">侧边栏</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            {folderStats.totalFolders} 文件夹
          </div>

          {/* 存储模式指示器 */}
          {isReady && (
            <div className="text-xs text-muted-foreground hidden md:block">
              {isUsingIndexedDB ? 'IndexedDB' : 'localStorage'}
            </div>
          )}
        </div>

        {/* 文件夹区域 */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium truncate">文件夹</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCreateFolder}
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto">
              {renderFolderTree(folderTree)}
            </div>
          </div>

          <Separator />

          {/* 标签区域 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium truncate">标签</h3>
              <ConnectedTagPanel />
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {popularTags.slice(0, 10).map((tag) => (
                <div
                  key={tag.name}
                  className={cn(
                    "flex items-center justify-between px-2 py-1 rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer group",
                    filter.tag === tag.name && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => setFilter({ ...filter, tag: tag.name })}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    handleTagContextMenu(tag)
                  }}
                >
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="truncate text-sm">{tag.name}</span>
                    <Badge variant="outline" className="text-xs ml-auto flex-shrink-0 hidden md:block">
                      {tag.count}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {filter.tag && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground truncate">
                  当前筛选: {filter.tag}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearTagFilter}
                >
                  清除
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 布局设置 - 移动端隐藏 */}
        <div className="hidden md:block p-4 border-t space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">布局设置</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLayoutControls(!showLayoutControls)}
            >
              <Sliders className="h-4 w-4" />
            </Button>
          </div>

          {showLayoutControls && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">间距</Label>
                <Slider
                  value={[viewSettings.gap || 16]}
                  onValueChange={([value]) =>
                    setViewSettings({ ...viewSettings, gap: value })
                  }
                  min={8}
                  max={32}
                  step={4}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground text-center">
                  {viewSettings.gap || 16}px
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 文件夹对话框 */}
      <CreateFolderDialog
        open={showCreateFolderDialog}
        onOpenChange={setShowCreateFolderDialog}
      />
      
      <DeleteFolderDialog
        open={showDeleteFolderDialog}
        onOpenChange={setShowDeleteFolderDialog}
        folder={contextMenuFolder}
      />

      {/* 标签对话框 */}
      <RenameTagDialog
        open={showRenameTagDialog}
        onOpenChange={setShowRenameTagDialog}
        tagName={editingTagName}
        onTagNameChange={setEditingTagName}
        onConfirm={handleRenameTag}
      />
      
      <DeleteTagDialog
        open={showDeleteTagDialog}
        onOpenChange={setShowDeleteTagDialog}
        tagName={contextMenuTag?.name || ''}
        onConfirm={handleDeleteTag}
      />

      {/* 右键菜单 */}
      <FolderContextMenu
        folder={contextMenuFolder}
        onEdit={handleEditFolder}
        onDelete={handleDeleteFolder}
        onClose={() => setContextMenuFolder(null)}
      />
      
      <TagContextMenu
        tag={contextMenuTag}
        onRename={() => setShowRenameTagDialog(true)}
        onDelete={() => setShowDeleteTagDialog(true)}
        onClose={() => setContextMenuTag(null)}
      />
    </div>
  )
}