import { useState, useCallback, useEffect } from 'react'
import { Tag, TagAction } from '@/types/card'

// Mock data for development
const mockTags: Tag[] = [
  {
    id: 'tag-1',
    name: 'react',
    color: '#3b82f6',
    count: 1,
    createdAt: new Date('2024-01-15')
  },
  {
    id: 'tag-2',
    name: 'frontend',
    color: '#8b5cf6',
    count: 1,
    createdAt: new Date('2024-01-15')
  },
  {
    id: 'tag-3',
    name: 'best-practices',
    color: '#10b981',
    count: 1,
    createdAt: new Date('2024-01-15')
  },
  {
    id: 'tag-4',
    name: 'typescript',
    color: '#f59e0b',
    count: 1,
    createdAt: new Date('2024-01-16')
  },
  {
    id: 'tag-5',
    name: 'types',
    color: '#ef4444',
    count: 1,
    createdAt: new Date('2024-01-16')
  },
  {
    id: 'tag-6',
    name: 'development',
    color: '#06b6d4',
    count: 1,
    createdAt: new Date('2024-01-16')
  }
]

const TAG_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4',
  '#8b5a2b', '#6b7280', '#ec4899', '#84cc16', '#f97316', '#6366f1'
]

export function useTags() {
  const [tags, setTags] = useState<Tag[]>(mockTags)
  const [hiddenTags, setHiddenTags] = useState<string[]>([])

  // Get visible tags
  const visibleTags = useCallback(() => {
    return tags.filter(tag => !hiddenTags.includes(tag.id))
  }, [tags, hiddenTags])

  // Get popular tags (sorted by count)
  const popularTags = useCallback((limit?: number) => {
    const sorted = [...visibleTags()].sort((a, b) => b.count - a.count)
    return limit ? sorted.slice(0, limit) : sorted
  }, [visibleTags])

  // Tag actions
  const dispatch = useCallback((action: TagAction) => {
    setTags(prevTags => {
      switch (action.type) {
        case 'CREATE_TAG':
          // Check if tag already exists
          const existingTag = prevTags.find(tag => 
            tag.name.toLowerCase() === action.payload.name.toLowerCase()
          )
          if (existingTag) {
            // Increment count if tag exists
            return prevTags.map(tag =>
              tag.id === existingTag.id
                ? { ...tag, count: tag.count + 1 }
                : tag
            )
          }
          
          // Create new tag
          const newTag: Tag = {
            ...action.payload,
            id: `tag-${Date.now()}`,
            count: 1,
            color: action.payload.color || TAG_COLORS[prevTags.length % TAG_COLORS.length],
            createdAt: new Date()
          }
          return [...prevTags, newTag]

        case 'UPDATE_TAG':
          return prevTags.map(tag =>
            tag.id === action.payload.id
              ? { ...tag, ...action.payload.updates }
              : tag
          )

        case 'DELETE_TAG':
          return prevTags.filter(tag => tag.id !== action.payload)

        case 'TOGGLE_TAG_VISIBILITY':
          setHiddenTags(prev => 
            prev.includes(action.payload)
              ? prev.filter(id => id !== action.payload)
              : [...prev, action.payload]
          )
          return prevTags

        default:
          return prevTags
      }
    })
  }, [])

  // Utility functions
  const getTagById = useCallback((id: string) => {
    return tags.find(tag => tag.id === id)
  }, [tags])

  const getTagByName = useCallback((name: string) => {
    return tags.find(tag => tag.name.toLowerCase() === name.toLowerCase())
  }, [tags])

  const createTagIfNotExists = useCallback((name: string, color?: string) => {
    const existing = getTagByName(name)
    if (existing) {
      return existing
    }
    
    dispatch({
      type: 'CREATE_TAG',
      payload: { name, color: color || TAG_COLORS[tags.length % TAG_COLORS.length] }
    })
    
    return null // Tag will be created asynchronously
  }, [dispatch, getTagByName, tags.length])

  const updateTagCount = useCallback((tagName: string, increment: number) => {
    const tag = getTagByName(tagName)
    if (tag) {
      const newCount = Math.max(0, tag.count + increment)
      if (newCount === 0) {
        dispatch({ type: 'DELETE_TAG', payload: tag.id })
      } else {
        dispatch({
          type: 'UPDATE_TAG',
          payload: { id: tag.id, updates: { count: newCount } }
        })
      }
    }
  }, [dispatch, getTagByName])

  const syncTagsWithCards = useCallback((allCardTags: string[]) => {
    // Count tag usage
    const tagCounts = allCardTags.reduce((acc, tagName) => {
      acc[tagName] = (acc[tagName] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Update existing tags and create new ones
    const updatedTags = tags.map(tag => ({
      ...tag,
      count: tagCounts[tag.name] || 0
    }))
    
    const existingTagNames = new Set(tags.map(tag => tag.name))

    // Create new tags
    Object.entries(tagCounts).forEach(([tagName, count]) => {
      if (!existingTagNames.has(tagName)) {
        const newTag: Tag = {
          id: `tag-${Date.now()}-${Math.random()}`,
          name: tagName,
          color: TAG_COLORS[updatedTags.length % TAG_COLORS.length],
          count,
          createdAt: new Date()
        }
        updatedTags.push(newTag)
      }
    })

    // Remove tags with zero count
    const finalTags = updatedTags.filter(tag => tag.count > 0)
    setTags(finalTags)
  }, [tags])

  const searchTags = useCallback((query: string) => {
    if (!query.trim()) return visibleTags()
    
    const lowercaseQuery = query.toLowerCase()
    return visibleTags().filter(tag =>
      tag.name.toLowerCase().includes(lowercaseQuery)
    )
  }, [visibleTags])

  const getTagSuggestions = useCallback((input: string, limit = 5) => {
    if (!input.trim()) return popularTags(limit)
    
    const matches = searchTags(input)
    return matches.slice(0, limit)
  }, [searchTags, popularTags])

  // Rename tag
  const renameTag = useCallback((oldName: string, newName: string) => {
    const tag = getTagByName(oldName)
    if (!tag) return false

    // Check if new name already exists
    const existingTag = getTagByName(newName)
    if (existingTag && existingTag.id !== tag.id) {
      return false // Name conflict
    }

    dispatch({
      type: 'UPDATE_TAG',
      payload: { 
        id: tag.id, 
        updates: { name: newName.trim() } 
      }
    })
    return true
  }, [dispatch, getTagByName])

  // Delete tag by name
  const deleteTagByName = useCallback((tagName: string) => {
    const tag = getTagByName(tagName)
    if (!tag) return false

    dispatch({ type: 'DELETE_TAG', payload: tag.id })
    return true
  }, [dispatch, getTagByName])

  // Get all tag names for validation
  const getAllTagNames = useCallback(() => {
    return tags.map(tag => tag.name)
  }, [tags])

  // Auto-save to localStorage
  useEffect(() => {
    const saveTimer = setTimeout(() => {
      localStorage.setItem('cardall-tags', JSON.stringify(tags))
      localStorage.setItem('cardall-hidden-tags', JSON.stringify(hiddenTags))
    }, 1000)

    return () => clearTimeout(saveTimer)
  }, [tags, hiddenTags])

  // Load from localStorage on mount
  useEffect(() => {
    const savedTags = localStorage.getItem('cardall-tags')
    const savedHiddenTags = localStorage.getItem('cardall-hidden-tags')
    
    if (savedTags) {
      try {
        const parsedTags = JSON.parse(savedTags)
        setTags(parsedTags)
      } catch (error) {
        console.error('Failed to load saved tags:', error)
      }
    }
    
    if (savedHiddenTags) {
      try {
        const parsedHiddenTags = JSON.parse(savedHiddenTags)
        setHiddenTags(parsedHiddenTags)
      } catch (error) {
        console.error('Failed to load hidden tags:', error)
      }
    }
  }, [])

  return {
    tags: visibleTags(),
    allTags: tags,
    hiddenTags,
    popularTags,
    dispatch,
    getTagById,
    getTagByName,
    createTagIfNotExists,
    updateTagCount,
    syncTagsWithCards,
    searchTags,
    getTagSuggestions,
    renameTag,
    deleteTagByName,
    getAllTagNames
  }
}