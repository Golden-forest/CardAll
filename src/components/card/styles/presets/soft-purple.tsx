// Soft Purple - Elegant and modern style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const SoftPurplePreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: '#faf5ff',
    color: '#6b21a8',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  }

  return (
    <StylePreviewCard
      title="Soft Purple"
      content="Elegant and modern"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const softPurpleStyle: StylePreset = {
  id: 'soft-purple',
  name: 'Soft Purple',
  category: 'modern',
  description: 'Elegant and modern purple background with high contrast text',
  style: {
    type: 'solid',
    backgroundColor: '#faf5ff',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'normal',
    textColor: '#6b21a8',
    titleColor: '#7c3aed',
    bodyTextColor: '#6b21a8',
    borderRadius: '2xl',
    shadow: 'md'
  },
  previewComponent: SoftPurplePreview
}

export default softPurpleStyle