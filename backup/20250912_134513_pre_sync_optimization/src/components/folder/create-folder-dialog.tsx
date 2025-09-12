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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  Folder,
  Code,
  Palette,
  BookOpen,
  Star,
  Heart,
  Zap,
  Target,
  Lightbulb,
  Coffee
} from 'lucide-react'

const FOLDER_COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#ef4444', label: 'Red' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#84cc16', label: 'Lime' },
  { value: '#f97316', label: 'Orange' },
]

const FOLDER_ICONS = [
  { value: 'Folder', label: 'Folder', icon: Folder },
  { value: 'Code', label: 'Code', icon: Code },
  { value: 'Palette', label: 'Design', icon: Palette },
  { value: 'BookOpen', label: 'Learning', icon: BookOpen },
  { value: 'Star', label: 'Favorites', icon: Star },
  { value: 'Heart', label: 'Personal', icon: Heart },
  { value: 'Zap', label: 'Quick', icon: Zap },
  { value: 'Target', label: 'Goals', icon: Target },
  { value: 'Lightbulb', label: 'Ideas', icon: Lightbulb },
  { value: 'Coffee', label: 'Work', icon: Coffee },
]

interface CreateFolderDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (folderData: {
    name: string
    color: string
    icon: string
    parentId?: string
  }) => void
  parentId?: string
  initialData?: {
    name: string
    color: string
    icon: string
  }
  mode?: 'create' | 'edit'
}

export function CreateFolderDialog({
  isOpen,
  onClose,
  onConfirm,
  parentId,
  initialData,
  mode = 'create'
}: CreateFolderDialogProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const [icon, setIcon] = useState('Folder')

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name)
        setColor(initialData.color)
        setIcon(initialData.icon)
      } else {
        setName('')
        setColor('#3b82f6')
        setIcon('Folder')
      }
    }
  }, [isOpen]) // 只在对话框打开时初始化，移除 initialData 依赖

  // 单独处理 initialData 变化，但只在对话框打开时生效
  useEffect(() => {
    if (isOpen && initialData) {
      setName(initialData.name)
      setColor(initialData.color)
      setIcon(initialData.icon)
    }
  }, [initialData, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onConfirm({
        name: name.trim(),
        color,
        icon,
        parentId
      })
      onClose()
    }
  }

  const selectedIconComponent = FOLDER_ICONS.find(i => i.value === icon)?.icon || Folder

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create New Folder' : 'Edit Folder'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Create a new folder to organize your cards.'
              : 'Update folder details.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter folder name..."
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map((colorOption) => (
                <button
                  key={colorOption.value}
                  type="button"
                  onClick={() => setColor(colorOption.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === colorOption.value 
                      ? 'border-foreground scale-110' 
                      : 'border-muted hover:scale-105'
                  }`}
                  style={{ backgroundColor: colorOption.value }}
                  title={colorOption.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <Select value={icon} onValueChange={setIcon}>
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {React.createElement(selectedIconComponent, { 
                      className: "h-4 w-4",
                      style: { color }
                    })}
                    {FOLDER_ICONS.find(i => i.value === icon)?.label}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FOLDER_ICONS.map((iconOption) => {
                  const IconComponent = iconOption.icon
                  return (
                    <SelectItem key={iconOption.value} value={iconOption.value}>
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4" />
                        {iconOption.label}
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {parentId && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                Subfolder
              </Badge>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {mode === 'create' ? 'Create Folder' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}