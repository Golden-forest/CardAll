import React, { useState, useCallback } from 'react'
import { useCardAllCards } from '@/contexts/cardall-context'
import { useStorageAdapter } from '@/hooks/use-cards-adapter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Card as CardType, DEFAULT_CARD_STYLE } from '@/types/card'

interface CardCreatorProps {
  onCardCreated?: (card: CardType) => void
  className?: string
}

export function CardCreator({ onCardCreated, className }: CardCreatorProps) {
  const { dispatch } = useCardAllCards()
  const { isReady } = useStorageAdapter()

  const [formData, setFormData] = useState({
    frontTitle: '',
    frontContent: '',
    backTitle: '',
    backContent: '',
    tags: [] as string[]
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    if (!isReady) {
      setError('系统未就绪，请稍后再试')
      setIsSubmitting(false)
      return
    }

    try {
      const now = new Date()
      const newCard: CardType = {
        id: crypto.randomUUID(),
        frontContent: {
          title: formData.frontTitle,
          text: formData.frontContent,
          images: [],
          tags: formData.tags,
          lastModified: now
        },
        backContent: {
          title: formData.backTitle,
          text: formData.backContent,
          images: [],
          tags: [],
          lastModified: now
        },
        style: DEFAULT_CARD_STYLE,
        isFlipped: false,
        createdAt: now,
        updatedAt: now
      }

      // 使用dispatch保存卡片
      await dispatch({
        type: 'CREATE_CARD',
        payload: newCard
      })

      onCardCreated?.(newCard)

      // 重置表单
      setFormData({
        frontTitle: '',
        frontContent: '',
        backTitle: '',
        backContent: '',
        tags: []
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建卡片失败')
      console.error('Failed to create card:', err)
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, onCardCreated, dispatch, isReady])

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // 禁用表单如果系统未就绪
  if (!isReady) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">系统初始化中...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>创建新卡片</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* 正面内容 */}
          <div>
            <Label htmlFor="frontTitle">正面标题 *</Label>
            <Input
              id="frontTitle"
              value={formData.frontTitle}
              onChange={(e) => handleInputChange('frontTitle', e.target.value)}
              placeholder="输入卡片正面标题"
              required
            />
          </div>

          <div>
            <Label htmlFor="frontContent">正面内容 *</Label>
            <Textarea
              id="frontContent"
              value={formData.frontContent}
              onChange={(e) => handleInputChange('frontContent', e.target.value)}
              placeholder="输入卡片正面内容"
              rows={4}
              required
            />
          </div>

          {/* 背面内容 */}
          <div>
            <Label htmlFor="backTitle">背面标题</Label>
            <Input
              id="backTitle"
              value={formData.backTitle}
              onChange={(e) => handleInputChange('backTitle', e.target.value)}
              placeholder="输入卡片背面标题（可选）"
            />
          </div>

          <div>
            <Label htmlFor="backContent">背面内容</Label>
            <Textarea
              id="backContent"
              value={formData.backContent}
              onChange={(e) => handleInputChange('backContent', e.target.value)}
              placeholder="输入卡片背面内容（可选）"
              rows={4}
            />
          </div>

          {/* 标签 */}
          <div>
            <Label htmlFor="tags">标签</Label>
            <div className="flex gap-2 flex-wrap">
              {formData.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => {
                      const newTags = [...formData.tags]
                      newTags.splice(index, 1)
                      handleInputChange('tags', newTags)
                    }}
                    className="ml-1 hover:text-red-500"
                  >
                    ×
                  </button>
                </Badge>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newTag = prompt('输入标签名称:')
                  if (newTag && !formData.tags.includes(newTag)) {
                    handleInputChange('tags', [...formData.tags, newTag])
                  }
                }}
              >
                + 添加标签
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || !formData.frontTitle || !formData.frontContent}
            className="w-full"
          >
            {isSubmitting ? '创建中...' : '创建卡片'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}