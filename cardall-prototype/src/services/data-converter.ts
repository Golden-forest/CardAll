import { Card, Folder, Tag, ImageData } from '@/types/card'
import { 
  DbCard, 
  DbFolder, 
  DbTag, 
  DbImage,
  { id: string; type: string; data: any },
  LegacySyncOperation 
} from '@/services/database'
import { authService } from '@/services/auth'

// ============================================================================
// 统一数据类型转换器
// ============================================================================

export class DataConverter {
  // 用户ID缓存
  private static cachedUserId: string | null = null

  // 获取当前用户ID
  private static getCurrentUserId(): string | null {
    if (!this.cachedUserId) {
      const user = authService.getCurrentUser()
      this.cachedUserId = user?.id || null
    }
    return this.cachedUserId
  }

  // 清除用户ID缓存
  static clearUserIdCache(): void {
    this.cachedUserId = null
  }

  // ============================================================================
  // 卡片转换方法
  // ============================================================================

  // 前端卡片 → 数据库卡片
  static toDbCard(card: Partial<Card>, userId?: string): DbCard {
    const now = new Date()
    const effectiveUserId = userId || this.getCurrentUserId()
    
    return {
      id: card.id || crypto.randomUUID(),
      folderId: card.folderId,
      frontContent: card.frontContent || {
        title: '',
        text: '',
        tags: [],
        images: [],
        lastModified: now
      },
      backContent: card.backContent || {
        title: '',
        text: '',
        tags: [],
        images: [],
        lastModified: now
      },
      isFlipped: card.isFlipped || false,
      style: card.style || {
        type: 'solid',
        backgroundColor: '#ffffff',
        textColor: '#000000'
      },
      userId: effectiveUserId,
      syncVersion: card.syncVersion || 1,
      lastSyncAt: card.lastSyncAt,
      pendingSync: card.pendingSync ?? true,
      updatedAt: card.updatedAt || now,
      searchVector: this.generateSearchVector(card),
      thumbnailUrl: card.thumbnailUrl
    }
  }

  // 数据库卡片 → 前端卡片
  static fromDbCard(dbCard: DbCard): Card {
    const { 
      userId, 
      syncVersion, 
      lastSyncAt, 
      pendingSync, 
      searchVector,
      thumbnailUrl,
      ...card 
    } = dbCard

    return {
      ...card,
      id: card.id || '',
      createdAt: new Date(card.createdAt),
      updatedAt: new Date(card.updatedAt),
      frontContent: {
        ...card.frontContent,
        lastModified: new Date(card.frontContent.lastModified)
      },
      backContent: {
        ...card.backContent,
        lastModified: new Date(card.backContent.lastModified)
      }
    }
  }

  // 批量转换数据库卡片到前端卡片
  static fromDbCards(dbCards: DbCard[]): Card[] {
    return dbCards.map(dbCard => this.fromDbCard(dbCard))
  }

  // ============================================================================
  // 文件夹转换方法
  // ============================================================================

  // 前端文件夹 → 数据库文件夹
  static toDbFolder(folder: Partial<Folder>, userId?: string): DbFolder {
    const now = new Date()
    const effectiveUserId = userId || this.getCurrentUserId()

    return {
      id: folder.id || crypto.randomUUID(),
      name: folder.name || '',
      parentId: folder.parentId,
      description: folder.description || '',
      color: folder.color || '#6366f1',
      icon: folder.icon || 'folder',
      order: folder.order || 0,
      isExpanded: folder.isExpanded ?? true,
      cardIds: folder.cardIds || [],
      createdAt: folder.createdAt || now,
      userId: effectiveUserId,
      syncVersion: folder.syncVersion || 1,
      lastSyncAt: folder.lastSyncAt,
      pendingSync: folder.pendingSync ?? true,
      updatedAt: folder.updatedAt || now,
      fullPath: this.generateFullPath(folder),
      depth: this.calculateFolderDepth(folder)
    }
  }

  // 数据库文件夹 → 前端文件夹
  static fromDbFolder(dbFolder: DbFolder): Folder {
    const {
      userId,
      syncVersion,
      lastSyncAt,
      pendingSync,
      fullPath,
      depth,
      ...folder
    } = dbFolder

    return {
      ...folder,
      id: folder.id || '',
      cardIds: folder.cardIds || [],
      createdAt: new Date(folder.createdAt),
      updatedAt: new Date(folder.updatedAt)
    }
  }

