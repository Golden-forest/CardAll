// Gradient Wave - Creative style with purple to cyan gradient wave effect

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const GradientWavePreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: 'linear-gradient(135deg, #8a2be2 0%, #4b0082 25%, #9370db 50%, #00ffff 75%, #00bfff 100%)',
    color: '#ffffff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '600',
    borderRadius: '24px',
    boxShadow: '0 25px 50px -12px rgba(138, 43, 226, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.2)',
    border: 'none',
    position: 'relative',
    overflow: 'hidden'
  }

  return (
    <div className="relative">
      <StylePreviewCard
        title="Gradient Wave"
        content="Dynamic wave effect"
        style={style}
        isSelected={isSelected}
        onClick={onClick}
        className={`${className} gradient-wave-animation`}
      />
    </div>
  )
}

export const gradientWaveStyle: StylePreset = {
  id: 'gradient-wave',
  name: 'Gradient Wave',
  category: 'creative',
  description: 'Purple to cyan gradient with dynamic wave effect',
  style: {
    type: 'gradient',
    gradientColors: ['#8a2be2', '#4b0082', '#9370db', '#00ffff', '#00bfff'],
    gradientDirection: 'to-br',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'semibold',
    textColor: '#ffffff',
    borderRadius: '2xl',
    shadow: '2xl',
    borderWidth: 0
  },
  previewComponent: GradientWavePreview
}

export default gradientWaveStyle