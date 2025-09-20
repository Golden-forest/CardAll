import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { DatabaseService } from '@/services/database/database.service'
import { CardData } from '@/types/card'
import { unifiedSyncService } from '@/services/core/sync/unified-sync.service'

interface CardCreatorProps {
  onCardCreated?: (card: CardData) => void
  className?: string
}

export function CardCreator({ onCardCreated, className }: CardCreatorProps) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '',
    tags: [] as string[],
    priority: 'medium'
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const newCard: CardData = {
        id: crypto.randomUUID(),
        title: formData.title,
        content: formData.content,
        category: formData.category,
        tags: formData.tags,
        priority: formData.priority as 'low' | 'medium' | 'high',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending'
      }

      // 保存到本地数据库
      await DatabaseService.getInstance().saveCard(newCard)

      // 触发同步
      await unifiedSyncService.sync({
        type: 'incremental',
        direction: 'upload'
      })

      onCardCreated?.(newCard)

      // 重置表单
      setFormData({
        title: '',
        content: '',
        category: '',
        tags: [],
        priority: 'medium'
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建卡片失败')
      console.error('Failed to create card:', err)
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, onCardCreated])

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
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

          <div>
            <Label htmlFor="title">标题 *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="输入卡片标题"
              required
            />
          </div>

          <div>
            <Label htmlFor="content">内容 *</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              placeholder="输入卡片内容"
              rows={4}
              required
            />
          </div>

          <div>
            <Label htmlFor="category">分类</Label>
            <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
              <SelectTrigger>
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="work">工作</SelectItem>
                <SelectItem value="personal">个人</SelectItem>
                <SelectItem value="learning">学习</SelectItem>
                <SelectItem value="ideas">想法</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="priority">优先级</Label>
            <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">低</SelectItem>
                <SelectItem value="medium">中</SelectItem>
                <SelectItem value="high">高</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || !formData.title || !formData.content}
            className="w-full"
          >
            {isSubmitting ? '创建中...' : '创建卡片'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}