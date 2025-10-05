// Utility functions for applying card styles

import { CardStyle } from '../../../types/card'

/**
 * Convert CardStyle to CSS properties for direct application
 */
export const cardStyleToCSSProperties = (style: CardStyle): React.CSSProperties => {
  const baseStyles: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize === 'sm' ? '0.875rem' : 
              style.fontSize === 'lg' ? '1.125rem' : 
              style.fontSize === 'xl' ? '1.25rem' : '1rem',
    fontWeight: style.fontWeight === 'normal' ? 400 :
                style.fontWeight === 'medium' ? 500 :
                style.fontWeight === 'semibold' ? 600 :
                style.fontWeight === 'bold' ? 700 : 400,
    color: style.textColor,
    borderWidth: style.borderWidth || 0,
    borderColor: style.borderColor,
    borderStyle: style.borderWidth ? 'solid' : 'none'
  }

  // Handle border radius
  const borderRadiusMap: Record<string, string> = {
    'sm': '0.25rem',
    'md': '0.5rem', 
    'lg': '0.75rem',
    'xl': '1rem',
    '2xl': '1.5rem',
    '3xl': '2rem'
  }
  baseStyles.borderRadius = borderRadiusMap[style.borderRadius || 'xl'] || '1rem'

  // Handle background
  if (style.type === 'gradient' && style.gradientColors && style.gradientColors.length > 0) {
    const direction = style.gradientDirection || 'to-br'
    const directionMap: Record<string, string> = {
      'to-r': 'to right',
      'to-br': '135deg',
      'to-b': 'to bottom',
      'to-bl': '225deg',
      'to-l': 'to left',
      'to-tl': '315deg',
      'to-t': 'to top',
      'to-tr': '45deg'
    }
    const cssDirection = directionMap[direction] || '135deg'
    baseStyles.background = `linear-gradient(${cssDirection}, ${style.gradientColors.join(', ')})`
  } else {
    baseStyles.backgroundColor = style.backgroundColor
  }

  return baseStyles
}

/**
 * Get Tailwind shadow class from style shadow property
 */
export const getShadowClass = (shadow?: string): string => {
  const shadowClasses: Record<string, string> = {
    'none': '',
    'sm': 'shadow-sm',
    'md': 'shadow-md',
    'lg': 'shadow-lg',
    'xl': 'shadow-xl',
    '2xl': 'shadow-2xl'
  }
  return shadowClasses[shadow || 'md'] || 'shadow-md'
}

/**
 * Generate complete card styling including CSS properties and Tailwind classes
 */
export const generateCardStyling = (style: CardStyle) => {
  return {
    style: cardStyleToCSSProperties(style),
    shadowClass: getShadowClass(style.shadow),
    className: getShadowClass(style.shadow)
  }
}

/**
 * Check if two card styles are equal
 */
export const areStylesEqual = (style1: CardStyle, style2: CardStyle): boolean => {
  return JSON.stringify(style1) === JSON.stringify(style2)
}

/**
 * Merge card styles with new style overrides
 */
export const mergeCardStyles = (baseStyle: CardStyle, overrides: Partial<CardStyle>): CardStyle => {
  return {
    ...baseStyle,
    ...overrides,
    // Handle gradient colors array merge
    gradientColors: overrides.gradientColors || baseStyle.gradientColors
  }
}