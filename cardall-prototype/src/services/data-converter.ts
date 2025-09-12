import { Card, Folder, Tag, ImageData } from '@/types/card'
import { 
  DbCard, 
  DbFolder, 
  DbTag, 
  DbImage, 
  SyncOperation,
  LegacySyncOperation,
  convertToDbCard,
  convertFromDbCard 
} from './database'

// ============================================================================
// 数据类型转换层 - 统一不同数据库接口的数据格式
// ============================================================================

export interface ConversionContext {
  userId?: string
  timestamp?: Date
  isMigration?: boolean
}

export interface ConversionResult<T> {
  success: boolean
  data?: T
  errors: string[]
  warnings: string[]
}

// ============================================================================
// 卡片数据转换器
// ============================================================================

export class CardDataConverter {
  
  // 将前端卡片转换为数据库卡片
  static toDbCard(
    card: Card, 
    context: ConversionContext = {}
  ): ConversionResult<DbCard> {
    const errors: string[] = []
    const warnings: string[] = []
    
    try {
      // 数据验证
      const validationErrors = this.validateCardData(card)
      if (validationErrors.length > 0) {
        errors.push(...validationErrors)
      }
      
      // 创建数据库卡片
      const dbCard: DbCard = {
        ...card,
        userId: context.userId || 'default',
        syncVersion: context.isMigration ? 0 : 1,
        pendingSync: !context.isMigration,
        updatedAt: context.timestamp || new Date(),
        // 添加搜索优化字段
        searchVector: this.generateSearchVector(card)
      }
      
      // 处理图片数据
      if (card.frontContent.images.length > 0 || card.backContent.images.length > 0) {
        const imageWarnings = this.validateImageData(card)
        warnings.push(...imageWarnings)
      }
      
      return {
        success: errors.length === 0,
        data: dbCard,
        errors,
        warnings
      }
      
    } catch (error) {
      return {
        success: false,
        errors: [`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings
      }
    }
  }
  
  // 将数据库卡片转换为前端卡片
  static fromDbCard(dbCard: DbCard): ConversionResult<Card> {
    const errors: string[] = []
    const warnings: string[] = []
    
    try {
      // 数据验证
      if (!dbCard.id) {
        errors.push('Database card missing ID')
      }
      
      if (!dbCard.frontContent?.title) {
        errors.push('Front content title is required')
      }
      
      if (!dbCard.backContent?.title) {
        errors.push('Back content title is required')
      }
      
      // 转换为前端格式
      const card: Card = {
        id: dbCard.id || '',
        frontContent: {
          ...dbCard.frontContent,
          lastModified: new Date(dbCard.frontContent.lastModified)
        },
        backContent: {
          ...dbCard.backContent,
          lastModified: new Date(dbCard.backContent.lastModified)
        },
        style: dbCard.style,
        isFlipped: dbCard.isFlipped || false,
        createdAt: new Date(dbCard.createdAt),
        updatedAt: new Date(dbCard.updatedAt),
        folderId: dbCard.folderId,
        isSelected: dbCard.isSelected || false
      }
      
      return {
        success: errors.length === 0,
        data: card,
        errors,
        warnings
      }
      
    } catch (error) {
      return {
        success: false,
        errors: [`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings
      }
    }
  }
  
  // 批量转换卡片
  static batchToDbCards(
    cards: Card[], 
    context: ConversionContext = {}
  ): ConversionResult<DbCard[]> {
    const results: DbCard[] = []
    const allErrors: string[] = []
    const allWarnings: string[] = []
    
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]
      const result = this.toDbCard(card, { ...context, timestamp: new Date() })
      
      if (result.success && result.data) {
        results.push(result.data)
      }
      
      allErrors.push(...result.errors.map(err => `Card ${i}: ${err}`))
      allWarnings.push(...result.warnings.map(warn => `Card ${i}: ${warn}`))
    }
    
