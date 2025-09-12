import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  Code, 
  List, 
  ListOrdered, 
  Quote, 
  Image as ImageIcon,
  Upload,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { imageProcessor } from '@/services/image-processor'
import { db } from '@/services/database-simple'
import './editor-styles.css'

interface RichTextEditorV2Props {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  cardId: string
  folderId?: string
  className?: string
  readOnly?: boolean
}

export function RichTextEditorV2({
  content,
  onChange,
  placeholder = '开始输入...',
  cardId,
  folderId,
  className,
  readOnly = false
}: RichTextEditorV2Props) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: false, // 禁用base64，强制使用文件URL
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // 处理图片上传
  const handleImageUpload = useCallback(async (files: File[]) => {
    if (!editor || files.length === 0) return

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const imageFiles = files.filter(file => file.type.startsWith('image/'))
      
      if (imageFiles.length === 0) {
        throw new Error('请选择有效的图片文件')
      }

      // 批量处理图片
      const results = await imageProcessor.processImages(imageFiles, cardId, folderId)
      
      // 插入图片到编辑器
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        setUploadProgress(((i + 1) / results.length) * 100)
        
        // 获取图片URL
        const imageUrl = await imageProcessor.getImageUrl(result.filePaths.webp)
        
        // 插入到编辑器
        editor.chain().focus().setImage({ 
          src: imageUrl,
          alt: result.metadata.originalName,
          title: result.metadata.originalName
        }).run()

        // 保存图片信息到数据库
        await db.images?.add({
          id: result.id,
          cardId,
          fileName: result.metadata.originalName,
          filePath: result.filePaths.webp,
          metadata: {
            originalName: result.metadata.originalName,
            size: result.metadata.processedSize,
            width: result.metadata.width,
            height: result.metadata.height,
            format: result.metadata.format,
            compressed: true
          },
          createdAt: new Date(),
          syncVersion: 1,
          pendingSync: true
        })
      }

      console.log(`Successfully uploaded ${results.length} images`)
    } catch (error) {
      console.error('Image upload failed:', error)
      // 这里可以添加错误提示
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [editor, cardId, folderId])

  // 处理文件选择
  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // 处理文件输入变化
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      handleImageUpload(files)
    }
    // 清空input值，允许重复选择同一文件
    e.target.value = ''
  }, [handleImageUpload])

  // 处理拖拽上传
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleImageUpload(files)
    }
  }, [handleImageUpload])

  // 处理粘贴上传
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // 检查是否有剪贴板数据
      if (!e.clipboardData) return

      const items = Array.from(e.clipboardData.items || [])
      const imageItems = items.filter(item => item.type.startsWith('image/'))
      
      if (imageItems.length > 0) {
        e.preventDefault()
        console.log('Pasting images:', imageItems.length)
        const files = imageItems.map(item => item.getAsFile()).filter(Boolean) as File[]
        if (files.length > 0) {
          handleImageUpload(files)
        }
      }
    }

    // 绑定到编辑器容器而不是document
    const editorElement = document.querySelector('.ProseMirror')
    if (editorElement) {
      editorElement.addEventListener('paste', handlePaste as EventListener)
      return () => editorElement.removeEventListener('paste', handlePaste as EventListener)
    } else {
      // 降级到document级别
      document.addEventListener('paste', handlePaste)
      return () => document.removeEventListener('paste', handlePaste)
    }
  }, [editor, handleImageUpload])

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {/* 工具栏 */}
      {!readOnly && (
        <div className="border-b bg-muted/50 p-2">
          <div className="flex items-center gap-1 flex-wrap">
            {/* 文本格式化按钮 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={cn(
                'h-8 w-8 p-0',
                editor.isActive('bold') && 'bg-muted'
              )}
            >
              <Bold className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={cn(
                'h-8 w-8 p-0',
                editor.isActive('italic') && 'bg-muted'
              )}
            >
              <Italic className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={cn(
                'h-8 w-8 p-0',
                editor.isActive('strike') && 'bg-muted'
              )}
            >
              <Strikethrough className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={cn(
                'h-8 w-8 p-0',
                editor.isActive('code') && 'bg-muted'
              )}
            >
              <Code className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-6" />

            {/* 列表按钮 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={cn(
                'h-8 w-8 p-0',
                editor.isActive('bulletList') && 'bg-muted'
              )}
            >
              <List className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={cn(
                'h-8 w-8 p-0',
                editor.isActive('orderedList') && 'bg-muted'
              )}
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={cn(
                'h-8 w-8 p-0',
                editor.isActive('blockquote') && 'bg-muted'
              )}
            >
              <Quote className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-6" />

            {/* 图片上传按钮 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFileSelect}
              disabled={isUploading}
              className="h-8 px-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  {uploadProgress > 0 && `${Math.round(uploadProgress)}%`}
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4 mr-1" />
                  图片
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* 编辑器内容区域 */}
      <div
        className="relative"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <EditorContent
          editor={editor}
          className={cn(
            'prose prose-sm max-w-none p-4 min-h-[120px] focus-within:outline-none',
            readOnly && 'cursor-default'
          )}
        />
        
        {/* 拖拽提示 */}
        {!readOnly && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="flex items-center justify-center h-full opacity-0 hover:opacity-100 transition-opacity">
              <div className="bg-background/80 backdrop-blur-sm rounded-lg p-4 border-2 border-dashed border-muted-foreground/25">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">拖拽图片到此处上传</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />
    </div>
  )
}