// Style selection panel component (Simplified Version)

import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { StylePreset, StyleApplicationContext } from '../../../types/style'
import { styleRegistry, getAllStylePresets } from './style-registry'
import { stylePersistence } from './style-persistence'
import './presets' // Auto-register all presets

interface StylePanelProps {
  isOpen: boolean
  onClose: () => void
  context: StyleApplicationContext
}

export const StylePanel: React.FC<StylePanelProps> = ({
  isOpen,
  onClose,
  context
}) => {
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null)
  const [stylePresets, setStylePresets] = useState<StylePreset[]>([])

  useEffect(() => {
    // Load all registered style presets
    const presets = getAllStylePresets()
    console.log('Loaded style presets:', presets.length, presets)
    setStylePresets(presets)

    // Set current style as selected if it matches a preset
    const currentPresetId = stylePersistence.getUserPreference(context.targetCardId)
    if (currentPresetId) {
      setSelectedStyleId(currentPresetId)
    }
  }, [context.targetCardId])

  const handleStyleSelect = (styleId: string) => {
    const preset = styleRegistry.getById(styleId)
    if (!preset) return

    setSelectedStyleId(styleId)
    
    // Apply style immediately (instant apply)
    context.onStyleApply(preset.style)
    
    // Save preference
    stylePersistence.saveUserPreference(context.targetCardId, styleId)
  }

  const handleClose = () => {
    setSelectedStyleId(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(2px)' }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0" 
        onClick={handleClose}
      />
      
      {/* Panel - Responsive sizing */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-full max-w-sm sm:max-w-md lg:max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Card Styles</h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Style Grid - 2x4 Compact Layout */}
        <div className="grid grid-cols-2 gap-3 mb-6" style={{ minHeight: '200px' }}>
          {stylePresets.map((preset) => {
            const PreviewComponent = preset.previewComponent
            console.log('Rendering preset:', preset.id, preset.name, PreviewComponent)
            
            return (
              <div key={preset.id} className="relative">
                <PreviewComponent
                  isSelected={selectedStyleId === preset.id}
                  onClick={() => handleStyleSelect(preset.id)}
                  className="w-full"
                />
                
                {/* Style Name */}
                <div className="mt-2 text-center">
                  <div className="text-xs font-medium text-gray-700 truncate">
                    {preset.name}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {preset.category}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Debug Info */}
        <div className="text-xs text-gray-400 text-center mb-2">
          Loaded {stylePresets.length} presets
        </div>

        {/* Footer Info */}
        <div className="text-xs text-gray-500 text-center">
          Click any style to apply it instantly to your card
        </div>
      </div>
    </div>
  )
}

export default StylePanel