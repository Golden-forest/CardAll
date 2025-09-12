// Tag grid display component

import React from 'react'
import { Tag as TagType } from '../../types/card'
import { TagItem } from './tag-item'
import { cn } from '../../lib/utils'

interface TagGridProps {
  tags: TagType[]
  selectedTags: string[]
  onTagClick: (tag: TagType) => void
  className?: string
  emptyMessage?: string
}

export const TagGrid: React.FC<TagGridProps> = ({
  tags,
  selectedTags,
  onTagClick,
  className,
  emptyMessage = 'No tags found'
}) => {
  if (tags.length === 0) {
    return (
      <div className={cn('text-center py-8 text-gray-500', className)}>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2', className)}>
      {tags.map((tag) => (
        <TagItem
          key={tag.id}
          tag={tag}
          isSelected={selectedTags.includes(tag.name)}
          onClick={onTagClick}
        />
      ))}
    </div>
  )
}

export default TagGrid