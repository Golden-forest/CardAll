import { useState, useCallback, useEffect } from 'react'
import { Card, CardAction, CardFilter, ViewSettings } from '@/types/card'
import { db, DbCard } from '@/services/database-simple'
import { cloudSyncService } from '@/services/cloud-sync'
import { authService } from '@/services/auth'

// 转换数据库卡片到前端卡片格式
const dbCardToCard = (dbCard: DbCard): Card => {
  const { userId, syncVersion, lastSyncAt, pendingSync, ...card } = dbCard
  return {
    ...card,
    id: card.id || '',
    createdAt: new Date(card.createdAt),
    updatedAt: new Date(card.updatedAt)
  }
}

// 转换前端卡片到数据库格式
const cardToDbCard = (card: Card, userId?: string): DbCard => {
  return {
    ...card,
    userId,
    syncVersion: 1,
    pendingSync: true,
    updatedAt: new Date(card.updatedAt)
  }
}

// 获取当前用户ID
const getCurrentUserId = (): string | null => {
  const user = authService.getCurrentUser()
  return user?.id || null
}

export function useCards() {
  const [cards, setCards] = useState<Card[]>([])
  const [filter, setFilter] = useState<CardFilter>({
    searchTerm: '',
    tags: []
  })
  const [viewSettings, setViewSettings] = useState<ViewSettings>({
    layout: 'grid',
    cardSize: 'medium',
    showTags: true,
    showDates: false,
    sortBy: 'updated',
    sortOrder: 'desc'
  })
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 从数据库加载卡片
  const loadCards = useCallback(async () => {
    try {
      setIsLoading(true)
      const dbCards = await db.cards.toArray()
      const convertedCards = dbCards.map(dbCardToCard)
      setCards(convertedCards)
    } catch (error) {
      console.error('Failed to load cards:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 初始化时加载数据
  useEffect(() => {
    loadCards()
  }, [loadCards])

  // 监听数据库变化
  useEffect(() => {
    const subscription = db.cards.hook('creating', (primKey, obj, trans) => {
      console.log('Card creating:', primKey)
    })

    const updateSubscription = db.cards.hook('updating', (modifications, primKey, obj, trans) => {
      console.log('Card updating:', primKey)
    })

    const deleteSubscription = db.cards.hook('deleting', (primKey, obj, trans) => {
      console.log('Card deleting:', primKey)
    })

    return () => {
      subscription?.unsubscribe()
      updateSubscription?.unsubscribe()
      deleteSubscription?.unsubscribe()
    }
  }, [])

  // 过滤和排序卡片
  const filteredCards = useCallback(() => {
    let filtered = cards.filter(card => {
      // 搜索词过滤
      if (filter.searchTerm) {
        const searchLower = filter.searchTerm.toLowerCase()
        const matchesTitle = card.frontContent.title.toLowerCase().includes(searchLower) ||
                           card.backContent.title.toLowerCase().includes(searchLower)
        const matchesText = card.frontContent.text.toLowerCase().includes(searchLower) ||
                          card.backContent.text.toLowerCase().includes(searchLower)
        const matchesTags = [...card.frontContent.tags, ...card.backContent.tags]
                          .some(tag => tag.toLowerCase().includes(searchLower))
        
        if (!matchesTitle && !matchesText && !matchesTags) return false
      }

      // 标签过滤
      if (filter.tags.length > 0) {
        const cardTags = [...card.frontContent.tags, ...card.backContent.tags]
        if (!filter.tags.some(tag => cardTags.includes(tag))) return false
      }

      // 文件夹过滤
      if (filter.folderId && card.folderId !== filter.folderId) return false

      // 日期范围过滤
      if (filter.dateRange) {
        const cardDate = new Date(card.updatedAt)
        if (cardDate < filter.dateRange.start || cardDate > filter.dateRange.end) return false
      }

      // 样式类型过滤
      if (filter.styleType && card.style.type !== filter.styleType) return false

      // 是否有图片过滤
      if (filter.hasImages !== undefined) {
        const hasImages = card.frontContent.images.length > 0 || card.backContent.images.length > 0
        if (hasImages !== filter.hasImages) return false
      }

      return true
    })

    // 排序卡片
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (viewSettings.sortBy) {
        case 'created':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'updated':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          break
        case 'title':
          comparison = a.frontContent.title.localeCompare(b.frontContent.title)
          break
        default:
          comparison = 0
      }

      return viewSettings.sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [cards, filter, viewSettings])

  // 卡片操作
  const dispatch = useCallback(async (action: CardAction) => {
    const userId = getCurrentUserId()
    
    try {
      switch (action.type) {
        case 'CREATE_CARD': {
          const cardId = crypto.randomUUID()
          const newCardData = {
            ...action.payload,
            id: cardId,
            userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            syncVersion: 1,
            pendingSync: true
          }

          await db.cards.add(newCardData)
          
          // 添加到同步队列
          await cloudSyncService.queueOperation({
            type: 'create',
            table: 'cards',
            data: newCardData,
            localId: cardId
          })
          
          // 重新加载数据
          await loadCards()
          break
        }

        case 'UPDATE_CARD': {
          const updates = {
            ...action.payload.updates,
            userId,
            updatedAt: new Date(),
            syncVersion: 1,
            pendingSync: true
          }

          await db.cards.update(action.payload.id, updates)
          
          // 添加到同步队列
          await cloudSyncService.queueOperation({
            type: 'update',
            table: 'cards',
            data: { ...action.payload.updates, userId },
            localId: action.payload.id
          })
          
          await loadCards()
          break
        }

        case 'DELETE_CARD': {
          await db.cards.delete(action.payload)
          
          // 添加到同步队列
          await cloudSyncService.queueOperation({
            type: 'delete',
            table: 'cards',
            data: { userId },
            localId: action.payload
          })
          
          await loadCards()
          break
        }

        case 'FLIP_CARD': {
          const card = await db.cards.get(action.payload)
          if (card) {
            const updates = {
              isFlipped: !card.isFlipped,
              updatedAt: new Date(),
              syncVersion: (card.syncVersion || 0) + 1,
              pendingSync: true
            }

            await db.cards.update(action.payload, updates)
            
            // 添加到同步队列
            await cloudSyncService.queueOperation({
              type: 'update',
              table: 'cards',
              data: updates,
              localId: action.payload
            })
            
            await loadCards()
          }
          break
        }

        case 'SELECT_CARD':
          setSelectedCardIds(prev => 
            prev.includes(action.payload) 
              ? prev.filter(id => id !== action.payload)
              : [...prev, action.payload]
          )
          break

        case 'DESELECT_ALL':
          setSelectedCardIds([])
          break

        case 'DUPLICATE_CARD': {
          const originalCard = await db.cards.get(action.payload)
          if (originalCard) {
            const duplicatedCardId = crypto.randomUUID()
            const duplicatedCard: DbCard = {
              ...originalCard,
              id: duplicatedCardId,
              userId,
              createdAt: new Date(),
              updatedAt: new Date(),
              syncVersion: 1,
              pendingSync: true
            }

            await db.cards.add(duplicatedCard)
            
            // 添加到同步队列
            await cloudSyncService.queueOperation({
              type: 'create',
              table: 'cards',
              data: duplicatedCard,
              localId: duplicatedCardId
            })
            
            await loadCards()
          }
          break
        }

        case 'MOVE_TO_FOLDER': {
          const updates = {
            folderId: action.payload.folderId,
            userId,
            updatedAt: new Date(),
            syncVersion: 1,
            pendingSync: true
          }

          await db.cards.update(action.payload.cardId, updates)
          
          // 添加到同步队列
          await cloudSyncService.queueOperation({
            type: 'update',
            table: 'cards',
            data: updates,
            localId: action.payload.cardId
          })
          
          await loadCards()
          break
        }

        default:
          console.warn('Unknown card action:', action)
      }
    } catch (error) {
      console.error('Card operation failed:', error)
      throw error
    }
  }, [loadCards])

  // 工具函数
  const getCardById = useCallback((id: string) => {
    return cards.find(card => card.id === id)
  }, [cards])

  const getSelectedCards = useCallback(() => {
    return cards.filter(card => selectedCardIds.includes(card.id))
  }, [cards, selectedCardIds])

  const getAllTags = useCallback(() => {
    const tagSet = new Set<string>()
    cards.forEach(card => {
      card.frontContent.tags.forEach(tag => tagSet.add(tag))
      card.backContent.tags.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [cards])

  // 更新所有卡片中的标签
  const updateTagsInAllCards = useCallback(async (oldTagName: string, newTagName?: string) => {
    const userId = getCurrentUserId()
    
    try {
      const cardsWithTag = await db.cards
        .filter(card => 
          card.frontContent.tags.includes(oldTagName) || 
          card.backContent.tags.includes(oldTagName)
        )
        .toArray()

      for (const card of cardsWithTag) {
        const updateTags = (tags: string[]) => {
          if (newTagName) {
            return tags.map(tag => tag === oldTagName ? newTagName : tag)
          } else {
            return tags.filter(tag => tag !== oldTagName)
          }
        }

        const frontTags = updateTags(card.frontContent.tags)
        const backTags = updateTags(card.backContent.tags)

        const updates = {
          frontContent: {
            ...card.frontContent,
            tags: frontTags,
            lastModified: new Date()
          },
          backContent: {
            ...card.backContent,
            tags: backTags,
            lastModified: new Date()
          },
          userId,
          updatedAt: new Date(),
          syncVersion: (card.syncVersion || 0) + 1,
          pendingSync: true
        }

        await db.cards.update(card.id!, updates)
        
        // 添加到同步队列
        await cloudSyncService.queueOperation({
          type: 'update',
          table: 'cards',
          data: updates,
          localId: card.id!
        })
      }

      await loadCards()
    } catch (error) {
      console.error('Failed to update tags in cards:', error)
      throw error
    }
  }, [loadCards])

  const getCardsWithTag = useCallback((tagName: string) => {
    return cards.filter(card => 
      card.frontContent.tags.includes(tagName) || 
      card.backContent.tags.includes(tagName)
    )
  }, [cards])

  
  return {
    cards: filteredCards(),
    allCards: cards,
    filter,
    setFilter,
    viewSettings,
    setViewSettings,
    selectedCardIds,
    isLoading,
    dispatch,
    getCardById,
    getSelectedCards,
    getAllTags,
    updateTagsInAllCards,
    getCardsWithTag,
    loadCards
  }
}