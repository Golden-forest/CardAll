import { useState, useCallback, useEffect } from 'react'
import { Tag, TagAction } from '@/types/card'
import { secureStorage } from '@/utils/secure-storage'
// Supabase integration removed - using local storage only

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

/**
 * 获取当前用户ID（本地模式）
 */
async function getCurrentUserId(): Promise<string | null> {
  try {
    // 尝试从localStorage获取用户ID
    const userId = localStorage.getItem('currentUserId')
    if (userId) {
      console.log(`标签服务获取到当前用户ID: ${userId}`)
      return userId
    }
    
    // 如果没有用户ID，生成或使用匿名ID
    const anonymousUserId = localStorage.getItem('anonymousUserId') || 'anonymous'
    console.log('标签服务使用匿名用户ID:', anonymousUserId)
    return anonymousUserId
  } catch (error) {
    console.error('标签服务获取用户ID失败:', error)
    return 'anonymous'
  }
}

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
          const createTagWithUserId = async () => {
            const currentUserId = await getCurrentUserId()
            return {
              ...action.payload,
              id: `tag-${Date.now()}`,
              count: 1,
              color: action.payload.color || TAG_COLORS[prevTags.length % TAG_COLORS.length],
              userId: currentUserId || 'anonymous',
              createdAt: new Date()
            }
          }

          // 创建临时标签，然后异步设置用户ID
          const newTag: Tag = {
            ...action.payload,
            id: `tag-${Date.now()}`,
            count: 1,
            color: action.payload.color || TAG_COLORS[prevTags.length % TAG_COLORS.length],
            userId: 'temporary',
            createdAt: new Date()
          }

          // 异步设置正确的用户ID
          createTagWithUserId().then(tagWithUserId => {
            setTags(prevTags =>
              prevTags.map(tag =>
                tag.id === newTag.id
                  ? { ...tag, userId: tagWithUserId.userId }
                  : tag
              )
            )
          })
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

  const syncTagsWithCards = useCallback(async (allCardTags: string[]) => {
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
    const currentUserId = await getCurrentUserId()
    Object.entries(tagCounts).forEach(([tagName, count]) => {
      if (!existingTagNames.has(tagName)) {
        const newTag: Tag = {
          id: `tag-${Date.now()}-${Math.random()}`,
          name: tagName,
          color: TAG_COLORS[updatedTags.length % TAG_COLORS.length],
          count,
          userId: currentUserId || 'anonymous',
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
    const saveTimer = setTimeout(async () => {
      try {
        const currentUserId = await getCurrentUserId()
        if (!currentUserId) {
          console.warn('无法获取用户ID，跳过标签保存')
          return
        }

        // 使用用户隔离的存储键
        const userStorageKey = `tags_${currentUserId}`
        const userHiddenTagsKey = `hidden_tags_${currentUserId}`

        secureStorage.set(userStorageKey, tags, {
          validate: true,
          encrypt: true
        })
        secureStorage.set(userHiddenTagsKey, hiddenTags, {
          validate: true,
          encrypt: true
        })
      } catch (error) {
        console.error('保存标签数据失败:', error)
      }
    }, 1000)

    return () => clearTimeout(saveTimer)
  }, [tags, hiddenTags])

  // Load from localStorage on mount
  useEffect(() => {
    const loadTags = async () => {
      try {
        const currentUserId = await getCurrentUserId()
        if (!currentUserId) {
          console.warn('无法获取用户ID，使用默认标签')
          setTags(mockTags)
          return
        }

        // 使用用户隔离的存储键
        const userStorageKey = `tags_${currentUserId}`
        const userHiddenTagsKey = `hidden_tags_${currentUserId}`

        const savedTags = secureStorage.get<Tag[]>(userStorageKey, {
          validate: true,
          encrypt: true
        })

        if (savedTags) {
          // 确保加载的标签都有正确的用户ID
          const validatedTags = savedTags.map(tag => ({
            ...tag,
            userId: tag.userId || currentUserId
          }))
          setTags(validatedTags)
        } else {
          // 首次使用，初始化默认标签
          const initialTags = mockTags.map(tag => ({
            ...tag,
            userId: currentUserId
          }))
          setTags(initialTags)
        }

        const savedHiddenTags = secureStorage.get<string[]>(userHiddenTagsKey, {
          validate: true,
          encrypt: true
        })

        if (savedHiddenTags) {
          setHiddenTags(savedHiddenTags)
        }
      } catch (error) {
        console.error('加载标签数据失败:', error)
        setTags(mockTags)
      }
    }

    loadTags()
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