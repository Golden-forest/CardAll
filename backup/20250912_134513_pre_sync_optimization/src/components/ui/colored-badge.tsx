import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ColoredBadgeProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  colorIndex?: number
}

// 预定义的8种颜色系统
const TAG_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200' },
  { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' },
  { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' }
]

// 根据字符串生成颜色索引的哈希函数
function getColorIndex(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 转换为32位整数
  }
  return Math.abs(hash) % TAG_COLORS.length
}

export function ColoredBadge({ 
  children, 
  className, 
  variant = 'default',
  colorIndex 
}: ColoredBadgeProps) {
  const tagText = typeof children === 'string' ? children : String(children)
  const index = colorIndex !== undefined ? colorIndex % TAG_COLORS.length : getColorIndex(tagText)
  const colors = TAG_COLORS[index]

  if (variant !== 'default') {
    return (
      <Badge variant={variant} className={className}>
        {children}
      </Badge>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border',
        colors.bg,
        colors.text,
        colors.border,
        'transition-colors duration-200',
        className
      )}
    >
      {children}
    </span>
  )
}

export default ColoredBadge