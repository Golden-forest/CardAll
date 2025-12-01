// Vibrant Yellow - Energetic and cheerful style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const VibrantYellowPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: '#fefce8',
    color: '#d97706',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  }

  return (
    <StylePreviewCard
      title="Vibrant Yellow"
      content="Energetic and cheerful"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const vibrantYellowStyle: StylePreset = {
  id: 'vibrant-yellow',
  name: 'Vibrant Yellow',
  category: 'warm',
  description: 'Energetic and cheerful yellow background with high contrast text',
  style: {
    type: 'solid',
    backgroundColor: '#fefce8',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'normal',
    textColor: '#d97706',
    titleColor: '#f59e0b',
    bodyTextColor: '#d97706',
    borderRadius: '2xl',
    shadow: 'md'
  },
  previewComponent: VibrantYellowPreview
}

export default vibrantYellowStyle