  // ============================================================================
  // 标签转换方法
  // ============================================================================

  // 前端标签 → 数据库标签
  static toDbTag(tag: Partial<Tag>, userId?: string): DbTag {
    const now = new Date()
    const effectiveUserId = userId || this.getCurrentUserId()
    
    return {
      id: tag.id || crypto.randomUUID(),
      name: tag.name || '',
      color: tag.color || '#6366f1',
      description: tag.description || '',
      count: tag.count || 0,
      createdAt: tag.createdAt || now,
      userId: effectiveUserId,
      syncVersion: tag.syncVersion || 1,
      lastSyncAt: tag.lastSyncAt,
      pendingSync: tag.pendingSync ?? true,
      updatedAt: tag.updatedAt || now
    }
  }

  // 数据库标签 → 前端标签
  static fromDbTag(dbTag: DbTag): Tag {
    const { 
      userId, 
      syncVersion, 
      lastSyncAt, 
      pendingSync, 
      count,
      ...tag 
    } = dbTag

    return {
      ...tag,
      id: tag.id || '',
      createdAt: new Date(tag.createdAt),
      updatedAt: new Date(tag.updatedAt)
    }
  }

  // ============================================================================
  // 图片转换方法
  // ============================================================================

  // 前端图片数据 → 数据库图片
  static toDbImage(image: Partial<ImageData>, cardId: string, userId?: string): DbImage {
    const now = new Date()
    const effectiveUserId = userId || this.getCurrentUserId()
    
    return {
      id: image.id || crypto.randomUUID(),
      cardId,
      userId: effectiveUserId,
      fileName: image.fileName || '',
      filePath: image.url || '',
      cloudUrl: image.cloudUrl,
      thumbnailPath: image.thumbnailUrl,
      metadata: {
        originalName: image.fileName || image.alt || '',
        size: image.size || 0,
        width: image.width || 0,
        height: image.height || 0,
        format: image.format || 'jpg',
        compressed: image.compressed ?? false,
        quality: image.quality
      },
      storageMode: image.storageMode || 'indexeddb',
      createdAt: image.createdAt || now,
      updatedAt: image.updatedAt || now,
      syncVersion: image.syncVersion || 1,
      lastSyncAt: image.lastSyncAt,
      pendingSync: image.pendingSync ?? true
    }
  }

  // 数据库图片 → 前端图片数据
  static fromDbImage(dbImage: DbImage): ImageData {
    const { 
      userId, 
      syncVersion, 
      lastSyncAt, 
      pendingSync,
      fileName,
      filePath,
      thumbnailPath,
      storageMode,
      metadata,
      ...image 
    } = dbImage

    return {
      ...image,
      id: image.id || '',
      url: filePath,
      thumbnailUrl: thumbnailPath,
      alt: metadata.originalName,
      width: metadata.width,
      height: metadata.height,
      aspectRatio: metadata.width > 0 && metadata.height > 0 ? metadata.width / metadata.height : 1,
      size: metadata.size,
      format: metadata.format,
      compressed: metadata.compressed,
      quality: metadata.quality,
      storageMode,
      createdAt: new Date(image.createdAt),
      updatedAt: new Date(image.updatedAt)
    }
  }

  // ============================================================================
  // 同步操作转换
  // ============================================================================

  // 旧版同步操作 → 新版同步操作
  static fromLegacySyncOperation(legacyOp: LegacySyncOperation): { id: string; type: string; data: any } {
    return {
      id: legacyOp.id,
      type: legacyOp.type,
      entity: legacyOp.table.replace('s', '') as 'card' | 'folder' | 'tag' | 'image',
      entityId: legacyOp.localId,
      data: legacyOp.data,
      timestamp: legacyOp.timestamp,
      retryCount: legacyOp.retryCount,
      maxRetries: legacyOp.maxRetries,
      error: legacyOp.error,
      priority: 'normal'
    }
  }

  // 新版同步操作 → 旧版同步操作
  static toLegacySyncOperation(op: { id: string; type: string; data: any }): LegacySyncOperation {
    return {
      id: op.id,
      type: op.type,
      table: (`${op.entity  }s`) as 'cards' | 'folders' | 'tags' | 'images',
      data: op.data,
      localId: op.entityId,
      timestamp: op.timestamp,
      retryCount: op.retryCount,
      maxRetries: op.maxRetries,
      error: op.error
    }
  }

