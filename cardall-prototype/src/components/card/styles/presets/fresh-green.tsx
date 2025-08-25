// Fresh Green - Natural organic style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const FreshGreenPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
    color: '#ffffff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    borderRadius: '16px',
    boxShadow: '0 20px 25px -5px rgba(16, 185, 129, 0.2), 0 10px 10px -5px rgba(16, 185, 129, 0.1)',
    border: 'none'
  }

  return (
    <StylePreviewCard
      title="Fresh Green"
      content="Natural and harmonious"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const freshGreenStyle: StylePreset = {
  id: 'fresh-green',
  name: 'Fresh Green',
  category: 'natural',
  description: 'Natural green gradient with organic harmony',
  style: {
    type: 'gradient',
    gradientColors: ['#10b981', '#059669', '#047857'],
    gradientDirection: 'to-br',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'medium',
    textColor: '#ffffff',
    borderRadius: '2xl',
    shadow: '2xl',
    borderWidth: 0
  },
  previewComponent: FreshGreenPreview
}

export default freshGreenStyle