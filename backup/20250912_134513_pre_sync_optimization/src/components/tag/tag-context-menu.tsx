import React from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Edit, Trash2 } from 'lucide-react'

interface TagContextMenuProps {
  children: React.ReactNode
  tagName: string
  onRename: (tagName: string) => void
  onDelete: (tagName: string) => void
  disabled?: boolean
}

export function TagContextMenu({
  children,
  tagName,
  onRename,
  onDelete,
  disabled = false
}: TagContextMenuProps) {
  const handleRename = () => {
    if (!disabled) {
      onRename(tagName)
    }
  }

  const handleDelete = () => {
    if (!disabled) {
      onDelete(tagName)
    }
  }

  if (disabled) {
    return <>{children}</>
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleRename} className="flex items-center gap-2">
          <Edit className="h-4 w-4" />
          Rename Tag
        </ContextMenuItem>
        <ContextMenuItem 
          onClick={handleDelete} 
          className="flex items-center gap-2 text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Delete Tag
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}