// Neutral Gray - Clean and minimalist style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const NeutralGrayPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: '#f9fafb',
    color: '#374151',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  }

  return (
    <StylePreviewCard
      title="Neutral Gray"
      content="Clean and minimalist"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const neutralGrayStyle: StylePreset = {
  id: 'neutral-gray',
  name: 'Neutral Gray',
  category: 'minimalist',
  description: 'Clean and minimalist gray background with high contrast text',
  style: {
    type: 'solid',
    backgroundColor: '#f9fafb',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'normal',
    textColor: '#374151',
    titleColor: '#111827',
    bodyTextColor: '#374151',
    borderRadius: '2xl',
    shadow: 'md'
  },
  previewComponent: NeutralGrayPreview
}

export default neutralGrayStyle