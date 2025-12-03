import React from 'react'
import { Card as CardType, CardContentType, ImageData } from '@/types/card'
import { Button } from '@/components/ui/button'
import {
  Cat,
  Copy,
  Camera,
  Share2,
  Edit3,
  Palette,
  MoreHorizontal,
  Tag,
  Image as ImageIcon,
  Trash2,
  FolderOpen,
  Maximize2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RichTextEditor } from './rich-text-editor'
import { TitleEditor } from './title-editor'
import { CardTags } from '../tag/card-tags'
import { ImageGrid } from './image-grid'

interface CardSideProps {
  content: CardContentType
  isEditing: boolean
  editingField: 'title' | 'content' | null
  _onTitleChange: (_e: React.ChangeEvent<HTMLInputElement>) => void
  _onTextChange: (_e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onTempContentUpdate: (_field: keyof CardContentType, _value: any) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDoubleClick: (_field: 'title' | 'content') => void
  _onKeyDown: (_e: React.KeyboardEvent) => void
  _sideLabel: string
  isHovered: boolean
  onEdit: (_e: React.MouseEvent) => void
  onFlip: (_e: React.MouseEvent) => void
  onCopy: () => void
  onScreenshot: () => void
  onShare: () => void
  onDelete: () => void
  onStyleChange?: () => void
  onTagsChange?: () => void
  onMoveToFolder?: () => void
  _card: CardType
  isFlipping: boolean
  isCurrentlyFlipped: boolean
}

const CardSide = React.memo(function CardSide({
  content,
  isEditing,
  editingField,
  onTempContentUpdate,
  onSaveEdit,
  onCancelEdit,
  onDoubleClick,
  isHovered,
  onEdit,
  onFlip,
  onCopy,
  onScreenshot,
  onShare,
  onDelete,
  onStyleChange,
  onTagsChange,
  onMoveToFolder,
  isFlipping,
  isCurrentlyFlipped,
  _onTitleChange,
  _onTextChange,
  _onKeyDown,
  _sideLabel,
  _card
}: CardSideProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header with Title and Action Buttons */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 mr-2">
          {isEditing && editingField === 'title' ? (
            <TitleEditor
              content={content.title}
              onUpdate={(value) => onTempContentUpdate('title', value)}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
              autoFocus
            />
          ) : (
            <h3 
              className="text-lg font-semibold text-left cursor-pointer hover:bg-black/5 rounded px-1 py-0.5 -mx-1 transition-colors"
              onDoubleClick={() => onDoubleClick('title')}
              style={{ color: _card.style.titleColor || _card.style.textColor }}
            >
              {content.title || 'Untitled Card'}
            </h3>
          )}
        </div>

        {/* Action Buttons - Inline */}
        <div className={cn(
          "flex gap-1 transition-all duration-200 flex-shrink-0",
          isHovered || isEditing ? "opacity-100" : "opacity-60"
        )}>
          {/* Flip Button with Cat Icon */}
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-7 w-7 p-0 rounded-md hover:bg-black/10 transition-all duration-200",
              isFlipping && "animate-pulse"
            )}
            onClick={onFlip}
            title={`Flip to ${isCurrentlyFlipped ? 'Front' : 'Back'}`}
            disabled={isFlipping}
          >
            <Cat className={cn(
              "h-3.5 w-3.5 transition-transform duration-200",
              isFlipping && "scale-110"
            )} />
          </Button>

          {/* More Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 rounded-md hover:bg-black/10 transition-all duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onEdit}>
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Content
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCopy}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onScreenshot}>
                <Camera className="h-4 w-4 mr-2" />
                Screenshot
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                // This will be handled by the parent component
                const event = new CustomEvent('card-view-detail', { detail: { cardId: _card.id } });
                window.dispatchEvent(event);
              }}>
                <Maximize2 className="h-4 w-4 mr-2" />
                Zoom View
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {onStyleChange && (
                <DropdownMenuItem onClick={onStyleChange}>
                  <Palette className="h-4 w-4 mr-2" />
                  Change Style
                </DropdownMenuItem>
              )}
              {onTagsChange && (
                <DropdownMenuItem onClick={onTagsChange}>
                  <Tag className="h-4 w-4 mr-2" />
                  Manage Tags
                </DropdownMenuItem>
              )}
              {onMoveToFolder && (
                <DropdownMenuItem onClick={onMoveToFolder}>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Move to Folder
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Card
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Images */}
      {content.images.length > 0 && (
        <div className="mb-3 flex-shrink-0">
          <ImageGrid images={content.images} />
          {content.images.length > 4 && (
            <div className="text-xs text-muted-foreground mt-1 text-center">
              +{content.images.length - 4} more images
            </div>
          )}
        </div>
      )}

      {/* Text Content */}
      <div className="flex-1 mb-3 relative z-10">
        {isEditing && editingField === 'content' ? (
          <RichTextEditor
            content={content.text}
            placeholder="Add your content here..."
            onUpdate={(value) => onTempContentUpdate('text', value)}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
            autoFocus
          />
        ) : (
          <div 
            className="text-sm leading-relaxed text-left cursor-pointer hover:bg-black/5 rounded p-2 -m-2 transition-colors min-h-[100px] tiptap-editor relative z-10"
            onDoubleClick={(e) => {
              // 如果点击的是链接，不触发编辑
              if ((e.target as HTMLElement).tagName === 'A') {
                return
              }
              onDoubleClick('content')
            }}
            onClick={(e) => {
              // 处理链接点击
              const target = e.target as HTMLElement
              if (target.tagName === 'A') {
                e.stopPropagation()
                const href = target.getAttribute('href')
                if (href) {
                  window.open(href, '_blank', 'noopener,noreferrer')
                }
              }
            }}
          >
            <div
              className="whitespace-pre-wrap break-words overflow-wrap-anywhere"
              dangerouslySetInnerHTML={{
                __html: content.text || '<span class="text-muted-foreground">Click to add content...</span>'
              }}
            />
          </div>
        )}
      </div>

      {/* Footer with Tags and Image Count */}
      <div className="mt-auto">
        {/* Tags */}
        <CardTags tags={content.tags} size="sm" />

        {/* Image Count */}
        {content.images.length > 0 && (
          <div className="flex items-center justify-end text-xs text-muted-foreground mt-2">
            <div className="flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              <span>{content.images.length}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

export { CardSide }