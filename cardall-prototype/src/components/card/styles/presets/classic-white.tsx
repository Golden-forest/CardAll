// Classic White - Professional business style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const ClassicWhitePreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: '#ffffff',
    color: '#1f2937',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    border: '1px solid #e5e7eb'
  }

  return (
    <StylePreviewCard
      title="Classic White"
      content="Clean and professional"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const classicWhiteStyle: StylePreset = {
  id: 'classic-white',
  name: 'Classic White',
  category: 'business',
  description: 'Clean and professional white background with subtle shadows',
  style: {
    type: 'solid',
    backgroundColor: '#ffffff',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'normal',
    textColor: '#1f2937',
    borderRadius: '2xl',
    shadow: 'md',
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  previewComponent: ClassicWhitePreview
}

export default classicWhiteStyle