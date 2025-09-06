// Gradient Sunset - Personality vibrant style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const GradientSunsetPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: 'linear-gradient(90deg, #fb923c 0%, #8b5cf6 100%)',
    color: '#ffffff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '600',
    borderRadius: '24px',
    boxShadow: '0 25px 50px -12px rgba(251, 146, 60, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.2)',
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
  description: 'Warm orange to violet gradient with magical sunset vibes',
  style: {
    type: 'gradient',
    gradientColors: ['#fb923c', '#8b5cf6'],
    gradientDirection: 'to-r',
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