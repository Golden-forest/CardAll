import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle } from 'lucide-react'

interface RenameTagDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (oldName: string, newName: string) => void
  tagName: string
  existingTags: string[]
}

export function RenameTagDialog({
  isOpen,
  onClose,
  onConfirm,
  tagName,
  existingTags
}: RenameTagDialogProps) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setNewName(tagName)
      setError('')
    }
  }, [isOpen, tagName])

  const validateName = (name: string) => {
    const trimmedName = name.trim()
    
    if (!trimmedName) {
      return 'Tag name cannot be empty'
    }
    
    if (trimmedName === tagName) {
      return 'Please enter a different name'
    }
    
    if (existingTags.includes(trimmedName)) {
      return 'A tag with this name already exists'
    }
    
    if (trimmedName.length > 50) {
      return 'Tag name must be less than 50 characters'
    }
    
    return ''
  }

  const handleConfirm = () => {
    const trimmedName = newName.trim()
    const validationError = validateName(trimmedName)
    
    if (validationError) {
      setError(validationError)
      return
    }
    
    onConfirm(tagName, trimmedName)
    onClose()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename Tag</DialogTitle>
          <DialogDescription>
            Enter a new name for the tag "{tagName}". This will update all cards using this tag.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">Tag Name</Label>
            <Input
              id="tag-name"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                if (error) setError('')
              }}
              onKeyPress={handleKeyPress}
              placeholder="Enter tag name..."
              autoFocus
            />
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!!error || !newName.trim()}>
            Rename Tag
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}