import React, { createContext, useContext, ReactNode, useEffect } from 'react'
import { useCardsAdapter } from '@/hooks/use-cards-adapter'
import { useFolders } from '@/hooks/use-folders'
import { useTags } from '@/hooks/use-tags'

interface CardAllContextType {
  cards: ReturnType<typeof useCardsAdapter>
  folders: ReturnType<typeof useFolders>
  tags: ReturnType<typeof useTags>
}

const CardAllContext = createContext<CardAllContextType | null>(null)

interface CardAllProviderProps {
  children: ReactNode
}

export function CardAllProvider({ children }: CardAllProviderProps) {
  const cards = useCardsAdapter()
  const folders = useFolders()
  const tags = useTags()

  // Sync tags with card data (only when ready and not migrating)
  useEffect(() => {
    if (cards.isReady && !cards.isMigrating) {
      const allCardTags: string[] = []
      cards.allCards.forEach(card => {
        allCardTags.push(...card.frontContent.tags, ...card.backContent.tags)
      })
      tags.syncTagsWithCards(allCardTags)
    }
  }, [cards.allCards, cards.isReady, cards.isMigrating, tags.syncTagsWithCards])

  const value: CardAllContextType = {
    cards,
    folders,
    tags
  }

  return (
    <CardAllContext.Provider value={value}>
      {children}
    </CardAllContext.Provider>
  )
}

export function useCardAll() {
  const context = useContext(CardAllContext)
  if (!context) {
    throw new Error('useCardAll must be used within a CardAllProvider')
  }
  // Return a stable object reference to avoid Fast Refresh issues
  return {
    cards: context.cards,
    folders: context.folders,
    tags: context.tags
  }
}

// Individual hook exports for convenience - ensure stable exports
export function useCardAllCards() {
  const context = useContext(CardAllContext)
  if (!context) {
    throw new Error('useCardAllCards must be used within a CardAllProvider')
  }
  return context.cards
}

export function useCardAllFolders() {
  const context = useContext(CardAllContext)
  if (!context) {
    throw new Error('useCardAllFolders must be used within a CardAllProvider')
  }
  return context.folders
}

export function useCardAllTags() {
  const context = useContext(CardAllContext)
  if (!context) {
    throw new Error('useCardAllTags must be used within a CardAllProvider')
  }
  return context.tags
}

