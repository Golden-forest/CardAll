export interface ImageData {
  id: string
  url: string
  alt: string
  width?: number
  height?: number
  position?: { x: number; y: number }
}

export interface CardContent {
  title: string
  text: string
  images: ImageData[]
  tags: string[]
}

export interface Card {
  id: string
  frontContent: CardContent
  backContent: CardContent
  theme: {
    type: 'solid' | 'gradient'
    style: string
  }
  isFlipped: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
  createdAt: Date
  updatedAt: Date
  folderId?: string
}

export interface Folder {
  id: string
  name: string
  color: string
  cardIds: string[]
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
}