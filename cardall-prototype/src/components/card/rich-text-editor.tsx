import React, { useCallback, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from '@/components/ui/button'
import { ImageIcon, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import './editor-styles.css'

interface RichTextEditorProps {
  content: string
  placeholder?: string
  onUpdate: (content: string) => void
  onSave: () => void
  onCancel: () => void
  className?: string
  autoFocus?: boolean
}

export function RichTextEditor({
  content,
  placeholder = "Start typing...",
  onUpdate,
  onSave,
  onCancel,
  className,
  autoFocus = false
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-md max-w-full h-auto',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor text-sm leading-relaxed focus:outline-none min-h-[100px] w-full',
      },
    },
  })

  // Handle image upload
  const handleImageUpload = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file && editor) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const base64 = e.target?.result as string
          editor.chain().focus().setImage({ src: base64 }).run()
        }
        reader.readAsDataURL(file)
      }
    }
    input.click()
  }, [editor])

  // Handle paste images
  useEffect(() => {
    if (!editor) return

    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.indexOf('image') !== -1) {
          event.preventDefault()
          const file = item.getAsFile()
          if (file) {
            const reader = new FileReader()
            reader.onload = (e) => {
              const base64 = e.target?.result as string
              editor.chain().focus().setImage({ src: base64 }).run()
            }
            reader.readAsDataURL(file)
          }
        }
      }
    }

    const editorElement = editor.view.dom
    editorElement.addEventListener('paste', handlePaste)
    
    return () => {
      editorElement.removeEventListener('paste', handlePaste)
    }
  }, [editor])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        onSave()
      }
    }

    const editorElement = editor.view.dom
    editorElement.addEventListener('keydown', handleKeyDown)
    
    return () => {
      editorElement.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, onSave, onCancel])

  // Auto focus
  useEffect(() => {
    if (editor && autoFocus) {
      editor.commands.focus()
    }
  }, [editor, autoFocus])

  if (!editor) {
    return null
  }

  return (
    <div className={cn("relative", className)}>
      {/* Editor Content */}
      <div className="relative p-2 -m-2">
        <EditorContent 
          editor={editor} 
          className="min-h-[100px]"
        />
        
        {/* Floating Toolbar */}
        <div className="absolute top-0 right-0 flex gap-1 opacity-60 hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 bg-white/90 hover:bg-white shadow-sm rounded"
            onClick={handleImageUpload}
            title="Insert Image"
          >
            <ImageIcon className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-border/30">
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="h-7 px-3 text-xs"
        >
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          className="h-7 px-3 text-xs"
        >
          <Check className="h-3 w-3 mr-1" />
          Accept
        </Button>
      </div>
    </div>
  )
}