import React, { createContext, useContext, ReactNode } from 'react'
import { useCardsAdapter } from '@/hooks/use-cards-adapter'
import { useFolders } from '@/hooks/use-folders'
import { useTags } from '@/hooks/use-tags'
import { AppConfig } from '@/config/app-config'

interface CardAllContextType {
  cards: ReturnType<typeof useCardsAdapter>
  folders: ReturnType<typeof useFolders>
  tags: ReturnType<typeof useTags>
  appConfig: typeof AppConfig
}

const CardAllContext = createContext<CardAllContextType | null>(null)

interface CardAllProviderProps {
  children: ReactNode
}

export function CardAllProvider({ children }: CardAllProviderProps) {
  const cards = useCardsAdapter()
  const folders = useFolders()
  const tags = useTags()

  // 优化标签同步，使用useMemo减少计算
  const allCardTags = React.useMemo(() => {
    if (!cards.isReady || cards.isMigrating) return []

    const tags: string[] = []
    cards.allCards.forEach(card => {
      tags.push(...card.frontContent.tags, ...card.backContent.tags)
    })
    return tags
  }, [cards.allCards, cards.isReady, cards.isMigrating])

  // 同步标签与卡片数据
  React.useEffect(() => {
    if (allCardTags.length > 0) {
      tags.syncTagsWithCards(allCardTags)
    }
  }, [allCardTags, tags.syncTagsWithCards])

  const value: CardAllContextType = {
    cards,
    folders,
    tags,
    appConfig: AppConfig
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