// Modern Blue - Contemporary business style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const ModernBluePreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    color: '#ffffff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    borderRadius: '16px',
    boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3), 0 4px 6px -2px rgba(59, 130, 246, 0.1)',
    border: 'none'
  }

  return (
    <StylePreviewCard
      title="Modern Blue"
      content="Contemporary gradient design"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const modernBlueStyle: StylePreset = {
  id: 'modern-blue',
  name: 'Modern Blue',
  category: 'business',
  description: 'Contemporary blue gradient with professional appeal',
  style: {
    type: 'gradient',
    gradientColors: ['#3b82f6', '#1d4ed8', '#1e40af'],
    gradientDirection: 'to-br',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'medium',
    textColor: '#ffffff',
    borderRadius: '2xl',
    shadow: 'lg',
    borderWidth: 0
  },
  previewComponent: ModernBluePreview
}

export default modernBlueStyle