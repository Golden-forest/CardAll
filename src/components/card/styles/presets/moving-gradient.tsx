// Moving Gradient - Dynamic style with moving gradient background

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const MovingGradientPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: 'linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)',
    backgroundSize: '400% 400%',
    color: '#ffffff',
    fontFamily: '"Poppins", system-ui, sans-serif',
    fontSize: '14px',
    fontWeight: '600',
    borderRadius: '16px',
    boxShadow: '0 15px 30px -10px rgba(0, 0, 0, 0.25)',
    border: 'none',
    position: 'relative',
    overflow: 'hidden'
  }

  return (
    <div className="relative">
      <StylePreviewCard
        title="Moving Gradient"
        content="Flowing color effect"
        style={style}
        isSelected={isSelected}
        onClick={onClick}
        className={`${className} moving-gradient-animation`}
      />
    </div>
  )
}

export const movingGradientStyle: StylePreset = {
  id: 'moving-gradient',
  name: 'Moving Gradient',
  category: 'creative',
  description: 'Colorful gradient with flowing animation effect',
  style: {
    type: 'gradient',
    gradientColors: ['#ee7752', '#e73c7e', '#23a6d5', '#23d5ab'],
    gradientDirection: 'to-br',
    fontFamily: 'Poppins',
    fontSize: 'base',
    fontWeight: 'semibold',
    textColor: '#ffffff',
    borderRadius: 'xl',
    shadow: 'xl',
    borderWidth: 0
  },
  previewComponent: MovingGradientPreview
}

export default movingGradientStyle