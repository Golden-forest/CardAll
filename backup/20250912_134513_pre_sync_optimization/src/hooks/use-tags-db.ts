import { useState, useCallback, useEffect } from 'react'
import { Tag, TagAction, TagFilter } from '@/types/card'
import { db, DbTag } from '@/services/database-simple'
import { cloudSyncService } from '@/services/cloud-sync'
import { authService } from '@/services/auth'

// 转换数据库标签到前端标签格式
const dbTagToTag = (dbTag: DbTag): Tag => {
  const { syncVersion, pendingSync, ...tag } = dbTag
  return {
    ...tag,
    id: tag.id || '',
    createdAt: new Date(tag.createdAt),
    updatedAt: new Date(tag.updatedAt)
  }
}

// 转换前端标签到数据库格式
const tagToDbTag = (tag: Tag, userId?: string): DbTag => {
  return {
    ...tag,
    userId: userId || undefined,
    syncVersion: 1,
    pendingSync: true
  }
}

// 获取当前用户ID
const getCurrentUserId = (): string | null => {
  const user = authService.getCurrentUser()
  return user?.id || null
}

export function useTagsDb() {
  const [tags, setTags] = useState<Tag[]>([])
  const [filter, setFilter] = useState<TagFilter>({
    searchTerm: '',
    showUnused: true
  })
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 从数据库加载标签
  const loadTags = useCallback(async () => {
    try {
      setIsLoading(true)
      const dbTags = await db.tags.toArray()
      const convertedTags = dbTags.map(dbTagToTag)
      setTags(convertedTags)
    } catch (error) {
      console.error('Failed to load tags:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 初始化时加载数据
  useEffect(() => {
    loadTags()
  }, [loadTags])

  // 监听数据库变化
  useEffect(() => {
    const subscription = db.tags.hook('creating', (primKey, obj, trans) => {
      console.log('Tag creating:', primKey)
    })

    const updateSubscription = db.tags.hook('updating', (modifications, primKey, obj, trans) => {
      console.log('Tag updating:', primKey)
    })

    const deleteSubscription = db.tags.hook('deleting', (primKey, obj, trans) => {
      console.log('Tag deleting:', primKey)
    })

    return () => {
      subscription.unsubscribe()
      updateSubscription.unsubscribe()
      deleteSubscription.unsubscribe()
    }
  }, [])

  // 过滤标签
  const filteredTags = useCallback(() => {
    let filtered = tags.filter(tag => {
      // 搜索词过滤
      if (filter.searchTerm) {
        const searchLower = filter.searchTerm.toLowerCase()
        const matchesName = tag.name.toLowerCase().includes(searchLower)
        if (!matchesName) return false
      }

      // 颜色过滤
      if (filter.color && tag.color !== filter.color) {
        return false
      }

      return true
    })

    // 排序标签
    filtered.sort((a, b) => {
      // 按使用次数降序，然后按名称升序
      if (a.count !== b.count) {
        return b.count - a.count
      }
      return a.name.localeCompare(b.name)
    })

    return filtered
  }, [tags, filter])

  // 标签操作
  const dispatch = useCallback(async (action: TagAction) => {
    const userId = getCurrentUserId()
    
    try {
      switch (action.type) {
        case 'CREATE_TAG': {
          const tagId = crypto.randomUUID()
          const newTag: DbTag = {
            ...action.payload,
            id: tagId,
            userId,
            count: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            syncVersion: 1,
            pendingSync: true
          }

          console.log('🏷️ useTagsDb: Creating new tag', newTag)
          
          const id = await db.tags.add(newTag)
          console.log('🏷️ useTagsDb: Tag added to local DB with id', id)
          
          await cloudSyncService.queueOperation({
            type: 'create',
            table: 'tags',
            data: newTag,
            localId: tagId
          })
          
          console.log('🏷️ useTagsDb: Sync operation queued')
          
          // 重新加载数据
          await loadTags()
          break
        }

        case 'UPDATE_TAG': {
          const updates = {
            ...action.payload.updates,
            userId,
            updatedAt: new Date(),
            syncVersion: 1,
            pendingSync: true
          }

          await db.tags.update(action.payload.id, updates)
          await cloudSyncService.queueOperation({
            type: 'update',
            table: 'tags',
            data: updates,
            localId: action.payload.id
          })
          
          await loadTags()
          break
        }

        case 'DELETE_TAG': {
          await db.tags.delete(action.payload)
          await cloudSyncService.queueOperation({
            type: 'delete',
            table: 'tags',
            data: { userId },
            localId: action.payload
          })
          
          await loadTags()
          break
        }

        case 'SELECT_TAG':
          setSelectedTagIds(prev => 
            prev.includes(action.payload) 
              ? prev.filter(id => id !== action.payload)
              : [...prev, action.payload]
          )
          break

        case 'DESELECT_ALL_TAGS':
          setSelectedTagIds([])
          break

        case 'INCREMENT_COUNT': {
          const tag = await db.tags.get(action.payload)
          if (tag) {
            const updates = {
              count: (tag.count || 0) + 1,
              userId,
              updatedAt: new Date(),
              syncVersion: (tag.syncVersion || 0) + 1,
              pendingSync: true
            }

            await db.tags.update(action.payload, updates)
            await cloudSyncService.queueOperation({
              type: 'update',
              table: 'tags',
              data: updates,
              localId: action.payload
            })
            
            await loadTags()
          }
          break
        }

        case 'DECREMENT_COUNT': {
          const tag = await db.tags.get(action.payload)
          if (tag && tag.count > 0) {
            const updates = {
              count: Math.max(0, (tag.count || 0) - 1),
              userId,
              updatedAt: new Date(),
              syncVersion: (tag.syncVersion || 0) + 1,
              pendingSync: true
            }

            await db.tags.update(action.payload, updates)
            await cloudSyncService.queueOperation({
              type: 'update',
              table: 'tags',
              data: updates,
              localId: action.payload
            })
            
            await loadTags()
          }
          break
        }

        default:
          console.warn('Unknown tag action:', action)
      }
    } catch (error) {
      console.error('Tag operation failed:', error)
      throw error
    }
  }, [loadTags])

  // 工具函数
  const getTagById = useCallback((id: string) => {
    return tags.find(tag => tag.id === id)
  }, [tags])

  const getSelectedTags = useCallback(() => {
    return tags.filter(tag => selectedTagIds.includes(tag.id))
  }, [tags, selectedTagIds])

  const getAllTagNames = useCallback(() => {
    return tags.map(tag => tag.name).sort()
  }, [tags])

  const getTagsByColor = useCallback((color: string) => {
    return tags.filter(tag => tag.color === color)
  }, [tags])

  const getMostUsedTags = useCallback((limit: number = 10) => {
    return [...tags]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }, [tags])

  // 与卡片数据同步标签计数
  const syncTagsWithCards = useCallback(async (cardTags: string[]) => {
    try {
      // 获取当前所有标签
      const currentTags = await db.tags.toArray()
      const currentTagNames = new Set(currentTags.map(tag => tag.name))
      const cardTagSet = new Set(cardTags)

      // 更新现有标签的计数
      for (const tag of currentTags) {
        const newCount = cardTags.filter(tagName => tagName === tag.name).length
        if (newCount !== tag.count) {
          await dispatch({
            type: 'UPDATE_TAG',
            payload: {
              id: tag.id!,
              updates: { count: newCount }
            }
          })
        }
      }

      // 创建新标签（如果卡片中有但数据库中没有的）
      for (const tagName of cardTags) {
        if (!currentTagNames.has(tagName)) {
          await dispatch({
            type: 'CREATE_TAG',
            payload: {
              name: tagName,
              color: '#3b82f6', // 默认颜色
              count: cardTags.filter(t => t === tagName).length
            }
          })
        }
      }

      console.log('🏷️ Tags synchronized with cards')
    } catch (error) {
      console.error('Failed to sync tags with cards:', error)
    }
  }, [dispatch])

  // 重命名标签
  const renameTag = useCallback(async (oldName: string, newName: string) => {
    try {
      const tag = tags.find(t => t.name === oldName)
      if (tag) {
        await dispatch({
          type: 'UPDATE_TAG',
          payload: {
            id: tag.id,
            updates: { name: newName }
          }
        })
      }
    } catch (error) {
      console.error('Failed to rename tag:', error)
      throw error
    }
  }, [tags, dispatch])

  // 删除未使用的标签
  const deleteUnusedTags = useCallback(async () => {
    try {
      const unusedTags = tags.filter(tag => tag.count === 0)
      for (const tag of unusedTags) {
        await dispatch({
          type: 'DELETE_TAG',
          payload: tag.id
        })
      }
    } catch (error) {
      console.error('Failed to delete unused tags:', error)
      throw error
    }
  }, [tags, dispatch])

  return {
    tags: filteredTags(),
    allTags: tags,
    filter,
    setFilter,
    selectedTagIds,
    isLoading,
    dispatch,
    getTagById,
    getSelectedTags,
    getAllTagNames,
    getTagsByColor,
    getMostUsedTags,
    syncTagsWithCards,
    renameTag,
    deleteUnusedTags,
    loadTags
  }
}