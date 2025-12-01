// Blue Green Gradient - Fresh and modern style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const BlueGreenGradientPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    color: '#e0f2fe',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  }

  return (
    <StylePreviewCard
      title="Blue Green Gradient"
      content="Fresh and modern"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const blueGreenGradientStyle: StylePreset = {
  id: 'blue-green-gradient',
  name: 'Blue Green Gradient',
  category: 'gradient',
  description: 'Fresh and modern blue-green gradient background with high contrast text',
  style: {
    type: 'gradient',
    gradientColors: ['#4facfe', '#00f2fe'],
    gradientDirection: 'to-br',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'normal',
    textColor: '#e0f2fe',
    titleColor: '#ffffff',
    bodyTextColor: '#e0f2fe',
    borderRadius: '2xl',
    shadow: 'md'
  },
  previewComponent: BlueGreenGradientPreview
}

export default blueGreenGradientStyle