    return {
      success: allErrors.length === 0,
      data: results,
      errors: allErrors,
      warnings: allWarnings
    }
  }
  
  // 批量转换数据库卡片
  static batchFromDbCards(dbCards: DbCard[]): ConversionResult<Card[]> {
    const results: Card[] = []
    const allErrors: string[] = []
    const allWarnings: string[] = []
    
    for (let i = 0; i < dbCards.length; i++) {
      const dbCard = dbCards[i]
      const result = this.fromDbCard(dbCard)
      
      if (result.success && result.data) {
        results.push(result.data)
      }
      
      allErrors.push(...result.errors.map(err => `Card ${i}: ${err}`))
      allWarnings.push(...result.warnings.map(warn => `Card ${i}: ${warn}`))
    }
    
    return {
      success: allErrors.length === 0,
      data: results,
      errors: allErrors,
      warnings: allWarnings
    }
  }
  
  // 验证卡片数据
  private static validateCardData(card: Partial<Card>): string[] {
    const errors: string[] = []
    
    if (!card.frontContent?.title?.trim()) {
      errors.push('Front content title is required')
    }
    
    if (!card.backContent?.title?.trim()) {
      errors.push('Back content title is required')
    }
    
    if (card.style && !['solid', 'gradient', 'glass'].includes(card.style.type)) {
      errors.push('Invalid card style type')
    }
    
    // 验证图片数据
    if (card.frontContent?.images) {
      card.frontContent.images.forEach((img, index) => {
        if (!img.id) errors.push(`Front image ${index}: Missing ID`)
        if (!img.url) errors.push(`Front image ${index}: Missing URL`)
        if (!img.alt) errors.push(`Front image ${index}: Missing alt text`)
      })
    }
    
    if (card.backContent?.images) {
      card.backContent.images.forEach((img, index) => {
        if (!img.id) errors.push(`Back image ${index}: Missing ID`)
        if (!img.url) errors.push(`Back image ${index}: Missing URL`)
        if (!img.alt) errors.push(`Back image ${index}: Missing alt text`)
      })
    }
    
    return errors
  }
  
  // 验证图片数据
  private static validateImageData(card: Card): string[] {
    const warnings: string[] = []
    const allImages = [...card.frontContent.images, ...card.backContent.images]
    
    allImages.forEach((img, index) => {
      if (img.url && img.url.startsWith('data:') && img.url.length > 1000000) {
        warnings.push(`Image ${index}: Large base64 image detected (>1MB), consider compression`)
      }
      
      if (img.width && img.height && img.width > 4000 || img.height > 4000) {
        warnings.push(`Image ${index}: Large dimensions detected (${img.width}x${img.height}), consider resizing`)
      }
    })
    
    return warnings
  }
  
  // 生成搜索向量
  private static generateSearchVector(card: Card): string {
    const searchableText = [
      card.frontContent.title,
      card.frontContent.text,
      card.backContent.title,
      card.backContent.text,
      ...card.frontContent.tags,
      ...card.backContent.tags
    ].join(' ').toLowerCase()
    
    return searchableText
  }
}

// ============================================================================
// 文件夹数据转换器
// ============================================================================

export class FolderDataConverter {
  
  static toDbFolder(
    folder: Folder, 
    context: ConversionContext = {}
  ): ConversionResult<DbFolder> {
    const errors: string[] = []
    const warnings: string[] = []
    
    try {
      // 数据验证
      if (!folder.name?.trim()) {
        errors.push('Folder name is required')
      }
      
      // 创建数据库文件夹
      const dbFolder: DbFolder = {
        ...folder,
        userId: context.userId || 'default',
        syncVersion: context.isMigration ? 0 : 1,
        pendingSync: !context.isMigration,
        updatedAt: context.timestamp || new Date(),
        // 添加路径优化字段
        fullPath: this.generateFullPath(folder),
        depth: this.calculateDepth(folder)
      }
      
      return {
        success: errors.length === 0,
        data: dbFolder,
        errors,
        warnings
      }
      
    } catch (error) {
      return {
        success: false,
        errors: [`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings
      }
    }
  }
  
  static fromDbFolder(dbFolder: DbFolder): ConversionResult<Folder> {
    const errors: string[] = []
    const warnings: string[] = []
    
    try {
      // 数据验证
      if (!dbFolder.id) {
        errors.push('Database folder missing ID')
      }
      
      if (!dbFolder.name?.trim()) {
        errors.push('Folder name is required')
      }
      
      // 转换为前端格式
      const folder: Folder = {
        id: dbFolder.id || '',
        name: dbFolder.name,
        color: dbFolder.color,
        icon: dbFolder.icon,
        cardIds: dbFolder.cardIds || [],
        parentId: dbFolder.parentId,
        isExpanded: dbFolder.isExpanded || false,
        createdAt: new Date(dbFolder.createdAt),
        updatedAt: new Date(dbFolder.updatedAt)
      }
      
      return {
        success: errors.length === 0,
        data: folder,
        errors,
        warnings
      }
      
    } catch (error) {
      return {
        success: false,
        errors: [`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings
      }
    }
  }
  
  // 生成完整路径
  private static generateFullPath(folder: Folder): string {
    // 这里需要递归构建完整路径，简化版本直接返回名称
    return folder.name
  }
  
  // 计算文件夹深度
  private static calculateDepth(folder: Folder): number {
    let depth = 0
    let current = folder
    
    while (current.parentId) {
      depth++
      // 在实际应用中，这里需要查找父文件夹
      break
    }
    
    return depth
  }
}

// ============================================================================
// 标签数据转换器
// ============================================================================

export class TagDataConverter {
  
