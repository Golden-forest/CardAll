// Black White Classic - Timeless and professional style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const BlackWhiteClassicPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: '#ffffff',
    color: '#333333',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  }

  return (
    <StylePreviewCard
      title="Black White Classic"
      content="Timeless and professional"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const blackWhiteClassicStyle: StylePreset = {
  id: 'black-white-classic',
  name: 'Black White Classic',
  category: 'classic',
  description: 'Timeless and professional black and white background with high contrast text',
  style: {
    type: 'solid',
    backgroundColor: '#ffffff',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'normal',
    textColor: '#333333',
    titleColor: '#000000',
    bodyTextColor: '#333333',
    borderRadius: '2xl',
    shadow: 'md'
  },
  previewComponent: BlackWhiteClassicPreview
}

export default blackWhiteClassicStyle