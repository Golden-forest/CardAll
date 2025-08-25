// Deep Dark - Personality bold style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const DeepDarkPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: 'linear-gradient(135deg, #1f2937 0%, #111827 50%, #030712 100%)',
    color: '#f9fafb',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '600',
    borderRadius: '12px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  }

  return (
    <StylePreviewCard
      title="Deep Dark"
      content="Bold and mysterious"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const deepDarkStyle: StylePreset = {
  id: 'deep-dark',
  name: 'Deep Dark',
  category: 'personality',
  description: 'Bold dark gradient with mysterious depth',
  style: {
    type: 'gradient',
    gradientColors: ['#1f2937', '#111827', '#030712'],
    gradientDirection: 'to-br',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'semibold',
    textColor: '#f9fafb',
    borderRadius: '2xl',
    shadow: '2xl',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  previewComponent: DeepDarkPreview
}

export default deepDarkStyle