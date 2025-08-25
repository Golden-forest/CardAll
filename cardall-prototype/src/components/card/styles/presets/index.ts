// Auto-registration index for all style presets

import { styleRegistry } from '../style-registry'

// Import all style presets
import classicWhiteStyle from './classic-white'
import modernBlueStyle from './modern-blue'
import elegantPurpleStyle from './elegant-purple'
import warmOrangeStyle from './warm-orange'
import freshGreenStyle from './fresh-green'
import softPinkStyle from './soft-pink'
import deepDarkStyle from './deep-dark'
import gradientSunsetStyle from './gradient-sunset'

// Register all styles
const registerAllStyles = () => {
  const styles = [
    classicWhiteStyle,
    modernBlueStyle,
    elegantPurpleStyle,
    warmOrangeStyle,
    freshGreenStyle,
    softPinkStyle,
    deepDarkStyle,
    gradientSunsetStyle
  ]

  styles.forEach(style => {
    styleRegistry.register(style)
  })

  console.log(`Registered ${styles.length} card style presets`)
}

// Auto-register on import
registerAllStyles()

// Export all styles for direct access if needed
export {
  classicWhiteStyle,
  modernBlueStyle,
  elegantPurpleStyle,
  warmOrangeStyle,
  freshGreenStyle,
  softPinkStyle,
  deepDarkStyle,
  gradientSunsetStyle
}

export default registerAllStyles