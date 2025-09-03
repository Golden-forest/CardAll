import React, { useCallback, useEffect, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import Blockquote from '@tiptap/extension-blockquote'
import Code from '@tiptap/extension-code'
import CodeBlock from '@tiptap/extension-code-block'
import Strike from '@tiptap/extension-strike'
import { Markdown } from 'tiptap-markdown-3'
import { Button } from '@/components/ui/button'
import { ImageIcon, Check, X, Smile } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmojiPicker } from './emoji-picker'
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [emojiQuery, setEmojiQuery] = useState('')
  const [emojiPosition, setEmojiPosition] = useState<{ x: number; y: number } | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 禁用默认的一些扩展，因为我们要单独配置
        strike: false,
        code: false,
        blockquote: false,
      }),
      // Markdown 支持
      Markdown.configure({
        html: true, // 允许HTML输出
        transformPastedText: true, // 自动转换粘贴的Markdown
        transformCopiedText: false, // 复制时保持HTML格式
      }),
      // 任务列表支持 (复选框)
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      // 链接支持
      Link.configure({
        openOnClick: false, // 在编辑模式下禁用自动打开，由我们手动处理
        HTMLAttributes: {
          class: 'text-blue-600 underline hover:text-blue-800 cursor-pointer',
          target: '_blank', // 新窗口打开
          rel: 'noopener noreferrer', // 安全性
        },
        protocols: ['http', 'https', 'ftp', 'mailto'], // 支持的协议
        validate: href => /^https?:\/\//.test(href), // 验证链接格式
      }),
      // 引用块
      Blockquote.configure({
        HTMLAttributes: {
          class: 'border-l-4 border-gray-300 pl-4 italic',
        },
      }),
      // 行内代码
      Code.configure({
        HTMLAttributes: {
          class: 'inline-code',
        },
      }),
      // 代码块
      CodeBlock.configure({
        HTMLAttributes: {
          class: 'code-block',
        },
      }),
      // 删除线
      Strike.configure({
        HTMLAttributes: {
          class: 'line-through',
        },
      }),
      // 图片
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-md max-w-full h-auto',
        },
      }),
      // 占位符
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
      handleKeyDown: (view, event) => {
        // 只有在行首或空白处按 "/" 才触发 emoji 选择器
        if (event.key === '/' && !showEmojiPicker) {
          const { selection } = view.state
          const { from } = selection
          const $pos = view.state.doc.resolve(from)
          
          // 检查光标前的文本，如果前面有非空白字符，则不触发emoji选择器
          const textBefore = $pos.parent.textBetween(0, $pos.parentOffset)
          const isAtStartOrAfterSpace = !textBefore.trim() || textBefore.endsWith(' ')
          
          if (isAtStartOrAfterSpace) {
            const coords = view.coordsAtPos(from)
            
            setEmojiPosition({
              x: coords.left,
              y: coords.bottom + 5
            })
            setShowEmojiPicker(true)
            setEmojiQuery('')
            
            // 阻止默认的 "/" 输入
            event.preventDefault()
            return true
          }
        }
        
        // 如果emoji选择器打开，处理查询输入
        if (showEmojiPicker) {
          if (event.key === 'Escape') {
            setShowEmojiPicker(false)
            setEmojiQuery('')
            return true
          }
          
          if (event.key === 'Backspace') {
            if (emojiQuery.length > 0) {
              setEmojiQuery(prev => prev.slice(0, -1))
            } else {
              setShowEmojiPicker(false)
            }
            return true
          }
          
          // 添加字符到查询
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && event.key !== ' ') {
            setEmojiQuery(prev => prev + event.key)
            return true
          }
          
          // 空格键选择第一个emoji或关闭选择器
          if (event.key === ' ') {
            setShowEmojiPicker(false)
            setEmojiQuery('')
            return true
          }
        }
        
        return false
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

  // Handle emoji selection
  const handleEmojiSelect = useCallback((emoji: string) => {
    if (editor) {
      editor.chain().focus().insertContent(emoji).run()
    }
    setShowEmojiPicker(false)
    setEmojiQuery('')
  }, [editor])

  // Handle emoji picker close
  const handleEmojiPickerClose = useCallback(() => {
    setShowEmojiPicker(false)
    setEmojiQuery('')
  }, [])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showEmojiPicker) {
          setShowEmojiPicker(false)
          setEmojiQuery('')
        } else {
          onCancel()
        }
      } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        onSave()
      }
    }

    const editorElement = editor.view.dom
    editorElement.addEventListener('keydown', handleKeyDown)
    
    return () => {
      editorElement.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, onSave, onCancel, showEmojiPicker])

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
    <div className={cn("relative z-20", className)} ref={editorRef}>
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
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Insert Emoji (Press / to open)"
          >
            <Smile className="h-3 w-3" />
          </Button>
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

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <EmojiPicker
          onEmojiSelect={handleEmojiSelect}
          onClose={handleEmojiPickerClose}
          query={emojiQuery}
          position={emojiPosition || undefined}
        />
      )}

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

      {/* Markdown Help Tooltip - 移到右上角，避免遮挡按钮 */}
      {editor && (
        <div className="absolute top-0 right-0 text-xs text-muted-foreground bg-white/90 px-2 py-1 rounded shadow-sm opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-10 max-w-xs">
          **bold** *italic* # heading - list {'>'} quote `code` ~~strike~~ [link](url) [] task / emoji
        </div>
      )}
    </div>
  )
}