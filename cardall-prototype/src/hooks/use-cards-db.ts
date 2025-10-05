import { useState, useCallback, useEffect } from 'react'
import { Card, CardAction, CardFilter, ViewSettings } from '@/types/card'
import { db, DbCard } from '@/services/database'
// import { unifiedSyncService } from '@/services/unified-sync-service' // Removed in T015 cleanup

// Mock unifiedSyncService for T015 cleanup
const unifiedSyncService = {
  sync: async () => ({ success: true }),
  getStatus: () => ({ connected: true, syncing: false })
}
import { authService } from '@/services/auth'
import { fileSystemService } from '@/services/file-system'
import {
  dataEventPublisher,
  publishCardCreated,
  publishCardUpdated,
  publishCardDeleted,
  publishCardsBulkUpdated
} from '@/services/data-event-publisher'

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
  if (!user?.id) {
    console.warn('No authenticated user found, data access may be restricted')
    return null
  }
  return user.id
}

export function useCardsDb() {
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
      const userId = getCurrentUserId()

      // 按用户ID过滤查询
      let dbCards
      if (userId) {
        dbCards = await db.cards.where('userId').equals(userId).toArray()
      } else {
        // 未登录用户只能看到无用户ID的数据（向后兼容）
        dbCards = await db.cards.where('userId').equals(null).or('userId').equals('').toArray()
      }

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
    const filtered = cards.filter(card => {
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

  // 卡片操作 - 非阻塞版本
  const dispatch = useCallback(async (action: CardAction): Promise<void> => {
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

          // 非阻塞数据库操作
          db.cards.add(newCardData).then(() => {
            console.log(`卡片创建成功: ${cardId}`)
            loadCards().catch(error => {
              console.warn('重新加载卡片失败:', error)
            })
          }).catch(error => {
            console.error('数据库创建卡片失败:', error)
          })

          // 转换为前端卡片格式并发布事件
          const frontendCard = dbCardToCard(newCardData)
          publishCardCreated(frontendCard).catch(error => {
            console.warn('发布卡片创建事件失败:', error)
          })

          // 非阻塞添加到同步队列
          unifiedSyncService.addOperation({
            type: 'create',
            entity: 'card',
            entityId: cardId,
            data: newCardData,
            priority: 'normal'
          }).catch(error => {
            console.warn('添加创建操作到同步队列失败:', error)
          })

          // 立即返回，不等待数据库操作完成
          return
        }

        case 'UPDATE_CARD': {
          const updates = {
            ...action.payload.updates,
            userId,
            updatedAt: new Date(),
            syncVersion: 1,
            pendingSync: true
          }

          // 获取当前卡片用于计算变更
          const currentCard = await db.cards.get(action.payload.id)
          if (!currentCard) {
            console.warn('要更新的卡片不存在:', action.payload.id)
            return
          }

          // 非阻塞数据库更新
          db.cards.update(action.payload.id, updates).then(() => {
            console.log(`卡片更新成功: ${action.payload.id}`)
            loadCards().catch(error => {
              console.warn('重新加载卡片失败:', error)
            })
          }).catch(error => {
            console.error('数据库更新卡片失败:', error)
          })

          // 转换为前端卡片格式并发布事件
          const updatedCardData = { ...currentCard, ...updates }
          const frontendCard = dbCardToCard(updatedCardData)
          const changes = Object.keys(action.payload.updates || {}).reduce((acc, key) => {
            acc[key] = {
              from: currentCard[key as keyof DbCard],
              to: action.payload.updates[key as keyof typeof action.payload.updates]
            }
            return acc
          }, {} as Record<string, any>)

          publishCardUpdated(frontendCard, changes).catch(error => {
            console.warn('发布卡片更新事件失败:', error)
          })

          // 非阻塞添加到同步队列
          unifiedSyncService.addOperation({
            type: 'update',
            entity: 'card',
            entityId: action.payload.id,
            data: { ...action.payload.updates, userId },
            priority: 'normal'
          }).catch(error => {
            console.warn('添加更新操作到同步队列失败:', error)
          })

          // 立即返回，不等待数据库操作完成
          return
        }

        case 'DELETE_CARD': {
          // 获取要删除的卡片信息
          const cardToDelete = await db.cards.get(action.payload)
          if (!cardToDelete) {
            console.warn('要删除的卡片不存在:', action.payload)
            return
          }

          // 非阻塞数据库删除
          db.cards.delete(action.payload).then(async () => {
            console.log(`卡片删除成功: ${action.payload}`)

            // 异步删除相关图片（非关键操作）
            try {
              const allImages = [...cardToDelete.frontContent.images, ...cardToDelete.backContent.images]
              for (const image of allImages) {
                if (image.url && !image.url.startsWith('data:')) {
                  fileSystemService.deleteImage(image.url).catch(error => {
                    console.warn('删除图片失败:', error)
                  })
                }
              }
            } catch (error) {
              console.warn('处理图片删除时出错:', error)
            }

            loadCards().catch(error => {
              console.warn('重新加载卡片失败:', error)
            })
          }).catch(error => {
            console.error('数据库删除卡片失败:', error)
          })

          // 转换为前端卡片格式并发布事件
          const frontendCard = dbCardToCard(cardToDelete)
          publishCardDeleted(action.payload, frontendCard).catch(error => {
            console.warn('发布卡片删除事件失败:', error)
          })

          // 非阻塞添加到同步队列
          unifiedSyncService.addOperation({
            type: 'delete',
            entity: 'card',
            entityId: action.payload,
            data: { userId },
            priority: 'high'
          }).catch(error => {
            console.warn('添加删除操作到同步队列失败:', error)
          })

          // 立即返回，不等待数据库操作完成
          return
        }

        case 'FLIP_CARD': {
          // 翻转操作是纯本地UI状态，不需要同步到数据库
          setSelectedCardIds(prev =>
            prev.includes(action.payload)
              ? prev.filter(id => id !== action.payload)
              : [...prev, action.payload]
          )
          return
        }

        case 'SELECT_CARD':
          setSelectedCardIds(prev =>
            prev.includes(action.payload)
              ? prev.filter(id => id !== action.payload)
              : [...prev, action.payload]
          )
          return

        case 'DESELECT_ALL':
          setSelectedCardIds([])
          return

        case 'DUPLICATE_CARD': {
          const originalCard = await db.cards.get(action.payload)
          if (!originalCard) {
            console.warn('要复制的卡片不存在:', action.payload)
            return
          }

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

          // 非阻塞数据库操作
          db.cards.add(duplicatedCard).then(() => {
            console.log(`卡片复制成功: ${duplicatedCardId}`)
            loadCards().catch(error => {
              console.warn('重新加载卡片失败:', error)
            })
          }).catch(error => {
            console.error('数据库复制卡片失败:', error)
          })

          // 转换为前端卡片格式并发布事件
          const frontendCard = dbCardToCard(duplicatedCard)
          publishCardCreated(frontendCard).catch(error => {
            console.warn('发布卡片复制事件失败:', error)
          })

          // 非阻塞添加到同步队列
          unifiedSyncService.addOperation({
            type: 'create',
            entity: 'card',
            entityId: duplicatedCardId,
            data: duplicatedCard,
            priority: 'normal'
          }).catch(error => {
            console.warn('添加复制操作到同步队列失败:', error)
          })

          // 立即返回，不等待数据库操作完成
          return
        }

        case 'MOVE_TO_FOLDER': {
          const updates = {
            folderId: action.payload.folderId,
            userId,
            updatedAt: new Date(),
            syncVersion: 1,
            pendingSync: true
          }

          // 获取当前卡片
          const currentCard = await db.cards.get(action.payload.cardId)
          if (!currentCard) {
            console.warn('要移动的卡片不存在:', action.payload.cardId)
            return
          }

          // 非阻塞数据库更新
          db.cards.update(action.payload.cardId, updates).then(() => {
            console.log(`卡片移动成功: ${action.payload.cardId}`)
            loadCards().catch(error => {
              console.warn('重新加载卡片失败:', error)
            })
          }).catch(error => {
            console.error('数据库移动卡片失败:', error)
          })

          // 转换为前端卡片格式并发布事件
          const updatedCardData = { ...currentCard, ...updates }
          const frontendCard = dbCardToCard(updatedCardData)
          publishCardUpdated(frontendCard, { folderId: action.payload.folderId }).catch(error => {
            console.warn('发布卡片移动事件失败:', error)
          })

          // 非阻塞添加到同步队列
          unifiedSyncService.addOperation({
            type: 'update',
            entity: 'card',
            entityId: action.payload.cardId,
            data: updates,
            priority: 'normal'
          }).catch(error => {
            console.warn('添加移动操作到同步队列失败:', error)
          })

          // 立即返回，不等待数据库操作完成
          return
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

  // 更新所有卡片中的标签 - 非阻塞版本
  const updateTagsInAllCards = useCallback(async (oldTagName: string, newTagName?: string): Promise<void> => {
    const userId = getCurrentUserId()

    try {
      const cardsWithTag = await db.cards
        .filter(card =>
          card.frontContent.tags.includes(oldTagName) ||
          card.backContent.tags.includes(oldTagName)
        )
        .toArray()

      // 批量处理所有卡片
      const updatePromises = cardsWithTag.map(card => {
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

        // 非阻塞数据库更新
        db.cards.update(card.id!, updates).then(() => {
          console.log(`卡片标签更新成功: ${card.id}`)
        }).catch(error => {
          console.error(`更新卡片标签失败: ${card.id}`, error)
        })

        // 转换为前端卡片格式并发布事件
        const updatedCardData = { ...card, ...updates }
        const frontendCard = dbCardToCard(updatedCardData)
        const changes = {
          frontContent: { tags: frontTags },
          backContent: { tags: backTags }
        }

        publishCardUpdated(frontendCard, changes).catch(error => {
          console.warn(`发布卡片标签更新事件失败: ${card.id}`, error)
        })

        // 非阻塞添加到同步队列
        unifiedSyncService.addOperation({
          type: 'update',
          entity: 'card',
          entityId: card.id!,
          data: updates,
          priority: 'normal'
        }).catch(error => {
          console.warn(`添加标签更新操作到同步队列失败: ${card.id}`, error)
        })

        return frontendCard
      })

      // 等待所有转换完成（但不等待数据库和同步操作）
      const updatedCards = await Promise.all(updatePromises)

      // 发布批量更新事件
      publishCardsBulkUpdated(
        updatedCards.map(card => card.id),
        newTagName ? 'rename-tag' : 'delete-tag',
        updatedCards
      ).catch(error => {
        console.warn('发布批量标签更新事件失败:', error)
      })

      // 异步重新加载数据
      loadCards().catch(error => {
        console.warn('重新加载卡片失败:', error)
      })
    } catch (error) {
      console.error('更新标签操作失败:', error)
      throw error
    }
  }, [loadCards])

  const getCardsWithTag = useCallback((tagName: string) => {
    return cards.filter(card => 
      card.frontContent.tags.includes(tagName) || 
      card.backContent.tags.includes(tagName)
    )
  }, [cards])

  // 处理图片上传 - 非阻塞版本
  const handleImageUpload = useCallback(async (file: File, cardId: string): Promise<any> => {
    const userId = getCurrentUserId()

    try {
      const card = await db.cards.get(cardId)
      if (!card) throw new Error('Card not found')

      // 使用文件系统服务保存图片
      const processedImage = await fileSystemService.saveImage(file, cardId, card.folderId)

      // 更新卡片中的图片引用
      const imageData = {
        id: processedImage.id,
        url: processedImage.filePath,
        alt: file.name,
        width: processedImage.metadata.width,
        height: processedImage.metadata.height,
        aspectRatio: processedImage.metadata.width / processedImage.metadata.height
      }

      // 这里需要确定是添加到前面还是后面，暂时添加到当前显示的一面
      const currentSide = card.isFlipped ? 'backContent' : 'frontContent'
      const updatedImages = [...card[currentSide].images, imageData]

      // 非阻塞数据库更新
      db.cards.update(cardId, (card) => {
        if (currentSide === 'frontContent') {
          card.frontContent = {
            ...card.frontContent,
            images: updatedImages,
            lastModified: new Date()
          }
        } else {
          card.backContent = {
            ...card.backContent,
            images: updatedImages,
            lastModified: new Date()
          }
        }
        card.userId = userId
        card.updatedAt = new Date()
        card.syncVersion = (card.syncVersion || 0) + 1
        card.pendingSync = true
      }).then(() => {
        console.log(`图片上传成功: ${cardId}`)
        loadCards().catch(error => {
          console.warn('重新加载卡片失败:', error)
        })
      }).catch(error => {
        console.error(`数据库更新图片失败: ${cardId}`, error)
      })

      // 获取更新后的卡片数据并发布事件
      const updatedCardData = {
        ...card,
        [currentSide]: {
          ...card[currentSide],
          images: updatedImages,
          lastModified: new Date()
        },
        userId,
        updatedAt: new Date(),
        syncVersion: (card.syncVersion || 0) + 1,
        pendingSync: true
      }

      const frontendCard = dbCardToCard(updatedCardData)
      const changes = {
        [currentSide]: { images: updatedImages }
      }

      publishCardUpdated(frontendCard, changes).catch(error => {
        console.warn(`发布图片上传事件失败: ${cardId}`, error)
      })

      // 非阻塞添加到同步队列
      unifiedSyncService.addOperation({
        type: 'update',
        entity: 'card',
        entityId: cardId,
        data: {
          [currentSide]: { images: updatedImages },
          userId,
          updatedAt: new Date()
        },
        priority: 'normal'
      }).catch(error => {
        console.warn(`添加图片上传操作到同步队列失败: ${cardId}`, error)
      })

      // 立即返回图片数据，不等待数据库和同步操作完成
      return imageData
    } catch (error) {
      console.error('图片上传失败:', error)
      throw error
    }
  }, [loadCards])

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
    handleImageUpload,
    loadCards
  }
}