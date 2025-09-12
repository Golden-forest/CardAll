import { useState, useCallback, useEffect } from 'react'
import { Card, CardAction, CardFilter, ViewSettings } from '@/types/card'

// Mock data for development
const mockCards: Card[] = [
  {
    id: '1',
    frontContent: {
      title: 'React Best Practices',
      text: 'Key principles for writing maintainable React code including component composition, state management, and performance optimization.',
      images: [],
      tags: ['react', 'frontend', 'best-practices'],
      lastModified: new Date()
    },
    backContent: {
      title: 'Implementation Details',
      text: 'Use functional components with hooks, implement proper error boundaries, optimize with React.memo and useMemo for expensive calculations.',
      images: [],
      tags: ['react', 'frontend', 'best-practices'],
      lastModified: new Date()
    },
    style: {
      type: 'solid',
      backgroundColor: '#f8fafc',
      fontFamily: 'system-ui',
      fontSize: 'base',
      fontWeight: 'normal',
      textColor: '#1f2937',
      borderRadius: 'xl',
      shadow: 'md',
      borderWidth: 0
    },
    isFlipped: false,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15')
  },
  {
    id: '2',
    frontContent: {
      title: 'TypeScript Tips',
      text: 'Advanced TypeScript patterns for better type safety and developer experience in large applications.',
      images: [],
      tags: ['typescript', 'types', 'development'],
      lastModified: new Date()
    },
    backContent: {
      title: 'Advanced Patterns',
      text: 'Utility types, conditional types, mapped types, and template literal types for complex type transformations.',
      images: [],
      tags: ['typescript', 'types', 'development'],
      lastModified: new Date()
    },
    style: {
      type: 'gradient',
      gradientColors: ['#667eea', '#764ba2'],
      gradientDirection: 'to-br',
      fontFamily: 'system-ui',
      fontSize: 'base',
      fontWeight: 'medium',
      textColor: '#ffffff',
      borderRadius: 'xl',
      shadow: 'lg',
      borderWidth: 0
    },
    isFlipped: false,
    createdAt: new Date('2024-01-16'),
    updatedAt: new Date('2024-01-16')
  }
]

export function useCards() {
  const [cards, setCards] = useState<Card[]>(mockCards)
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

  // Filter and sort cards
  const filteredCards = useCallback(() => {
    let filtered = cards.filter(card => {
      // Search term filter
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

      // Tags filter
      if (filter.tags.length > 0) {
        const cardTags = [...card.frontContent.tags, ...card.backContent.tags]
        if (!filter.tags.some(tag => cardTags.includes(tag))) return false
      }

      // Folder filter
      if (filter.folderId && card.folderId !== filter.folderId) return false

      // Date range filter
      if (filter.dateRange) {
        const cardDate = new Date(card.updatedAt)
        if (cardDate < filter.dateRange.start || cardDate > filter.dateRange.end) return false
      }

      // Style type filter
      if (filter.styleType && card.style.type !== filter.styleType) return false

      // Has images filter
      if (filter.hasImages !== undefined) {
        const hasImages = card.frontContent.images.length > 0 || card.backContent.images.length > 0
        if (hasImages !== filter.hasImages) return false
      }

      return true
    })

    // Sort cards
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

  // Card actions
  const dispatch = useCallback((action: CardAction) => {
    setCards(prevCards => {
      switch (action.type) {
        case 'CREATE_CARD':
          const newCard: Card = {
            ...action.payload,
            id: Date.now().toString(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
          return [...prevCards, newCard]

        case 'UPDATE_CARD':
          return prevCards.map(card =>
            card.id === action.payload.id
              ? { ...card, ...action.payload.updates, updatedAt: new Date() }
              : card
          )

        case 'DELETE_CARD':
          return prevCards.filter(card => card.id !== action.payload)

        case 'FLIP_CARD':
          return prevCards.map(card =>
            card.id === action.payload
              ? { ...card, isFlipped: !card.isFlipped, updatedAt: new Date() }
              : card
          )

        case 'SELECT_CARD':
          setSelectedCardIds(prev => 
            prev.includes(action.payload) 
              ? prev.filter(id => id !== action.payload)
              : [...prev, action.payload]
          )
          return prevCards

        case 'DESELECT_ALL':
          setSelectedCardIds([])
          return prevCards

        case 'DUPLICATE_CARD':
          const cardToDuplicate = prevCards.find(card => card.id === action.payload)
          if (!cardToDuplicate) return prevCards
          
          const duplicatedCard: Card = {
            ...cardToDuplicate,
            id: Date.now().toString(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
          return [...prevCards, duplicatedCard]

        case 'MOVE_TO_FOLDER':
          return prevCards.map(card =>
            card.id === action.payload.cardId
              ? { ...card, folderId: action.payload.folderId, updatedAt: new Date() }
              : card
          )

        default:
          return prevCards
      }
    })
  }, [])

  // Utility functions
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

  // Update tags across all cards (for rename/delete operations)
  const updateTagsInAllCards = useCallback((oldTagName: string, newTagName?: string) => {
    setCards(prevCards => {
      return prevCards.map(card => {
        const updateTags = (tags: string[]) => {
          if (newTagName) {
            // Rename tag
            return tags.map(tag => tag === oldTagName ? newTagName : tag)
          } else {
            // Delete tag
            return tags.filter(tag => tag !== oldTagName)
          }
        }

        const frontTags = updateTags(card.frontContent.tags)
        const backTags = updateTags(card.backContent.tags)

        // Only update if tags actually changed
        if (
          JSON.stringify(frontTags) !== JSON.stringify(card.frontContent.tags) ||
          JSON.stringify(backTags) !== JSON.stringify(card.backContent.tags)
        ) {
          return {
            ...card,
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
            updatedAt: new Date()
          }
        }

        return card
      })
    })
  }, [])

  // Get cards that use a specific tag
  const getCardsWithTag = useCallback((tagName: string) => {
    return cards.filter(card => 
      card.frontContent.tags.includes(tagName) || 
      card.backContent.tags.includes(tagName)
    )
  }, [cards])

  // Auto-save to localStorage
  useEffect(() => {
    const saveTimer = setTimeout(() => {
      localStorage.setItem('cardall-cards', JSON.stringify(cards))
    }, 1000)

    return () => clearTimeout(saveTimer)
  }, [cards])

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('cardall-cards')
    if (saved) {
      try {
        const parsedCards = JSON.parse(saved)
        setCards(parsedCards)
      } catch (error) {
        console.error('Failed to load saved cards:', error)
      }
    }
  }, [])

  return {
    cards: filteredCards(),
    allCards: cards,
    filter,
    setFilter,
    viewSettings,
    setViewSettings,
    selectedCardIds,
    dispatch,
    getCardById,
    getSelectedCards,
    getAllTags,
    updateTagsInAllCards,
    getCardsWithTag
  }
}