  static toDbTag(
    tag: Tag, 
    context: ConversionContext = {}
  ): ConversionResult<DbTag> {
    const errors: string[] = []
    const warnings: string[] = []
    
    try {
      // 数据验证
      if (!tag.name?.trim()) {
        errors.push('Tag name is required')
      }
      
      // 创建数据库标签
      const dbTag: DbTag = {
        ...tag,
        userId: context.userId || 'default',
        syncVersion: context.isMigration ? 0 : 1,
        pendingSync: !context.isMigration,
        updatedAt: context.timestamp || new Date()
      }
      
      return {
        success: errors.length === 0,
        data: dbTag,
        errors,
        warnings
      }
      
    } catch (error) {
      return {
        success: false,
        errors: [`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings
      }
    }
  }
  
  static fromDbTag(dbTag: DbTag): ConversionResult<Tag> {
    const errors: string[] = []
    const warnings: string[] = []
    
    try {
      // 数据验证
      if (!dbTag.id) {
        errors.push('Database tag missing ID')
      }
      
      if (!dbTag.name?.trim()) {
        errors.push('Tag name is required')
      }
      
      // 转换为前端格式
      const tag: Tag = {
        id: dbTag.id || '',
        name: dbTag.name,
        color: dbTag.color,
        count: dbTag.count || 0,
        isHidden: dbTag.isHidden || false,
        createdAt: new Date(dbTag.createdAt)
      }
      
      return {
        success: errors.length === 0,
        data: tag,
        errors,
        warnings
      }
      
    } catch (error) {
      return {
        success: false,
        errors: [`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings
      }
    }
  }
}

// ============================================================================
// 同步操作转换器
// ============================================================================

export class SyncOperationConverter {
  
  // 将新的同步操作格式转换为旧格式（向后兼容）
  static toLegacyFormat(operation: SyncOperation): LegacySyncOperation {
    return {
      id: operation.id,
      type: operation.type,
      table: operation.entity as any, // 类型转换
      data: operation.data,
      localId: operation.entityId,
      timestamp: operation.timestamp,
      retryCount: operation.retryCount,
      maxRetries: operation.maxRetries,
      error: operation.error
    }
  }
  
