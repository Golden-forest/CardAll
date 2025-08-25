// Gradient Sunset - Personality vibrant style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const GradientSunsetPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 25%, #ff9ff3 50%, #54a0ff 75%, #5f27cd 100%)',
    color: '#ffffff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '600',
    borderRadius: '24px',
    boxShadow: '0 25px 50px -12px rgba(255, 107, 107, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.2)',
    border: 'none'
  }

  return (
    <StylePreviewCard
      title="Gradient Sunset"
      content="Vibrant and expressive"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const gradientSunsetStyle: StylePreset = {
  id: 'gradient-sunset',
  name: 'Gradient Sunset',
  category: 'personality',
  description: 'Vibrant multi-color gradient with expressive energy',
  style: {
    type: 'gradient',
    gradientColors: ['#ff6b6b', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'],
    gradientDirection: 'to-br',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'semibold',
    textColor: '#ffffff',
    borderRadius: '2xl',
    shadow: '2xl',
    borderWidth: 0
  },
  previewComponent: GradientSunsetPreview
}

export default gradientSunsetStyle