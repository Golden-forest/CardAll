import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface DeleteTagDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  tagName: string
  cardCount: number
}

export function DeleteTagDialog({
  isOpen,
  onClose,
  onConfirm,
  tagName,
  cardCount
}: DeleteTagDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Tag
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the tag "{tagName}"?
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20">
            <p className="text-sm text-destructive font-medium mb-2">
              This action cannot be undone.
            </p>
            <p className="text-sm text-muted-foreground">
              This tag will be removed from <strong>{cardCount}</strong> {cardCount === 1 ? 'card' : 'cards'}.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete Tag
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}