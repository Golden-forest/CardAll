// Warm Orange - Energetic and friendly style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const WarmOrangePreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: '#fff7ed',
    color: '#c2410c',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  }

  return (
    <StylePreviewCard
      title="Warm Orange"
      content="Energetic and friendly"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const warmOrangeStyle: StylePreset = {
  id: 'warm-orange',
  name: 'Warm Orange',
  category: 'warm',
  description: 'Energetic and friendly orange background with high contrast text',
  style: {
    type: 'solid',
    backgroundColor: '#fff7ed',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'normal',
    textColor: '#c2410c',
    titleColor: '#ea580c',
    bodyTextColor: '#c2410c',
    borderRadius: '2xl',
    shadow: 'md'
  },
  previewComponent: WarmOrangePreview
}

export default warmOrangeStyle