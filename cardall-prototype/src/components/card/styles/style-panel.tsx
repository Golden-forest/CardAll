// Style selection panel component

import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { cn } from '../../../lib/utils'
import { StylePreset, StyleApplicationContext } from '../../../types/style'
import { styleRegistry, getAllStylePresets } from './style-registry'
import { stylePersistence } from './style-persistence'
import {
  AnimatedBackdrop,
  AnimatedPanel,
  AnimatedStyleGrid,
  AnimatedStylePreview,
  StyleApplicationAnimation,
  SuccessCheckmark
} from './style-animations'
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Animated Backdrop */}
          <AnimatedBackdrop onClick={handleClose} />
          
          {/* Animated Panel */}
          <AnimatedPanel>
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

            {/* Animated Style Grid - 2x4 Compact Layout */}
            <AnimatedStyleGrid>
              {stylePresets.map((preset) => {
                const PreviewComponent = preset.previewComponent
                return (
                  <AnimatedStylePreview 
                    key={preset.id} 
                    isSelected={selectedStyleId === preset.id}
                  >
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
                  </AnimatedStylePreview>
                )
              })}
            </AnimatedStyleGrid>

            {/* Footer Info */}
            <div className="text-xs text-gray-500 text-center">
              Click any style to apply it instantly to your card
            </div>
          </AnimatedPanel>
        </div>
      )}
    </AnimatePresence>
  )
}

export default StylePanel