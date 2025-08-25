// Warm Orange - Creative energetic style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const WarmOrangePreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #dc2626 100%)',
    color: '#ffffff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '600',
    borderRadius: '18px',
    boxShadow: '0 25px 50px -12px rgba(249, 115, 22, 0.25), 0 0 0 1px rgba(249, 115, 22, 0.1)',
    border: 'none'
  }

  return (
    <StylePreviewCard
      title="Warm Orange"
      content="Energetic and vibrant"
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
  category: 'creative',
  description: 'Energetic orange gradient with vibrant warmth',
  style: {
    type: 'gradient',
    gradientColors: ['#f97316', '#ea580c', '#dc2626'],
    gradientDirection: 'to-br',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'semibold',
    textColor: '#ffffff',
    borderRadius: '2xl',
    shadow: '2xl',
    borderWidth: 0
  },
  previewComponent: WarmOrangePreview
}

export default warmOrangeStyle