// Elegant Purple - Creative artistic style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const ElegantPurplePreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #c084fc 100%)',
    color: '#ffffff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    borderRadius: '20px',
    boxShadow: '0 20px 25px -5px rgba(139, 92, 246, 0.25), 0 10px 10px -5px rgba(139, 92, 246, 0.1)',
    border: 'none'
  }

  return (
    <StylePreviewCard
      title="Elegant Purple"
      content="Artistic and inspiring"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const elegantPurpleStyle: StylePreset = {
  id: 'elegant-purple',
  name: 'Elegant Purple',
  category: 'creative',
  description: 'Artistic purple gradient with elegant curves and shadows',
  style: {
    type: 'gradient',
    gradientColors: ['#8b5cf6', '#a855f7', '#c084fc'],
    gradientDirection: 'to-br',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'medium',
    textColor: '#ffffff',
    borderRadius: '2xl',
    shadow: '2xl',
    borderWidth: 0
  },
  previewComponent: ElegantPurplePreview
}

export default elegantPurpleStyle