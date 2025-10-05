// Gradient Mesh - Creative style with dynamic gradient background

import React from 'react'
import { StylePreset, StylePreviewProps } from '../../../../types/style'
import { StylePreviewCard } from '../style-preview'

const GradientMeshPreview: React.FC<StylePreviewProps> = ({ isSelected, onClick, className }) => {
  const style: React.CSSProperties = {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)',
    backgroundSize: '400% 400%',
    animation: 'gradientShift 8s ease infinite',
    color: '#ffffff',
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3), 0 4px 16px rgba(118, 75, 162, 0.2)',
    border: 'none',
    position: 'relative',
    overflow: 'hidden'
  }

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(45deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
    pointerEvents: 'none'
  }

  return (
    <div style={{ position: 'relative' }}>
      <StylePreviewCard
        title="Gradient Mesh"
        content="Dynamic gradient background"
        style={style}
        isSelected={isSelected}
        onClick={onClick}
        className={className}
      />
      <div style={overlayStyle} />
      <style jsx>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  )
}

export const gradientMeshStyle: StylePreset = {
  id: 'gradient-mesh',
  name: 'Gradient Mesh',
  category: 'creative',
  description: 'Dynamic gradient background with animated mesh effect',
  style: {
    type: 'solid', // Use solid type but with gradient in backgroundColor
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)',
    fontFamily: 'Inter',
    fontSize: 'base',
    fontWeight: 'medium',
    textColor: '#ffffff',
    borderRadius: '2xl',
    shadow: 'xl',
    borderWidth: 0,
    borderColor: 'transparent'
  },
  previewComponent: GradientMeshPreview
}

export default gradientMeshStyle