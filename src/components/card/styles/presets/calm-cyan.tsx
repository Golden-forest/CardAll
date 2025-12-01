// Calm Cyan - Serene and peaceful style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const CalmCyanPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: '#f0f9ff',
    color: '#0284c7',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  }

  return (
    <StylePreviewCard
      title="Calm Cyan"
      content="Serene and peaceful"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const calmCyanStyle: StylePreset = {
  id: 'calm-cyan',
  name: 'Calm Cyan',
  category: 'nature',
  description: 'Serene and peaceful cyan background with high contrast text',
  style: {
    type: 'solid',
    backgroundColor: '#f0f9ff',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'normal',
    textColor: '#0284c7',
    titleColor: '#0ea5e9',
    bodyTextColor: '#0284c7',
    borderRadius: '2xl',
    shadow: 'md'
  },
  previewComponent: CalmCyanPreview
}

export default calmCyanStyle