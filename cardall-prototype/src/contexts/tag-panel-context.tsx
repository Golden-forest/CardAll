// Tag panel context for managing tag panel state

import { createContext, useContext, useState, ReactNode } from 'react'

interface TagPanelContextType {
  isOpen: boolean
  currentCardId: string | null
  currentCardTags: string[]
  onTagsChange: ((tags: string[]) => void) | null
  openTagPanel: (config: TagPanelConfig) => void
  closeTagPanel: () => void
}

interface TagPanelConfig {
  targetCardId: string
  currentTags: string[]
  onTagsApply: (tags: string[]) => void
  onPanelClose?: () => void
}

const TagPanelContext = createContext<TagPanelContextType | undefined>(undefined)

interface TagPanelProviderProps {
  children: ReactNode
}

export function TagPanelProvider({ children }: TagPanelProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentCardId, setCurrentCardId] = useState<string | null>(null)
  const [currentCardTags, setCurrentCardTags] = useState<string[]>([])
  const [onTagsChange, setOnTagsChange] = useState<((tags: string[]) => void) | null>(null)

  const openTagPanel = (config: TagPanelConfig) => {
    setCurrentCardId(config.targetCardId)
    setCurrentCardTags(config.currentTags)
    setOnTagsChange(() => config.onTagsApply)
    setIsOpen(true)
  }

  const closeTagPanel = () => {
    setIsOpen(false)
    setCurrentCardId(null)
    setCurrentCardTags([])
    setOnTagsChange(null)
  }

  const value: TagPanelContextType = {
    isOpen,
    currentCardId,
    currentCardTags,
    onTagsChange,
    openTagPanel,
    closeTagPanel
  }

  return (
    <TagPanelContext.Provider value={value}>
      {children}
    </TagPanelContext.Provider>
  )
}

export function useTagPanel() {
  const context = useContext(TagPanelContext)
  if (context === undefined) {
    throw new Error('useTagPanel must be used within a TagPanelProvider')
  }
  return context
}