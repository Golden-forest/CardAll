// Fresh Mint - Clean and refreshing style

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const FreshMintPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: '#f0fdf4',
    color: '#166534',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  }

  return (
    <StylePreviewCard
      title="Fresh Mint"
      content="Clean and refreshing"
      style={style}
      isSelected={isSelected}
      onClick={onClick}
      className={className}
    />
  )
}

export const freshMintStyle: StylePreset = {
  id: 'fresh-mint',
  name: 'Fresh Mint',
  category: 'nature',
  description: 'Clean and refreshing mint green background with high contrast text',
  style: {
    type: 'solid',
    backgroundColor: '#f0fdf4',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'normal',
    textColor: '#166534',
    titleColor: '#15803d',
    bodyTextColor: '#166534',
    borderRadius: '2xl',
    shadow: 'md'
  },
  previewComponent: FreshMintPreview
}

export default freshMintStyle