import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Folder, 
  FolderPlus, 
  ChevronLeft, 
  ChevronRight,
  MoreHorizontal
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { 
  FolderContextMenu, 
  CreateFolderDialog, 
  DeleteFolderDialog 
} from '@/components/folder'

interface FolderOperationsProps {
  folderTree: any[]
  selectedFolderId: string | null
  setSelectedFolderId: (id: string | null) => void
  dispatch: (action: any) => Promise<void>
  getFolderById: (id: string) => any
  folders: any[]
  allFolders: any[]
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
}

export function FolderOperations({
  folderTree,
  selectedFolderId,
  setSelectedFolderId,
  dispatch,
  getFolderById,
  folders,
  allFolders,
  sidebarCollapsed,
  setSidebarCollapsed
}: FolderOperationsProps) {
  const { toast } = useToast()
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false)
  const [contextMenuFolder, setContextMenuFolder] = useState<any>(null)
  const [deleteFolder, setDeleteFolder] = useState<any>(null)

  // 创建文件夹
  const handleCreateFolder = async (name: string, parentId?: string) => {
    try {
      await dispatch({
        type: 'CREATE_FOLDER',
        payload: {
          name,
          parentId,
          color: '#3b82f6'
        }
      })
      
      toast({
        title: "文件夹创建成功",
        description: `文件夹 "${name}" 已创建`
      })
    } catch (error) {
      console.error('Failed to create folder:', error)
      toast({
        title: "创建失败",
        description: "无法创建文件夹",
        variant: "destructive"
      })
    }
  }

  // 删除文件夹
  const handleDeleteFolder = async (folderId: string) => {
    try {
      const folder = getFolderById(folderId)
      if (!folder) return

      await dispatch({
        type: 'DELETE_FOLDER',
        payload: folderId
      })
      
      toast({
        title: "文件夹删除成功",
        description: `文件夹 "${folder.name}" 已删除`
      })
    } catch (error) {
      console.error('Failed to delete folder:', error)
      toast({
        title: "删除失败",
        description: "无法删除文件夹",
        variant: "destructive"
      })
    }
  }

  // 重命名文件夹
  const handleRenameFolder = async (folderId: string, newName: string) => {
    try {
      await dispatch({
        type: 'UPDATE_FOLDER',
        payload: {
          id: folderId,
          updates: { name: newName }
        }
      })
      
      toast({
        title: "重命名成功",
        description: `文件夹已重命名为 "${newName}"`
      })
    } catch (error) {
      console.error('Failed to rename folder:', error)
      toast({
        title: "重命名失败",
        description: "无法重命名文件夹",
        variant: "destructive"
      })
    }
  }

  // 渲染文件夹树
  const renderFolderTree = (folders: any[], level = 0) => {
    return folders.map(folder => (
      <div key={folder.id} className="space-y-1">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
            "hover:bg-gray-100 group",
            selectedFolderId === folder.id && "bg-blue-50 text-blue-700"
          )}
          onClick={() => setSelectedFolderId(folder.id)}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenuFolder(folder)
          }}
        >
          <div style={{ paddingLeft: `${level * 16}px` }} className="flex items-center gap-2 flex-1">
            <Folder className="h-4 w-4" style={{ color: folder.color }} />
            <span className="text-sm font-medium truncate flex-1">
              {folder.name}
            </span>
            <Badge variant="secondary" className="text-xs">
              {folder.cardCount || 0}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation()
                setContextMenuFolder(folder)
              }}
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {folder.children && folder.children.length > 0 && (
          <div className="ml-4">
            {renderFolderTree(folder.children, level + 1)}
          </div>
        )}
      </div>
    ))
  }

  return (
    <div className="space-y-4">
      {/* 文件夹操作栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          
          {!sidebarCollapsed && (
            <h2 className="text-lg font-semibold">文件夹</h2>
          )}
        </div>
        
        {!sidebarCollapsed && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCreateFolderDialog(true)}
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            新建文件夹
          </Button>
        )}
      </div>

      {/* 文件夹列表 */}
      {!sidebarCollapsed && (
        <div className="space-y-2">
          {/* 所有卡片 */}
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
              "hover:bg-gray-100",
              selectedFolderId === null && "bg-blue-50 text-blue-700"
            )}
            onClick={() => setSelectedFolderId(null)}
          >
            <Folder className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium flex-1">所有卡片</span>
            <Badge variant="secondary" className="text-xs">
              {allFolders.reduce((sum, f) => sum + (f.cardCount || 0), 0)}
            </Badge>
          </div>

          <Separator />

          {/* 文件夹树 */}
          <div className="max-h-96 overflow-y-auto">
            {renderFolderTree(folderTree)}
          </div>
        </div>
      )}

      {/* 文件夹上下文菜单 */}
      {contextMenuFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-white border rounded-lg shadow-lg p-2 w-48">
            <div 
              className="px-2 py-1 hover:bg-gray-100 cursor-pointer rounded flex items-center"
              onClick={() => {
                const newName = prompt('Enter new folder name:', contextMenuFolder.name)
                if (newName && newName.trim()) {
                  handleRenameFolder(contextMenuFolder.id, newName.trim())
                }
                setContextMenuFolder(null)
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Rename
            </div>
            <div 
              className="px-2 py-1 hover:bg-gray-100 cursor-pointer rounded flex items-center"
              onClick={() => {
                const name = prompt('Enter subfolder name:')
                if (name && name.trim()) {
                  handleCreateFolder(name.trim(), contextMenuFolder.id)
                }
                setContextMenuFolder(null)
              }}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              New Subfolder
            </div>
            <div 
              className="px-2 py-1 hover:bg-gray-100 cursor-pointer rounded flex items-center text-red-600"
              onClick={() => {
                setDeleteFolder(contextMenuFolder)
                setContextMenuFolder(null)
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </div>
          </div>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setContextMenuFolder(null)}
          />
        </div>
      )}

      {/* 创建文件夹对话框 */}
      <CreateFolderDialog
        isOpen={showCreateFolderDialog}
        onClose={() => setShowCreateFolderDialog(false)}
        onConfirm={(folderData) => {
          handleCreateFolder(folderData.name, folderData.parentId)
          setShowCreateFolderDialog(false)
        }}
        parentId={selectedFolderId}
      />

      {/* 删除文件夹对话框 */}
      {deleteFolder && (
        <DeleteFolderDialog
          isOpen={!!deleteFolder}
          onClose={() => setDeleteFolder(null)}
          onConfirm={() => handleDeleteFolder(deleteFolder.id)}
          folderName={deleteFolder.name}
          cardCount={deleteFolder.cardIds?.length || 0}
          hasSubfolders={deleteFolder.subfolderIds?.length > 0}
          subfolderCount={deleteFolder.subfolderIds?.length || 0}
        />
      )}
    </div>
  )
}