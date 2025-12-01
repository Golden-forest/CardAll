// Dark Mode - Modern and sleek style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const DarkModePreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: '#1e293b',
    color: '#cbd5e1',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
  }

  return (
    <StylePreviewCard
      title="Dark Mode"
      content="Modern and sleek"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const darkModeStyle: StylePreset = {
  id: 'dark-mode',
  name: 'Dark Mode',
  category: 'dark',
  description: 'Modern and sleek dark background with high contrast text',
  style: {
    type: 'solid',
    backgroundColor: '#1e293b',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'normal',
    textColor: '#cbd5e1',
    titleColor: '#f8fafc',
    bodyTextColor: '#cbd5e1',
    borderRadius: '2xl',
    shadow: 'md'
  },
  previewComponent: DarkModePreview
}

export default darkModeStyle