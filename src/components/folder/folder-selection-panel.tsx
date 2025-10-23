// Folder selection panel for moving cards to folders

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from '@/components/ui/dialog'
import { 
  Folder, 
  FolderOpen, 
  Search, 
  Check,
  Home
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCardAllFolders } from '@/contexts/cardall-context'
import { Folder as FolderType } from '@/types/card'

interface FolderSelectionPanelProps {
  isOpen: boolean
  onClose: () => void
  currentCardId: string
  currentFolderId: string | null
  onFolderSelect: ((folderId: string | null) => void) | null
}

export function FolderSelectionPanel({
  isOpen,
  onClose,
  currentCardId,
  currentFolderId,
  onFolderSelect
}: FolderSelectionPanelProps) {
  const { folders, getFolderById } = useCardAllFolders()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId)

  // Reset selection when panel opens
  useEffect(() => {
    if (isOpen) {
      setSelectedFolderId(currentFolderId)
      setSearchQuery('')
    }
  }, [isOpen, currentFolderId])

  // Filter folders based on search query
  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Get current folder info
  const currentFolder = currentFolderId ? getFolderById(currentFolderId) : null

  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId)
  }

  const handleConfirm = () => {
    if (onFolderSelect) {
      onFolderSelect(selectedFolderId)
    }
    onClose()
  }

  const handleCancel = () => {
    setSelectedFolderId(currentFolderId)
    onClose()
  }

  // Check if selection has changed
  const hasChanged = selectedFolderId !== currentFolderId

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Move Card to Folder
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current folder info */}
          {currentFolder && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Currently in:</span>
              <Badge variant="secondary">{currentFolder.name}</Badge>
            </div>
          )}

          {!currentFolder && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Home className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Currently in: Root</span>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Folder list */}
          <ScrollArea className="h-64 w-full border rounded-md">
            <div className="p-2 space-y-1">
              {/* Root option */}
              <div
                className={cn(
                  "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                  selectedFolderId === null
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
                onClick={() => handleFolderSelect(null)}
              >
                <Home className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">Root</span>
                {selectedFolderId === null && (
                  <Check className="h-4 w-4 flex-shrink-0" />
                )}
                {currentFolderId === null && (
                  <Badge variant="outline" className="text-xs">Current</Badge>
                )}
              </div>

              {/* Folder options */}
              {filteredFolders.map((folder) => (
                <div
                  key={folder.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                    selectedFolderId === folder.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                    currentFolderId === folder.id && "opacity-60"
                  )}
                  onClick={() => handleFolderSelect(folder.id)}
                >
                  <Folder className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{folder.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {folder.cardIds.length}
                    </Badge>
                    {selectedFolderId === folder.id && (
                      <Check className="h-4 w-4 flex-shrink-0" />
                    )}
                    {currentFolderId === folder.id && (
                      <Badge variant="outline" className="text-xs">Current</Badge>
                    )}
                  </div>
                </div>
              ))}

              {filteredFolders.length === 0 && searchQuery && (
                <div className="text-center py-8 text-muted-foreground">
                  <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No folders found</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!hasChanged}
          >
            {hasChanged ? 'Move Card' : 'No Change'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}