  // ============================================================================
  // 搜索和索引优化
  // ============================================================================

  // 生成搜索向量
  static generateSearchVector(card: Partial<Card>): string {
    const searchableText = [
      card.frontContent?.title || '',
      card.frontContent?.text || '',
      card.backContent?.title || '',
      card.backContent?.text || '',
      ...(card.frontContent?.tags || []),
      ...(card.backContent?.tags || [])
    ].join(' ').toLowerCase()
    
    // 简单的文本处理：移除特殊字符,标准化空格
    return searchableText
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // 生成文件夹完整路径
  static generateFullPath(folder: Partial<Folder>): string {
    // 这里需要递归构建完整路径,暂时简化处理
    return folder.name || ''
  }

  // 计算文件夹深度
  static calculateFolderDepth(folder: Partial<Folder>): number {
    // 这里需要递归计算深度,暂时简化处理
    return folder.parentId ? 1 : 0
  }

  // ============================================================================
  // 云端数据转换
  // ============================================================================

  // 云端卡片 → 数据库卡片
  static fromCloudCard(cloudCard: any): DbCard {
    return {
      id: cloudCard.id,
      folderId: cloudCard.folder_id,
      frontContent: {
        title: cloudCard.front_content?.title || '',
        text: cloudCard.front_content?.text || '',
        tags: cloudCard.front_content?.tags || [],
        images: cloudCard.front_content?.images || [],
        lastModified: new Date(cloudCard.updated_at)
      },
      backContent: {
        title: cloudCard.back_content?.title || '',
        text: cloudCard.back_content?.text || '',
        tags: cloudCard.back_content?.tags || [],
        images: cloudCard.back_content?.images || [],
        lastModified: new Date(cloudCard.updated_at)
      },
      // 注意：isFlipped 是纯本地UI状态,不参与云端同步
      // 默认显示正面,用户主动点击才翻转查看背面
      // isFlipped: false, // 移除硬编码,让本地状态管理
      style: cloudCard.style || {
        type: 'solid',
        backgroundColor: '#ffffff',
        textColor: '#000000'
      },
      userId: cloudCard.user_id,
      syncVersion: cloudCard.sync_version || 1,
      lastSyncAt: new Date(cloudCard.updated_at),
      pendingSync: false,
      createdAt: new Date(cloudCard.created_at),
      updatedAt: new Date(cloudCard.updated_at),
      searchVector: this.generateSearchVectorFromCloud(cloudCard),
      thumbnailUrl: cloudCard.thumbnail_url
    }
  }

  // 云端文件夹 → 数据库文件夹
  static fromCloudFolder(cloudFolder: any): DbFolder {
    return {
      id: cloudFolder.id,
      name: cloudFolder.name,
      parentId: cloudFolder.parent_id,
      description: cloudFolder.description || '',
      color: cloudFolder.color || '#6366f1',
      icon: cloudFolder.icon || 'folder',
      order: cloudFolder.order_index || 0,
      isExpanded: cloudFolder.is_expanded ?? true,
      cardIds: cloudFolder.card_ids || [],
      userId: cloudFolder.user_id,
      syncVersion: cloudFolder.sync_version || 1,
      lastSyncAt: new Date(cloudFolder.updated_at),
      pendingSync: false,
      createdAt: new Date(cloudFolder.created_at),
      updatedAt: new Date(cloudFolder.updated_at),
      fullPath: cloudFolder.full_path || cloudFolder.name,
      depth: cloudFolder.depth || 0
    }
  }

  // 云端标签 → 数据库标签
  static fromCloudTag(cloudTag: any): DbTag {
    return {
      id: cloudTag.id,
      name: cloudTag.name,
      color: cloudTag.color || '#6366f1',
      description: cloudTag.description || '',
      count: cloudTag.count || 0,
      userId: cloudTag.user_id,
      syncVersion: cloudTag.sync_version || 1,
      lastSyncAt: new Date(cloudTag.updated_at),
      pendingSync: false,
      createdAt: new Date(cloudTag.created_at),
      updatedAt: new Date(cloudTag.updated_at)
    }
  }

  // 数据库卡片 → 云端卡片
  // 注意：isFlipped 是纯本地UI状态,不参与云端同步,因此在此处被忽略
  static toCloudCard(dbCard: DbCard): any {
    return {
      id: dbCard.id,
      folder_id: dbCard.folderId,
      front_content: {
        title: dbCard.frontContent.title,
        text: dbCard.frontContent.text,
        tags: dbCard.frontContent.tags,
        images: dbCard.frontContent.images
      },
      back_content: {
        title: dbCard.backContent.title,
        text: dbCard.backContent.text,
        tags: dbCard.backContent.tags,
        images: dbCard.backContent.images
      },
      style: dbCard.style,
      user_id: dbCard.userId,
      sync_version: dbCard.syncVersion,
      updated_at: dbCard.updatedAt.toISOString(),
      created_at: dbCard.createdAt.toISOString(),
      thumbnail_url: dbCard.thumbnailUrl
    }
  }

  // 数据库文件夹 → 云端文件夹
  static toCloudFolder(dbFolder: DbFolder): any {
    return {
      id: dbFolder.id,
      name: dbFolder.name,
      parent_id: dbFolder.parentId,
      description: dbFolder.description || '',
      color: dbFolder.color,
      icon: dbFolder.icon,
      order_index: dbFolder.order || 0,
      card_ids: dbFolder.cardIds || [],
      user_id: dbFolder.userId,
      sync_version: dbFolder.syncVersion,
      updated_at: dbFolder.updatedAt.toISOString(),
      created_at: dbFolder.createdAt.toISOString(),
      full_path: dbFolder.fullPath || dbFolder.name,
      depth: dbFolder.depth || 0,
      is_expanded: dbFolder.isExpanded ?? true
    }
  }

  // 数据库标签 → 云端标签
  static toCloudTag(dbTag: DbTag): any {
    return {
      id: dbTag.id,
      name: dbTag.name,
      color: dbTag.color,
      description: dbTag.description,
      count: dbTag.count,
      user_id: dbTag.userId,
      sync_version: dbTag.syncVersion,
      updated_at: dbTag.updatedAt.toISOString(),
      created_at: dbTag.createdAt.toISOString()
    }
  }

  // 从云端数据生成搜索向量
  private static generateSearchVectorFromCloud(cloudCard: any): string {
    const searchableText = [
      cloudCard.front_content?.title || '',
      cloudCard.front_content?.text || '',
      cloudCard.back_content?.title || '',
      cloudCard.back_content?.text || '',
      ...(cloudCard.front_content?.tags || []),
      ...(cloudCard.back_content?.tags || [])
    ].join(' ').toLowerCase()
    
    return searchableText
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // ============================================================================
  // 数据验证
  // ============================================================================

  // 验证卡片数据
  static validateCardData(card: Partial<Card>): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!card.frontContent?.title?.trim()) {
      errors.push('卡片正面标题不能为空')
    }

    if (!card.backContent?.title?.trim()) {
      errors.push('卡片背面标题不能为空')
    }

    if (card.style && !['solid', 'gradient', 'glass'].includes(card.style.type)) {
      errors.push('无效的卡片样式类型')
    }

    // 验证图片数据
    const validateImages = (images: ImageData[]) => {
      images.forEach((img, index) => {
        if (!img.url) {
          errors.push(`第${index + 1}张图片URL不能为空`)
        }
        if (img.width <= 0 || img.height <= 0) {
          errors.push(`第${index + 1}张图片尺寸无效`)
        }
      })
    }

    if (card.frontContent?.images) {
      validateImages(card.frontContent.images)
    }

    if (card.backContent?.images) {
      validateImages(card.backContent.images)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // 验证文件夹数据
  static validateFolderData(folder: Partial<Folder>): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!folder.name?.trim()) {
      errors.push('文件夹名称不能为空')
    }

    if (folder.name && folder.name.length > 50) {
      errors.push('文件夹名称不能超过50个字符')
    }

    if (folder.color && !/^#[0-9A-Fa-f]{6}$/.test(folder.color)) {
      errors.push('文件夹颜色格式无效')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // 验证标签数据
  static validateTagData(tag: Partial<Tag>): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!tag.name?.trim()) {
      errors.push('标签名称不能为空')
    }

    if (tag.name && tag.name.length > 30) {
      errors.push('标签名称不能超过30个字符')
    }

    if (tag.color && !/^#[0-9A-Fa-f]{6}$/.test(tag.color)) {
      errors.push('标签颜色格式无效')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // ============================================================================
  // 批量操作支持
  // ============================================================================

  // 批量转换卡片
  static batchToDbCards(cards: Partial<Card>[], userId?: string): DbCard[] {
    return cards.map(card => this.toDbCard(card, userId))
  }

  // 批量转换文件夹
  static batchToDbFolders(folders: Partial<Folder>[], userId?: string): DbFolder[] {
    return folders.map(folder => this.toDbFolder(folder, userId))
  }

  // 批量转换标签
  static batchToDbTags(tags: Partial<Tag>[], userId?: string): DbTag[] {
    return tags.map(tag => this.toDbTag(tag, userId))
  }

  // ============================================================================
  // 数据清理和优化
  // ============================================================================

  // 清理卡片数据
  static sanitizeCardData(card: Partial<Card>): Partial<Card> {
    const sanitized = { ...card }

    // 清理标题和文本
    if (sanitized.frontContent) {
      sanitized.frontContent = {
        ...sanitized.frontContent,
        title: (sanitized.frontContent.title || '').trim(),
        text: (sanitized.frontContent.text || '').trim(),
        tags: (sanitized.frontContent.tags || []).map(tag => tag.trim()).filter(Boolean)
      }
    }

    if (sanitized.backContent) {
      sanitized.backContent = {
        ...sanitized.backContent,
        title: (sanitized.backContent.title || '').trim(),
        text: (sanitized.backContent.text || '').trim(),
        tags: (sanitized.backContent.tags || []).map(tag => tag.trim()).filter(Boolean)
      }
    }

    // 清理样式
    if (sanitized.style) {
      sanitized.style = {
        ...sanitized.style,
        backgroundColor: sanitized.style.backgroundColor || '#ffffff',
        textColor: sanitized.style.textColor || '#000000'
      }
    }

    return sanitized
  }

  // 优化图片数据
  static optimizeImageData(image: Partial<ImageData>): Partial<ImageData> {
    return {
      ...image,
      format: image.format || 'jpg',
      compressed: image.compressed ?? true,
      quality: Math.min(Math.max(image.quality || 0.8, 0.1), 1.0)
    }
  }

  // ============================================================================
  // 性能优化
  // ============================================================================

  // 创建转换缓存
  private static conversionCache = new Map<string, any>()
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5分钟

  // 带缓存的转换
  static cachedConvert<T, U>(
    key: string,
    data: T,
    converter: (data: T) => U
  ): U {
    const cacheKey = `${key}:${JSON.stringify(data)}`
    const cached = this.conversionCache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }
    
    const result = converter(data)
    this.conversionCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    })
    
