// Elegant Pink - Sophisticated and feminine style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const ElegantPinkPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: '#fef2f2',
    color: '#b91c1c',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  }

  return (
    <StylePreviewCard
      title="Elegant Pink"
      content="Sophisticated and feminine"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const elegantPinkStyle: StylePreset = {
  id: 'elegant-pink',
  name: 'Elegant Pink',
  category: 'modern',
  description: 'Sophisticated and feminine pink background with high contrast text',
  style: {
    type: 'solid',
    backgroundColor: '#fef2f2',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'normal',
    textColor: '#b91c1c',
    titleColor: '#dc2626',
    bodyTextColor: '#b91c1c',
    borderRadius: '2xl',
    shadow: 'md'
  },
  previewComponent: ElegantPinkPreview
}

export default elegantPinkStyle