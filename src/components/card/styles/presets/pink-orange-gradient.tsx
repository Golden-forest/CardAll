// Pink Orange Gradient - Vibrant and energetic style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const PinkOrangeGradientPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    color: '#fffbeb',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  }

  return (
    <StylePreviewCard
      title="Pink Orange Gradient"
      content="Vibrant and energetic"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const pinkOrangeGradientStyle: StylePreset = {
  id: 'pink-orange-gradient',
  name: 'Pink Orange Gradient',
  category: 'gradient',
  description: 'Vibrant and energetic pink-orange gradient background with high contrast text',
  style: {
    type: 'gradient',
    gradientColors: ['#fa709a', '#fee140'],
    gradientDirection: 'to-br',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'normal',
    textColor: '#fffbeb',
    titleColor: '#ffffff',
    bodyTextColor: '#fffbeb',
    borderRadius: '2xl',
    shadow: 'md'
  },
  previewComponent: PinkOrangeGradientPreview
}

export default pinkOrangeGradientStyle