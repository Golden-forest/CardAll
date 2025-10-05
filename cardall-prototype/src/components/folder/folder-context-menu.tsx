import React from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { 
  Edit, 
  Trash2, 
  FolderPlus,
  Folder
} from 'lucide-react'

interface FolderContextMenuProps {
  children: React.ReactNode
  folderId: string
  folderName: string
  onRename: (folderId: string) => void
  onDelete: (folderId: string) => void
  onCreateSubfolder: (parentId: string) => void
  disabled?: boolean
}

export function FolderContextMenu({
  children,
  folderId,
  folderName,
  onRename,
  onDelete,
  onCreateSubfolder,
  disabled = false
}: FolderContextMenuProps) {
  if (disabled) {
    return <>{children}</>
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => onRename(folderId)}>
          <Edit className="h-4 w-4 mr-2" />
          Rename Folder
        </ContextMenuItem>
        
        <ContextMenuItem onClick={() => onCreateSubfolder(folderId)}>
          <FolderPlus className="h-4 w-4 mr-2" />
          New Subfolder
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem 
          onClick={() => onDelete(folderId)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}