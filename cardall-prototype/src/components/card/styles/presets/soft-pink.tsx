// Soft Pink - Natural gentle style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const SoftPinkPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 30%, #f9a8d4 100%)',
    color: '#831843',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    borderRadius: '20px',
    boxShadow: '0 10px 15px -3px rgba(249, 168, 212, 0.2), 0 4px 6px -2px rgba(249, 168, 212, 0.1)',
    border: '1px solid rgba(249, 168, 212, 0.3)'
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
  description: 'Gentle pink gradient with soothing warmth',
  style: {
    type: 'gradient',
    gradientColors: ['#fdf2f8', '#fce7f3', '#f9a8d4'],
    gradientDirection: 'to-br',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'medium',
    textColor: '#831843',
    borderRadius: '2xl',
    shadow: 'lg',
    borderWidth: 1,
    borderColor: 'rgba(249, 168, 212, 0.3)'
  },
  previewComponent: SoftPinkPreview
}

export default softPinkStyle