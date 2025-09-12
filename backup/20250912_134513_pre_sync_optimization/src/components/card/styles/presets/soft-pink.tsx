// Soft Pink - Natural gentle style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const SoftPinkPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: 'linear-gradient(90deg, #fda4af 0%, #f87171 100%)',
    color: '#ffffff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    borderRadius: '20px',
    boxShadow: '0 10px 15px -3px rgba(253, 164, 175, 0.3), 0 4px 6px -2px rgba(248, 113, 113, 0.1)',
    border: '1px solid rgba(253, 164, 175, 0.3)'
  }

  return (
    <StylePreviewCard
      title="Soft Pink"
      content="Gentle and soothing"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const softPinkStyle: StylePreset = {
  id: 'soft-pink',
  name: 'Soft Pink',
  category: 'natural',
  description: 'Warm pink to red gradient with romantic tones',
  style: {
    type: 'gradient',
    gradientColors: ['#fda4af', '#f87171'],
    gradientDirection: 'to-r',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'medium',
    textColor: '#ffffff',
    borderRadius: '2xl',
    shadow: 'lg',
    borderWidth: 1,
    borderColor: 'rgba(253, 164, 175, 0.3)'
  },
  previewComponent: SoftPinkPreview
}

export default softPinkStyle