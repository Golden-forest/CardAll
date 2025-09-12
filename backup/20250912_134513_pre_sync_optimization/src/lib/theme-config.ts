export const themeConfig = {
  colors: {
    // Card styles - Solid backgrounds
    solid: {
      primary: 'bg-slate-900 text-white',
      secondary: 'bg-blue-600 text-white', 
      accent: 'bg-purple-600 text-white',
      success: 'bg-green-600 text-white',
      warning: 'bg-amber-600 text-white',
      danger: 'bg-red-600 text-white'
    },
    // Card styles - Gradient backgrounds
    gradient: {
      sunset: 'bg-gradient-to-br from-orange-400 via-red-500 to-pink-500 text-white',
      ocean: 'bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 text-white',
      forest: 'bg-gradient-to-br from-green-400 via-green-500 to-emerald-600 text-white',
      purple: 'bg-gradient-to-br from-purple-400 via-purple-500 to-indigo-600 text-white',
      gold: 'bg-gradient-to-br from-yellow-400 via-orange-400 to-red-500 text-white',
      cyber: 'bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 text-white'
    }
  },
  shadows: {
    card: 'shadow-lg hover:shadow-xl transition-shadow duration-300',
    cardHover: 'shadow-2xl',
    button: 'shadow-md hover:shadow-lg transition-shadow duration-200'
  },
  animations: {
    flip: 'transition-transform duration-700 transform-style-preserve-3d',
    hover: 'hover:scale-105 transition-transform duration-200',
    drag: 'transition-all duration-200 ease-in-out'
  }
}

export type CardStyle = keyof typeof themeConfig.colors.solid | keyof typeof themeConfig.colors.gradient
export type StyleType = 'solid' | 'gradient'

export interface CardTheme {
  type: StyleType
  style: CardStyle
}