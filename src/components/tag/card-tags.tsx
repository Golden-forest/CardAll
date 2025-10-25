// Card tags display component

import React from 'react'
import { cn } from '../../lib/utils'

interface CardTagsProps {
  tags: string[]
  className?: string
  maxTags?: number
  size?: 'sm' | 'md' | 'lg'
}

// Generate color from tag name using a simple hash
const getTagColor = (tagName: string): string => {
  const colors = [
    '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4',
    '#8b5a2b', '#6b7280', '#ec4899', '#84cc16', '#f97316', '#6366f1'
  ]
  
  let hash = 0
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  return colors[Math.abs(hash) % colors.length]
}

export const CardTags: React.FC<CardTagsProps> = ({
  tags,
  className,
  maxTags = 5,
  size = 'sm'
}) => {
  if (!tags || tags.length === 0) {
    return null
  }

  const displayTags = tags.slice(0, maxTags)
  const remainingCount = tags.length - maxTags

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-2.5 py-1.5',
    lg: 'text-base px-3 py-2'
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5 mt-3', className)}>
      {displayTags.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className={cn(
            'inline-flex items-center rounded-full font-medium text-white',
            'shadow-sm transition-all duration-200 hover:scale-105',
            sizeClasses[size]
          )}
          style={{ 
            backgroundColor: getTagColor(tag),
            fontSize: size === 'sm' ? '0.75rem' : size === 'md' ? '0.875rem' : '1rem'
          }}
        >
          {tag}
        </span>
      ))}
      
      {remainingCount > 0 && (
        <span
          className={cn(
            'inline-flex items-center rounded-full bg-gray-500 text-white font-medium',
            sizeClasses[size]
          )}
        >
          +{remainingCount}
        </span>
      )}
    </div>
  )
}

export default CardTags