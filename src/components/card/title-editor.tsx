import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TitleEditorProps {
  content: string
  onUpdate: (content: string) => void
  onSave: () => void
  onCancel: () => void
  className?: string
  autoFocus?: boolean
}

export function TitleEditor({
  content,
  onUpdate,
  onSave,
  onCancel,
  className,
  autoFocus = false
}: TitleEditorProps) {
  const [value, setValue] = useState(content)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(content)
  }, [content])

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [autoFocus])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    onUpdate(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="w-full bg-transparent border-none outline-none text-lg font-semibold resize-none pr-16"
        placeholder="Card title..."
      />
      
      {/* Action Buttons */}
      <div className="absolute right-0 top-0 flex gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="h-6 w-6 p-0 bg-white/80 hover:bg-white shadow-sm"
        >
          <X className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          className="h-6 w-6 p-0 bg-white/80 hover:bg-white shadow-sm"
        >
          <Check className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}