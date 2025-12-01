// Style selection system types for CardAll platform

import { CardStyle } from './card'

// Extended style preset interface for template system
export interface StylePreset {
  id: string
  name: string
  category: 'business' | 'creative' | 'natural' | 'personality' | 'gradient' | 'nature' | 'modern' | 'warm' | 'classic' | 'dark' | 'minimalist'
  description: string
  style: CardStyle
  previewComponent: React.ComponentType<StylePreviewProps>
  thumbnail?: string
}

// Props for style preview components
export interface StylePreviewProps {
  isSelected?: boolean
  onClick?: () => void
  className?: string
}

// Style panel configuration
export interface StylePanelConfig {
  layout: 'compact' | 'standard' | 'expanded'
  gridColumns: number
  gridRows: number
  showCategories: boolean
  enableInstantApply: boolean
}

// Style application context
export interface StyleApplicationContext {
  targetCardId: string
  currentStyle: CardStyle
  onStyleApply: (style: CardStyle) => void
  onPanelClose: () => void
}

// Style registry for managing all available styles
export interface StyleRegistry {
  presets: Map<string, StylePreset>
  categories: Map<string, StylePreset[]>
  register: (preset: StylePreset) => void
  unregister: (id: string) => void
  getByCategory: (category: string) => StylePreset[]
  getById: (id: string) => StylePreset | undefined
  getAll: () => StylePreset[]
}

// Style persistence interface
export interface StylePersistence {
  saveUserPreference: (cardId: string, styleId: string) => void
  getUserPreference: (cardId: string) => string | null
  getRecentStyles: (limit?: number) => string[]
  clearPreferences: () => void
}

// Style panel state management
export interface StylePanelState {
  isOpen: boolean
  selectedStyleId: string | null
  targetCardId: string | null
  config: StylePanelConfig
}

export type StylePanelAction =
  | { type: 'OPEN_PANEL'; payload: { cardId: string; currentStyleId?: string } }
  | { type: 'CLOSE_PANEL' }
  | { type: 'SELECT_STYLE'; payload: string }
  | { type: 'APPLY_STYLE'; payload: { cardId: string; styleId: string } }
  | { type: 'UPDATE_CONFIG'; payload: Partial<StylePanelConfig> }

// Enhanced card style with preset information
export interface EnhancedCardStyle extends CardStyle {
  presetId?: string
  customizations?: Partial<CardStyle>
  appliedAt?: Date
}

// Style animation configuration
export interface StyleAnimationConfig {
  duration: number
  easing: string
  enableTransitions: boolean
  staggerDelay?: number
}

// Default configurations
export const DEFAULT_STYLE_PANEL_CONFIG: StylePanelConfig = {
  layout: 'compact',
  gridColumns: 2,
  gridRows: 4,
  showCategories: false,
  enableInstantApply: true
}

export const DEFAULT_STYLE_ANIMATION_CONFIG: StyleAnimationConfig = {
  duration: 200,
  easing: 'ease-out',
  enableTransitions: true,
  staggerDelay: 50
}

// Style categories metadata
export const STYLE_CATEGORIES = {
  business: {
    name: 'Business',
    description: 'Professional and clean styles for work',
    icon: 'briefcase'
  },
  creative: {
    name: 'Creative',
    description: 'Vibrant and artistic styles for inspiration',
    icon: 'palette'
  },
  natural: {
    name: 'Natural',
    description: 'Soft and organic styles for harmony',
    icon: 'leaf'
  },
  personality: {
    name: 'Personality',
    description: 'Bold and unique styles for expression',
    icon: 'star'
  },
  gradient: {
    name: 'Gradient',
    description: 'Beautiful gradient backgrounds with smooth transitions',
    icon: 'gradient'
  },
  nature: {
    name: 'Nature',
    description: 'Styles inspired by the natural world',
    icon: 'tree'
  },
  modern: {
    name: 'Modern',
    description: 'Clean and contemporary styles',
    icon: 'layout'
  },
  warm: {
    name: 'Warm',
    description: 'Cozy and inviting warm color schemes',
    icon: 'sun'
  },
  classic: {
    name: 'Classic',
    description: 'Timeless and elegant styles',
    icon: 'crown'
  },
  dark: {
    name: 'Dark',
    description: 'Sleek and modern dark themes',
    icon: 'moon'
  },
  minimalist: {
    name: 'Minimalist',
    description: 'Simple and clean minimalist designs',
    icon: 'square'
  }
} as const

// Utility types
export type StyleCategory = keyof typeof STYLE_CATEGORIES
export type StylePresetId = string
export type StyleApplicationResult = {
  success: boolean
  error?: string
  appliedStyle?: CardStyle
}

// Constants for style system
export const STYLE_CONSTANTS = {
  MAX_RECENT_STYLES: 10,
  ANIMATION_DURATION: 200,
  PANEL_Z_INDEX: 1000,
  PREVIEW_CARD_SIZE: { width: 120, height: 80 },
  GRID_GAP: 8,
  PANEL_PADDING: 16
} as const