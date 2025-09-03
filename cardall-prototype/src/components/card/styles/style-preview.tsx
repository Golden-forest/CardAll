// Style preview component for displaying card style templates (Simplified Version)

import React from 'react'
import { CardStyle } from '../../../types/card'

interface StylePreviewCardProps {
  title?: string
  content?: string
  style: CardStyle
  isSelected?: boolean
  onClick?: () => void
  className?: string
}

export const StylePreviewCard: React.FC<StylePreviewCardProps> = ({
  title = "Sample Card",
  content = "This is a preview of how your card will look with this style.",
  style,
  isSelected = false,
  onClick,
  className
}) => {
  console.log('Rendering StylePreviewCard (Simplified):', { title, isSelected, style })
  
  // Generate style based on card style configuration
  const getCardStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      minHeight: '60px',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '8px',
      borderRadius: '8px',
      cursor: 'pointer',
      border: isSelected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
      position: 'relative',
      fontSize: '10px',
      textAlign: 'center',
      boxShadow: isSelected ? '0 4px 12px rgba(59, 130, 246, 0.3)' : '0 2px 4px rgba(0, 0, 0, 0.1)',
      transition: 'all 0.2s ease',
      backgroundColor: '#ffffff'
    }

    // Handle both CardStyle type and React.CSSProperties type
    if (typeof style === 'object' && style !== null) {
      // If it's already a React.CSSProperties object (from preset components)
      if ('background' in style || 'backgroundColor' in style) {
        return {
          ...baseStyles,
          ...style,
          // Preserve essential interactive styles
          cursor: 'pointer',
          border: isSelected ? '3px solid #3b82f6' : (style.border || '2px solid #e5e7eb'),
          boxShadow: isSelected ? '0 4px 12px rgba(59, 130, 246, 0.3)' : (style.boxShadow || '0 2px 4px rgba(0, 0, 0, 0.1)'),
          transition: 'all 0.2s ease'
        }
      }
      
      // If it's a CardStyle type
      if ('type' in style) {
        if (style.type === 'solid') {
          return {
            ...baseStyles,
            backgroundColor: style.backgroundColor || '#ffffff',
            color: style.textColor || '#374151'
          }
        } else if (style.type === 'gradient' && style.gradientColors) {
          const gradientDirection = style.gradientDirection || 'to bottom right'
          const gradientString = `linear-gradient(${gradientDirection}, ${style.gradientColors.join(', ')})`
          
          return {
            ...baseStyles,
            background: gradientString,
            color: style.textColor || '#ffffff'
          }
        }
      }
    }

    return baseStyles
  }

  return (
    <div
      style={getCardStyles()}
      onClick={onClick}
      className={className}
    >
      <div style={{ fontWeight: '600', marginBottom: '2px', fontSize: '11px' }}>
        {title}
      </div>
      <div style={{ fontSize: '9px', opacity: 0.8, lineHeight: '1.1' }}>
        {content}
      </div>
    </div>
  )
}

export default StylePreviewCard