import React, { createContext, useContext, ReactNode } from 'react'
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
  React.useEffect(() => {
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
  return context
}

// Individual hook exports for convenience
export function useCardAllCards() {
  return useCardAll().cards
}

export function useCardAllFolders() {
  return useCardAll().folders
}

export function useCardAllTags() {
  return useCardAll().tags
}