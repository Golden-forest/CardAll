import React, { useState } from 'react'
import { Card as CardType } from '@/types/card'
import { cn } from '@/lib/utils'
import { themeConfig } from '@/lib/theme-config'
import { Button } from '@/components/ui/button'
import { 
  Copy, 
  Camera, 
  Share2, 
  Palette, 
  Edit3,
  Tag,
  ZoomIn
} from 'lucide-react'

interface FlipCardProps {
  card: CardType
  onFlip: (cardId: string) => void
  onEdit: (cardId: string, content: any) => void
  onCopy: (cardId: string) => void
  onScreenshot: (cardId: string) => void
  onShare: (cardId: string) => void
  onStyleChange: (cardId: string, theme: any) => void
  className?: string
}

export function FlipCard({
  card,
  onFlip,
  onEdit,
  onCopy,
  onScreenshot,
  onShare,
  onStyleChange,
  className
}: FlipCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  
  const getCardStyle = () => {
    const { type, style } = card.theme
    if (type === 'solid') {
      return themeConfig.colors.solid[style as keyof typeof themeConfig.colors.solid]
    } else {
      return themeConfig.colors.gradient[style as keyof typeof themeConfig.colors.gradient]
    }
  }

  const currentContent = card.isFlipped ? card.backContent : card.frontContent

  return (
    <div className={cn("group relative", className)}>
      {/* Card main body */}
      <div 
        className={cn(
          "relative w-full min-h-[300px] rounded-3xl p-6 cursor-pointer",
          "transform-gpu perspective-1000",
          themeConfig.animations.flip,
          themeConfig.shadows.card,
          getCardStyle(),
          card.isFlipped && "rotateY-180"
        )}
        onClick={() => onFlip(card.id)}
      >
        {/* Front content */}
        <div className={cn(
          "absolute inset-0 p-6 backface-hidden rounded-3xl",
          card.isFlipped && "rotateY-180"
        )}>
          <CardContent 
            content={card.frontContent}
            isEditing={isEditing}
            onEdit={(content) => onEdit(card.id, { front: content })}
          />
        </div>

        {/* Back content */}
        <div className={cn(
          "absolute inset-0 p-6 backface-hidden rounded-3xl rotateY-180",
          !card.isFlipped && "rotateY-180"
        )}>
          <CardContent 
            content={card.backContent}
            isEditing={isEditing}
            onEdit={(content) => onEdit(card.id, { back: content })}
            showTags={true}
          />
        </div>
      </div>

      {/* Function button group */}
      <div className={cn(
        "absolute -right-4 top-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100",
        "transition-opacity duration-200"
      )}>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 w-8 rounded-full shadow-lg"
          onClick={(e) => {
            e.stopPropagation()
            onCopy(card.id)
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
        
        <Button
          size="sm"
          variant="secondary"
          className="h-8 w-8 rounded-full shadow-lg"
          onClick={(e) => {
            e.stopPropagation()
            onScreenshot(card.id)
          }}
        >
          <Camera className="h-4 w-4" />
        </Button>
        
        <Button
          size="sm"
          variant="secondary"
          className="h-8 w-8 rounded-full shadow-lg"
          onClick={(e) => {
            e.stopPropagation()
            onShare(card.id)
          }}
        >
          <Share2 className="h-4 w-4" />
        </Button>
        
        <Button
          size="sm"
          variant="secondary"
          className="h-8 w-8 rounded-full shadow-lg"
          onClick={(e) => {
            e.stopPropagation()
            setIsEditing(!isEditing)
          }}
        >
          <Edit3 className="h-4 w-4" />
        </Button>
        
        <Button
          size="sm"
          variant="secondary"
          className="h-8 w-8 rounded-full shadow-lg"
          onClick={(e) => {
            e.stopPropagation()
            // Open style selector
          }}
        >
          <Palette className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

interface CardContentProps {
  content: CardContent
  isEditing: boolean
  onEdit: (content: CardContent) => void
  showTags?: boolean
}

function CardContent({ content, isEditing, onEdit, showTags }: CardContentProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Title */}
      <div className="mb-4">
        {isEditing ? (
          <input
            type="text"
            value={content.title}
            onChange={(e) => onEdit({ ...content, title: e.target.value })}
            className="w-full bg-transparent border-b border-white/30 text-xl font-bold focus:outline-none focus:border-white/60"
            placeholder="Enter title..."
          />
        ) : (
          <h3 className="text-xl font-bold text-left">{content.title || 'Untitled'}</h3>
        )}
      </div>

      {/* Image content */}
      {content.images && content.images.length > 0 && (
        <div className="mb-4 flex-shrink-0">
          <div className="grid gap-3">
            {content.images.map((image) => (
              <div key={image.id} className="relative group">
                <img
                  src={image.url}
                  alt={image.alt}
                  className="w-full h-auto rounded-2xl object-cover max-h-48 mx-auto cursor-pointer hover:scale-105 transition-transform"
                  onClick={(e) => {
                    e.stopPropagation()
                    // Image zoom functionality
                  }}
                />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="secondary" className="h-6 w-6 p-0">
                    <ZoomIn className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Text content */}
      <div className="flex-1">
        {isEditing ? (
          <textarea
            value={content.text}
            onChange={(e) => onEdit({ ...content, text: e.target.value })}
            className="w-full h-full bg-transparent border border-white/30 rounded-xl p-3 text-left resize-none focus:outline-none focus:border-white/60"
            placeholder="Enter content..."
          />
        ) : (
          <p className="text-left leading-relaxed">{content.text || 'No content'}</p>
        )}
      </div>

      {/* Tags */}
      {showTags && content.tags && content.tags.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="flex flex-wrap gap-2">
            {content.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-white/20 rounded-full text-xs"
              >
                <Tag className="h-3 w-3" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}