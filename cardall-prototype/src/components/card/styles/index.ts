// Style system exports

export { StylePanel } from './style-panel'
export { StyleTriggerButton } from './style-trigger-button'
export { StylePreviewCard } from './style-preview'
export { 
  styleRegistry, 
  registerStylePreset, 
  getStylePreset, 
  getAllStylePresets, 
  getStylePresetsByCategory 
} from './style-registry'
export { 
  stylePersistence,
  saveCardStylePreference,
  getCardStylePreference,
  getRecentCardStyles,
  clearAllStylePreferences
} from './style-persistence'
export {
  cardStyleToCSSProperties,
  getShadowClass,
  generateCardStyling,
  areStylesEqual,
  mergeCardStyles
} from './style-utils'

// Import presets to auto-register
import './presets'

// Export all style presets
export {
  classicWhiteStyle,
  modernBlueStyle,
  elegantPurpleStyle,
  warmOrangeStyle,
  freshGreenStyle,
  softPinkStyle,
  deepDarkStyle,
  gradientSunsetStyle
} from './presets'

// Export enhanced flip card
export { EnhancedFlipCard } from '../enhanced-flip-card'