  // 将旧格式同步操作转换为新格式
  static fromLegacyFormat(legacyOp: LegacySyncOperation): SyncOperation {
    return {\n      id: legacyOp.id,\n      type: legacyOp.type,\n      entity: legacyOp.table.replace('s', '') as any, // cards -> card\n      entityId: legacyOp.localId,\n      userId: legacyOp.data?.userId,\n      data: legacyOp.data,\n      timestamp: legacyOp.timestamp,\n      retryCount: legacyOp.retryCount,\n      maxRetries: legacyOp.maxRetries,\n      error: legacyOp.error,\n      priority: 'normal' // 默认优先级\n    }\n  }\n  \n  // 验证同步操作\n  static validateOperation(operation: SyncOperation): string[] {\n    const errors: string[] = []\n    \n    if (!operation.type) {\n      errors.push('Operation type is required')\n    }\n    \n    if (!operation.entity) {\n      errors.push('Operation entity is required')\n    }\n    \n    if (!operation.entityId) {\n      errors.push('Operation entity ID is required')\n    }\n    \n    if (!operation.timestamp) {\n      errors.push('Operation timestamp is required')\n    }\n    \n    return errors\n  }\n}\n\n// ============================================================================\n// 批量数据转换工具\n// ============================================================================\n\nexport class BatchDataConverter {\n  \n  // 批量转换不同类型的数据\n  static async convertBatch<T, R>(\n    items: T[],\n    converter: (item: T, context: ConversionContext) => ConversionResult<R>,\n    context: ConversionContext = {}\n  ): Promise<ConversionResult<R[]>> {\n    const results: R[] = []\n    const allErrors: string[] = []\n    const allWarnings: string[] = []\n    \n    for (let i = 0; i < items.length; i++) {\n      const item = items[i]\n      const result = converter(item, { ...context, timestamp: new Date() })\n      \n      if (result.success && result.data) {\n        results.push(result.data)\n      }\n      \n      allErrors.push(...result.errors.map(err => `Item ${i}: ${err}`))\n      allWarnings.push(...result.warnings.map(warn => `Item ${i}: ${warn}`))\n    }\n    \n    return {\n      success: allErrors.length === 0,\n      data: results,\n      errors: allErrors,\n      warnings: allWarnings\n    }\n  }\n  \n  // 并行批量转换（适用于大数据集）\n  static async convertBatchParallel<T, R>(\n    items: T[],\n    converter: (item: T, context: ConversionContext) => Promise<ConversionResult<R>>,\n    context: ConversionContext = {},\n    batchSize: number = 50\n  ): Promise<ConversionResult<R[]>> {\n    const results: R[] = []\n    const allErrors: string[] = []\n    const allWarnings: string[] = []\n    \n    // 分批处理\n    for (let i = 0; i < items.length; i += batchSize) {\n      const batch = items.slice(i, i + batchSize)\n      \n      const batchPromises = batch.map(async (item, index) => {\n        const result = await converter(item, { ...context, timestamp: new Date() })\n        return {\n          result,\n          index: i + index\n        }\n      })\n      \n      const batchResults = await Promise.all(batchPromises)\n      \n      batchResults.forEach(({ result, index }) => {\n        if (result.success && result.data) {\n          results.push(result.data)\n        }\n        \n        allErrors.push(...result.errors.map(err => `Item ${index}: ${err}`))\n        allWarnings.push(...result.warnings.map(warn => `Item ${index}: ${warn}`))\n      })\n    }\n    \n    return {\n      success: allErrors.length === 0,\n      data: results,\n      errors: allErrors,\n      warnings: allWarnings\n    }\n  }\n}\n\n// ============================================================================\n// 数据转换缓存优化\n// ============================================================================\n\nconst conversionCache = new Map<string, { data: any; timestamp: number }>()\nconst CONVERSION_CACHE_TTL = 10 * 60 * 1000 // 10分钟缓存\n\nexport class CachedDataConverter {\n  \n  // 带缓存的转换\n  static async convertWithCache<T, R>(\n    key: string,\n    data: T,\n    converter: (data: T, context: ConversionContext) => Promise<ConversionResult<R>>,\n    context: ConversionContext = {}\n  ): Promise<ConversionResult<R>> {\n    const cacheKey = `${key}_${JSON.stringify(data)}`\n    \n    // 检查缓存\n    const cached = conversionCache.get(cacheKey)\n    if (cached && Date.now() - cached.timestamp < CONVERSION_CACHE_TTL) {\n      return cached.data\n    }\n    \n    // 执行转换\n    const result = await converter(data, context)\n    \n    // 缓存结果\n    conversionCache.set(cacheKey, {\n      data: result,\n      timestamp: Date.now()\n    })\n    \n    return result\n  }\n  \n  // 清理转换缓存\n  static clearCache(): void {\n    conversionCache.clear()\n  }\n  \n  // 定期清理过期缓存\n  static startCacheCleanup(): void {\n    setInterval(() => {\n      const now = Date.now()\n      for (const [key, value] of conversionCache.entries()) {\n        if (now - value.timestamp > CONVERSION_CACHE_TTL) {\n          conversionCache.delete(key)\n        }\n      }\n    }, CONVERSION_CACHE_TTL)\n  }\n}\n\n// 启动缓存清理\nif (typeof window !== 'undefined') {\n  CachedDataConverter.startCacheCleanup()\n}\n\n// ============================================================================\n// 导出便捷方法\n// ============================================================================\n\n// 便捷的转换方法\nexport const convertCard = (card: Card, context?: ConversionContext) => \n  CardDataConverter.toDbCard(card, context)\n\nexport const convertDbCard = (dbCard: DbCard) => \n  CardDataConverter.fromDbCard(dbCard)\n\nexport const convertFolder = (folder: Folder, context?: ConversionContext) => \n  FolderDataConverter.toDbFolder(folder, context)\n\nexport const convertDbFolder = (dbFolder: DbFolder) => \n  FolderDataConverter.fromDbFolder(dbFolder)\n\nexport const convertTag = (tag: Tag, context?: ConversionContext) => \n  TagDataConverter.toDbTag(tag, context)\n\nexport const convertDbTag = (dbTag: DbTag) => \n  TagDataConverter.fromDbTag(dbTag)\n\n// 导出默认转换器实例\nexport const dataConverter = {\n  card: CardDataConverter,\n  folder: FolderDataConverter,\n  tag: TagDataConverter,\n  sync: SyncOperationConverter,\n  batch: BatchDataConverter,\n  cached: CachedDataConverter\n}