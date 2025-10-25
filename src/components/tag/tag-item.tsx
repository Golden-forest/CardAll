// Individual tag item component

import React from 'react'
import { Tag as TagType } from '../../types/card'
import { cn } from '../../lib/utils'
import { Check } from 'lucide-react'

interface TagItemProps {
  tag: TagType
  isSelected: boolean
  onClick: (tag: TagType) => void
  className?: string
  showCount?: boolean
}

export const TagItem: React.FC<TagItemProps> = ({
  tag,
  isSelected,
  onClick,
  className,
  showCount = true
}) => {
  return (
    <button
      onClick={() => onClick(tag)}
      className={cn(
        'relative flex items-center justify-between px-3 py-2 rounded-xl border transition-all duration-300 ease-out',
        'hover:shadow-lg hover:shadow-black/10 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500/30',
        'backdrop-blur-sm group',
        isSelected 
          ? 'bg-gradient-to-r from-blue-500 to-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/25' 
          : 'bg-white/80 border-gray-200/60 text-gray-700 hover:bg-white hover:border-gray-300/80',
        className
      )}
      style={{
        boxShadow: isSelected 
          ? '0 4px 20px -4px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(59, 130, 246, 0.1)' 
          : undefined
      }}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {/* Tag color indicator */}
        <div 
          className={cn(
            "w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300",
            isSelected ? "bg-white/90 shadow-sm" : "shadow-sm"
          )}
          style={{ 
            backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.9)' : tag.color,
            boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.1)' : `0 1px 3px ${tag.color}40`
          }}
        />
        
        {/* Tag name */}
        <span className={cn(
          "text-sm font-medium truncate transition-all duration-300",
          isSelected ? "text-white" : "text-gray-700 group-hover:text-gray-900"
        )}>
          {tag.name}
        </span>
        
        {/* Selection indicator */}
        {isSelected && (
          <Check className="w-3.5 h-3.5 text-white/90 flex-shrink-0 animate-in fade-in-0 zoom-in-95 duration-200" />
        )}
      </div>
      
      {/* Usage count */}
      {showCount && (
        <span className={cn(
          "text-xs font-medium px-2 py-0.5 rounded-full ml-2 flex-shrink-0 transition-all duration-300",
          isSelected 
            ? "text-blue-600 bg-white/90 shadow-sm" 
            : "text-gray-500 bg-gray-100/80 group-hover:bg-gray-200/80 group-hover:text-gray-600"
        )}>
          {tag.count}
        </span>
      )}
    </button>
  )
}

export default TagItem