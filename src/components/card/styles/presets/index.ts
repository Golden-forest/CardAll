// Auto-registration index for all style presets

import { styleRegistry } from '../style-registry'

// Import all style presets
import classicWhiteStyle from './classic-white'
import modernBlueStyle from './modern-blue'
import elegantPurpleStyle from './elegant-purple'
import warmOrangeStyle from './warm-orange'
import freshGreenStyle from './fresh-green'
import softPinkStyle from './soft-pink'
import oceanBreezeStyle from './ocean-breeze'
import deepDarkStyle from './deep-dark'
import gradientSunsetStyle from './gradient-sunset'
import gradientMeshStyle from './gradient-mesh'
import gradientWaveStyle from './gradient-wave'
import movingGradientStyle from './moving-gradient'
// New styles
import freshMintStyle from './fresh-mint'
import elegantPinkStyle from './elegant-pink'
import calmCyanStyle from './calm-cyan'
import vibrantYellowStyle from './vibrant-yellow'
import deepPurpleGradientStyle from './deep-purple-gradient'
import blueGreenGradientStyle from './blue-green-gradient'
import pinkOrangeGradientStyle from './pink-orange-gradient'
import greenBlueGradientStyle from './green-blue-gradient'
import blackWhiteClassicStyle from './black-white-classic'
import darkModeStyle from './dark-mode'

// Register all styles
const registerAllStyles = () => {
  const styles = [
    classicWhiteStyle,
    modernBlueStyle,
    elegantPurpleStyle,
    warmOrangeStyle,
    freshGreenStyle,
    softPinkStyle,
    oceanBreezeStyle,
    deepDarkStyle,
    gradientSunsetStyle,
    gradientMeshStyle,
    gradientWaveStyle,
    movingGradientStyle,
    // New styles
    freshMintStyle,
    elegantPinkStyle,
    calmCyanStyle,
    vibrantYellowStyle,
    deepPurpleGradientStyle,
    blueGreenGradientStyle,
    pinkOrangeGradientStyle,
    greenBlueGradientStyle,
    blackWhiteClassicStyle,
    darkModeStyle
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
  oceanBreezeStyle,
  deepDarkStyle,
  gradientSunsetStyle,
  gradientMeshStyle,
  gradientWaveStyle,
  movingGradientStyle,
  // New styles
  freshMintStyle,
  elegantPinkStyle,
  calmCyanStyle,
  vibrantYellowStyle,
  deepPurpleGradientStyle,
  blueGreenGradientStyle,
  pinkOrangeGradientStyle,
  greenBlueGradientStyle,
  blackWhiteClassicStyle,
  darkModeStyle
}

export default registerAllStyles