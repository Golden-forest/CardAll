// Deep Purple Gradient - Rich and luxurious style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const DeepPurpleGradientPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#e0e7ff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  }

  return (
    <StylePreviewCard
      title="Deep Purple Gradient"
      content="Rich and luxurious"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const deepPurpleGradientStyle: StylePreset = {
  id: 'deep-purple-gradient',
  name: 'Deep Purple Gradient',
  category: 'gradient',
  description: 'Rich and luxurious purple gradient background with high contrast text',
  style: {
    type: 'gradient',
    gradientColors: ['#667eea', '#764ba2'],
    gradientDirection: 'to-br',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'normal',
    textColor: '#e0e7ff',
    titleColor: '#ffffff',
    bodyTextColor: '#e0e7ff',
    borderRadius: '2xl',
    shadow: 'md'
  },
  previewComponent: DeepPurpleGradientPreview
}

export default deepPurpleGradientStyle