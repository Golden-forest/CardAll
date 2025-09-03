// Pulse Border - Dynamic style with pulsing border effect

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const PulseBorderPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: '#1a1a2e',
    color: '#ffffff',
    fontFamily: '"Inter", system-ui, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    borderRadius: '16px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
    border: '2px solid #4361ee',
    position: 'relative',
    overflow: 'hidden'
  }

  return (
    <div className="relative">
      <StylePreviewCard
        title="Pulse Border"
        content="Animated border effect"
        style={style}
        isSelected={isSelected}
        onClick={onClick}
        className={`${className} pulse-border-animation`}
      />
    </div>
  )
}

export const pulseBorderStyle: StylePreset = {
  id: 'pulse-border',
  name: 'Pulse Border',
  category: 'personality',
  description: 'Dark background with pulsing border animation',
  style: {
    type: 'solid',
    backgroundColor: '#1a1a2e',
    fontFamily: 'Inter',
    fontSize: 'base',
    fontWeight: 'medium',
    textColor: '#ffffff',
    borderRadius: 'xl',
    shadow: 'xl',
    borderWidth: 2,
    borderColor: '#4361ee'
  },
  previewComponent: PulseBorderPreview
}

export default pulseBorderStyle