    return result
  }

  // 清理转换缓存
  static clearConversionCache(): void {
    this.conversionCache.clear()
  }

  // 定期清理过期缓存
  static startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now()
      for (const [key, value] of this.conversionCache.entries()) {
        if (now - value.timestamp > this.CACHE_TTL) {
          this.conversionCache.delete(key)
        }
      }
    }, this.CACHE_TTL)
  }
}

// ============================================================================
// 导出便捷方法
// ============================================================================

// 便捷的转换方法
export const toDbCard = (card: Partial<Card>, userId?: string) => 
  DataConverter.toDbCard(card, userId)

export const fromDbCard = (dbCard: DbCard) => 
  DataConverter.fromDbCard(dbCard)

export const toDbFolder = (folder: Partial<Folder>, userId?: string) => 
  DataConverter.toDbFolder(folder, userId)

export const fromDbFolder = (dbFolder: DbFolder) => 
  DataConverter.fromDbFolder(dbFolder)

export const toDbTag = (tag: Partial<Tag>, userId?: string) => 
  DataConverter.toDbTag(tag, userId)

export const fromDbTag = (dbTag: DbTag) => 
  DataConverter.fromDbTag(dbTag)

export const toDbImage = (image: Partial<ImageData>, cardId: string, userId?: string) => 
  DataConverter.toDbImage(image, cardId, userId)

export const fromDbImage = (dbImage: DbImage) => 
  DataConverter.fromDbImage(dbImage)

// 初始化转换器
export const initializeDataConverter = (): void => {
  DataConverter.startCacheCleanup()
  console.log('Data converter initialized')
}

// 导出单例实例
export const dataConverter = new DataConverter()