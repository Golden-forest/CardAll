// Core data models for CardAll platform
export interface ImageData {
  id: string
  url: string
  alt: string
  width?: number
  height?: number
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  aspectRatio?: number
}

export interface TodoItem {
  id: string
  text: string
  completed: boolean
}

export interface CardContent {
  title: string
  text: string
  images: ImageData[]
  tags: string[]
  todos: TodoItem[]
  lastModified: Date
}

export interface CardStyle {
  type: 'solid' | 'gradient' | 'glass'
  backgroundColor?: string
  gradientColors?: string[]
  gradientDirection?: 'to-r' | 'to-br' | 'to-b' | 'to-bl' | 'to-l' | 'to-tl' | 'to-t' | 'to-tr'
  fontFamily?: string
  fontSize?: 'sm' | 'base' | 'lg' | 'xl'
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold'
  textColor?: string
  titleColor?: string
  bodyTextColor?: string
  borderRadius?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'glass'
  borderWidth?: number
  borderColor?: string
}

export interface Card {
  id: string
  frontContent: CardContent
  backContent: CardContent
  style: CardStyle
  isFlipped: boolean
  createdAt: Date
  updatedAt: Date
  folderId?: string
  isSelected?: boolean
}

export interface CardGroup {
  id: string
  cardIds: string[]
  position: { x: number; y: number }
  createdAt: Date
}

export interface Folder {
  id: string
  name: string
  color: string
  icon?: string
  cardIds: string[]
  parentId?: string // For nested folders
  isExpanded?: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Tag {
  id: string
  name: string
  color: string
  count: number
  isHidden?: boolean
  createdAt: Date
}

export interface CardFilter {
  searchTerm: string
  tags: string[]
  dateRange?: {
    start: Date
    end: Date
  }
  folderId?: string
  styleType?: 'solid' | 'gradient'
  hasImages?: boolean
  isFlipped?: boolean
}

export interface ViewSettings {
  layout: 'grid' | 'masonry' | 'list'
  cardSize: 'small' | 'medium' | 'large'
  showTags: boolean
  showDates: boolean
  sortBy: 'created' | 'updated' | 'title' | 'custom'
  sortOrder: 'asc' | 'desc'
}


export interface ClipboardData {
  type: 'text' | 'image' | 'mixed'
  content: string
  images?: File[]
}

export interface ExportOptions {
  format: 'png' | 'jpg' | 'pdf' | 'json'
  quality?: number
  includeBackSide?: boolean
  includeMetadata?: boolean
  cardIds?: string[] // For batch export
}

// Action types for state management
export type CardAction = 
  | { type: 'CREATE_CARD'; payload: Omit<Card, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_CARD'; payload: { id: string; updates: Partial<Card> } }
  | { type: 'DELETE_CARD'; payload: string }
  | { type: 'FLIP_CARD'; payload: string }
  | { type: 'SELECT_CARD'; payload: string }
  | { type: 'DESELECT_ALL' }
  | { type: 'DUPLICATE_CARD'; payload: string }
  | { type: 'MOVE_TO_FOLDER'; payload: { cardId: string; folderId?: string } }

export type FolderAction =
  | { type: 'CREATE_FOLDER'; payload: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_FOLDER'; payload: { id: string; updates: Partial<Folder> } }
  | { type: 'DELETE_FOLDER'; payload: string; onDeleteCards?: (cardIds: string[]) => void }
  | { type: 'TOGGLE_FOLDER'; payload: string }

export type TagAction =
  | { type: 'CREATE_TAG'; payload: Omit<Tag, 'id' | 'count' | 'createdAt'> }
  | { type: 'UPDATE_TAG'; payload: { id: string; updates: Partial<Tag> } }
  | { type: 'DELETE_TAG'; payload: string }
  | { type: 'TOGGLE_TAG_VISIBILITY'; payload: string }

// Utility types
export type CardPosition = 'front' | 'back'
export type SnapDirection = 'top' | 'right' | 'bottom' | 'left'
export type ThemeMode = 'light' | 'dark' | 'system'

// Constants
export const CARD_STYLES = {
  SOLID_COLORS: [
    '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1',
    '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b',
    '#0f172a', '#fef2f2', '#fee2e2', '#fecaca', '#f87171',
    '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d',
    '#fefce8', '#fef3c7', '#fde68a', '#fcd34d', '#f59e0b',
    '#d97706', '#b45309', '#92400e', '#78350f', '#f0fdf4',
    '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e',
    '#16a34a', '#15803d', '#166534', '#14532d'
  ],
  GRADIENTS: [
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140'],
    ['#a8edea', '#fed6e3'],
    ['#ff9a9e', '#fecfef'],
    ['#ffecd2', '#fcb69f'],
    ['#a18cd1', '#fbc2eb'],
    ['#fad0c4', '#ffd1ff']
  ]
} as const

export const DEFAULT_CARD_STYLE: CardStyle = {
  type: 'solid',
  backgroundColor: '#ffffff',
  fontFamily: 'system-ui',
  fontSize: 'base',
  fontWeight: 'normal',
  textColor: '#1f2937',
  borderRadius: 'xl',
  shadow: 'md',
  borderWidth: 0
}

export const SNAP_THRESHOLD = 20 // pixels
export const CARD_MIN_SIZE = { width: 200, height: 150 }
export const CARD_MAX_SIZE = { width: 600, height: 800 }