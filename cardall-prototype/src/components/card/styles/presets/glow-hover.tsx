// Glow Hover - Dynamic style with hover glow effect

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const GlowHoverPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: '#0f172a',
    color: '#e2e8f0',
    fontFamily: '"Montserrat", system-ui, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    borderRadius: '16px',
    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.2)',
    border: '1px solid #334155',
    position: 'relative',
    overflow: 'hidden'
  }

  return (
    <div className="relative">
      <StylePreviewCard
        title="Glow Hover"
        content="Interactive glow effect"
        style={style}
        isSelected={isSelected}
        onClick={onClick}
        className={`${className} glow-hover-animation`}
      />
    </div>
  )
}

export const glowHoverStyle: StylePreset = {
  id: 'glow-hover',
  name: 'Glow Hover',
  category: 'personality',
  description: 'Dark theme with interactive glow effect on hover',
  style: {
    type: 'solid',
    backgroundColor: '#0f172a',
    fontFamily: 'Montserrat',
    fontSize: 'base',
    fontWeight: 'medium',
    textColor: '#e2e8f0',
    borderRadius: 'xl',
    shadow: 'lg',
    borderWidth: 1,
    borderColor: '#334155'
  },
  previewComponent: GlowHoverPreview
}

export default glowHoverStyle