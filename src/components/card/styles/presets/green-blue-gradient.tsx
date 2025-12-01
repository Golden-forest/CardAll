// Green Blue Gradient - Fresh and natural style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const GreenBlueGradientPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    color: '#134e4a',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  }

  return (
    <StylePreviewCard
      title="Green Blue Gradient"
      content="Fresh and natural"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const greenBlueGradientStyle: StylePreset = {
  id: 'green-blue-gradient',
  name: 'Green Blue Gradient',
  category: 'gradient',
  description: 'Fresh and natural green-blue gradient background with high contrast text',
  style: {
    type: 'gradient',
    gradientColors: ['#43e97b', '#38f9d7'],
    gradientDirection: 'to-br',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'normal',
    textColor: '#134e4a',
    titleColor: '#064e3b',
    bodyTextColor: '#134e4a',
    borderRadius: '2xl',
    shadow: 'md'
  },
  previewComponent: GreenBlueGradientPreview
}

export default greenBlueGradientStyle