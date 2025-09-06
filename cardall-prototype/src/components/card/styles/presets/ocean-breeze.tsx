// Ocean Breeze - Fresh natural style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const OceanBreezePreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: 'linear-gradient(90deg, #34d399 0%, #0d9488 100%)',
    color: '#ffffff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    borderRadius: '20px',
    boxShadow: '0 10px 15px -3px rgba(52, 211, 153, 0.3), 0 4px 6px -2px rgba(13, 148, 136, 0.1)',
    border: '1px solid rgba(52, 211, 153, 0.3)'
  }

  return (
    <StylePreviewCard
      title="Ocean Breeze"
      content="Fresh and refreshing"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const oceanBreezeStyle: StylePreset = {
  id: 'ocean-breeze',
  name: 'Ocean Breeze',
  category: 'natural',
  description: 'Fresh emerald to teal gradient with tropical vibes',
  style: {
    type: 'gradient',
    gradientColors: ['#34d399', '#0d9488'],
    gradientDirection: 'to-r',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'medium',
    textColor: '#ffffff',
    borderRadius: '2xl',
    shadow: 'lg',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)'
  },
  previewComponent: OceanBreezePreview
}

export default oceanBreezeStyle