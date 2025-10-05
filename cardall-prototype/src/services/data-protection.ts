import { db } from './database'
import { authService } from './auth'

// 获取当前用户ID（增强版）
export const getCurrentUserId = (): string | null => {
  const user = authService.getCurrentUser()
  if (!user?.id) {
    console.warn('No authenticated user found, data access may be restricted')
    return null
  }
  return user.id
}

// 数据访问权限验证
export const validateDataAccess = (operation: string, userId?: string): boolean => {
  const currentUserId = getCurrentUserId()

  if (!currentUserId && authService.isAuthenticated()) {
    console.error(`Security violation: Authenticated user without ID attempting ${operation}`)
    return false
  }

  // 如果提供了userId,必须匹配当前用户
  if (userId && userId !== currentUserId) {
    console.error(`Security violation: User ${currentUserId} attempting ${operation} on user ${userId}'s data`)
    return false
  }

  return true
}

// 确保用户数据隔离
export const ensureUserDataIsolation = async (): Promise<void> => {
  const currentUserId = getCurrentUserId()
  if (!currentUserId) return

  try {
    // 检查并清理不属于当前用户的卡片数据
    const otherUsersCards = await db.cards
      .where('userId')
      .notEqual(currentUserId)
      .and(card => card.userId !== null && card.userId !== '')
      .toArray()

    if (otherUsersCards.length > 0) {
      console.warn(`Found ${otherUsersCards.length} cards belonging to other users, removing for privacy`)
      await db.cards.bulkDelete(otherUsersCards.map(card => card.id!))
    }

    // 检查并清理不属于当前用户的文件夹数据
    const otherUsersFolders = await db.folders
      .where('userId')
      .notEqual(currentUserId)
      .and(folder => folder.userId !== null && folder.userId !== '')
      .toArray()

    if (otherUsersFolders.length > 0) {
      console.warn(`Found ${otherUsersFolders.length} folders belonging to other users, removing for privacy`)
      await db.folders.bulkDelete(otherUsersFolders.map(folder => folder.id!))
    }

    // 检查并清理不属于当前用户的标签数据
    const otherUsersTags = await db.tags
      .where('userId')
      .notEqual(currentUserId)
      .and(tag => tag.userId !== null && tag.userId !== '')
      .toArray()

    if (otherUsersTags.length > 0) {
      console.warn(`Found ${otherUsersTags.length} tags belonging to other users, removing for privacy`)
      await db.tags.bulkDelete(otherUsersTags.map(tag => tag.id!))
    }

    // 检查并清理不属于当前用户的图片数据
    const otherUsersImages = await db.images
      .where('userId')
      .notEqual(currentUserId)
      .and(image => image.userId !== null && image.userId !== '')
      .toArray()

    if (otherUsersImages.length > 0) {
      console.warn(`Found ${otherUsersImages.length} images belonging to other users, removing for privacy`)
      await db.images.bulkDelete(otherUsersImages.map(image => image.id!))
    }

    console.log('✅ User data isolation verified and cleaned')
  } catch (error) {
          console.warn("操作失败:", error)
        }
}

// 验证数据一致性
export const verifyUserDataConsistency = async (): Promise<void> => {
  if (authService.isAuthenticated()) {
    await ensureUserDataIsolation()
  }
}

// 用户感知的查询方法
export const userAwareQueries = {
  // 卡片查询
  async getCardsByUser(userId?: string) {
    const queryUserId = userId || getCurrentUserId()
    if (!queryUserId) {
      return await db.cards.where('userId').equals(null).or('userId').equals('').toArray()
    }
    return await db.cards.where('userId').equals(queryUserId).toArray()
  },

  // 文件夹查询
  async getFoldersByUser(userId?: string) {
    const queryUserId = userId || getCurrentUserId()
    if (!queryUserId) {
      return await db.folders.where('userId').equals(null).or('userId').equals('').toArray()
    }
    return await db.folders.where('userId').equals(queryUserId).toArray()
  },

  // 标签查询
  async getTagsByUser(userId?: string) {
    const queryUserId = userId || getCurrentUserId()
    if (!queryUserId) {
      return await db.tags.where('userId').equals(null).or('userId').equals('').toArray()
    }
    return await db.tags.where('userId').equals(queryUserId).toArray()
  },

  // 图片查询
  async getImagesByUser(userId?: string) {
    const queryUserId = userId || getCurrentUserId()
    if (!queryUserId) {
      return await db.images.where('userId').equals(null).or('userId').equals('').toArray()
    }
    return await db.images.where('userId').equals(queryUserId).toArray()
  }
}

// 安全的数据操作包装器
export const safeDataOperations = {
  // 安全的卡片操作
  async createCard(cardData: any) {
    const userId = getCurrentUserId()
    if (!validateDataAccess('create card')) {
      throw new Error('Unauthorized: Cannot create card without valid user session')
    }

    return await db.cards.add({
      ...cardData,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncVersion: 1,
      pendingSync: true
    })
  },

  async updateCard(cardId: string, updates: any) {
    if (!validateDataAccess('update card', updates.userId)) {
      throw new Error('Unauthorized: Cannot update card without valid user session')
    }

    return await db.cards.update(cardId, {
      ...updates,
      userId: getCurrentUserId(),
      updatedAt: new Date()
    })
  },

  async deleteCard(cardId: string) {
    if (!validateDataAccess('delete card')) {
      throw new Error('Unauthorized: Cannot delete card without valid user session')
    }

    return await db.cards.delete(cardId)
  }
}