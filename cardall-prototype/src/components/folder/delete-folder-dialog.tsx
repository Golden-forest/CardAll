import React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'

interface DeleteFolderDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  folderName: string
  cardCount: number
  hasSubfolders?: boolean
  subfolderCount?: number
}

export function DeleteFolderDialog({
  isOpen,
  onClose,
  onConfirm,
  folderName,
  cardCount,
  hasSubfolders = false,
  subfolderCount = 0
}: DeleteFolderDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3">
            <p>
              Are you sure you want to delete the folder <strong>"{folderName}"</strong>?
            </p>
            
            <div className="bg-destructive/10 p-3 rounded-lg space-y-2">
              <p className="text-sm font-medium text-destructive">
                This action will permanently delete:
              </p>
              <div className="flex flex-wrap gap-2">
                {cardCount > 0 && (
                  <Badge variant="destructive">
                    {cardCount} card{cardCount !== 1 ? 's' : ''}
                  </Badge>
                )}
                {hasSubfolders && subfolderCount > 0 && (
                  <Badge variant="destructive">
                    {subfolderCount} subfolder{subfolderCount !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              This action cannot be undone.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete Forever
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}