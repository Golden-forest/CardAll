// Style preview component for displaying card style templates

import React from 'react'
import { cn } from '../../../lib/utils'
import { StylePreviewProps } from '../../../types/style'

interface StylePreviewCardProps extends StylePreviewProps {
  title?: string
  content?: string
  style: React.CSSProperties
}

export const StylePreviewCard: React.FC<StylePreviewCardProps> = ({
  title = "Sample Card",
  content = "This is a preview of how your card will look with this style.",
  style,
  isSelected = false,
  onClick,
  className
}) => {
  return (
    <div
      className={cn(
        "relative w-full h-20 cursor-pointer transition-all duration-200",
        "border-2 rounded-lg overflow-hidden",
        isSelected 
          ? "border-blue-500 ring-2 ring-blue-200 scale-105" 
          : "border-transparent hover:border-gray-300 hover:scale-102",
        className
      )}
      style={style}
      onClick={onClick}
    >
      <div className="absolute inset-0 p-3 flex flex-col justify-between">
        <div className="text-xs font-medium truncate opacity-90">
          {title}
        </div>
        <div className="text-xs opacity-70 line-clamp-2">
          {content}
        </div>
      </div>
      
      {isSelected && (
        <div className="absolute top-1 right-1">
          <div className="w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
            <svg 
              className="w-2 h-2 text-white" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                clipRule="evenodd" 
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}

export default StylePreviewCard