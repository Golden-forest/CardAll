import React, { createContext, useContext, ReactNode } from 'react'
import { useCardsAdapter } from '@/hooks/use-cards-adapter'
import { useFolders } from '@/hooks/use-folders'
import { useTags } from '@/hooks/use-tags'
import { AppConfig } from '@/config/app-config'

/**
 * 卡片应用的全局上下文类型
 * 包含卡片、文件夹、标签和应用配置
 */
interface CardAllContextType {
  /** 卡片相关功能和状态 */
  cards: ReturnType<typeof useCardsAdapter>
  /** 文件夹相关功能和状态 */
  folders: ReturnType<typeof useFolders>
  /** 标签相关功能和状态 */
  tags: ReturnType<typeof useTags>
  /** 应用配置 */
  appConfig: typeof AppConfig
}

/**
 * 卡片应用的全局上下文
 * 提供应用的核心状态和功能
 */
const CardAllContext = createContext<CardAllContextType | null>(null)

/**
 * CardAllProvider组件的属性类型
 */
interface CardAllProviderProps {
  /** 子组件 */
  children: ReactNode
}

/**
 * 卡片应用的全局状态提供者
 * 整合卡片、文件夹和标签的状态管理
 * 
 * @example
 * ```tsx
 * <CardAllProvider>
 *   <App />
 * </CardAllProvider>
 * ```
 */
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