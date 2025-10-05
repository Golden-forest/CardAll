import { db, DbCard, DbFolder, DbTag, DbImage } from './database-unified'
import { Card, Folder, Tag } from '@/types/card'

// ============================================================================
// 数据验证服务 - 确保数据完整性和一致性
// ============================================================================

export export export export export export   metadata: {
    deviceInfo: string
    storageQuota: { used: number; total: number }
    databaseStats: any
    migrationId?: string
  }
}

/**
 * 数据验证服务
 * 提供全面的数据验证和完整性检查功能
 */
class DataValidatorService {
  private validationRules: Map<string, ValidationRule[]> = new Map()
  private validationCache = new Map<string, ValidationResult>()
  private cacheTTL = 5 * 60 * 1000 // 5分钟缓存

  constructor() {
    this.initializeValidationRules()
  }

  /**
   * 初始化验证规则
   */
  private initializeValidationRules(): void {
    // 卡片验证规则
    this.validationRules.set('card', [
      {
        id: 'card-missing-front-title',
        name: '卡片正面标题必填',
        description: '卡片必须包含正面标题',
        entityType: 'card',
        severity: 'critical',
        validator: (card: Card) => !!card.frontContent?.title?.trim(),
        message: '卡片缺少正面标题',
        suggestedFix: '为卡片添加正面标题'
      },
      {
        id: 'card-missing-back-title',
        name: '卡片背面标题必填',
        description: '卡片必须包含背面标题',
        entityType: 'card',
        severity: 'critical',
        validator: (card: Card) => !!card.backContent?.title?.trim(),
        message: '卡片缺少背面标题',
        suggestedFix: '为卡片添加背面标题'
      },
      {
        id: 'card-invalid-style',
        name: '卡片样式验证',
        description: '卡片样式必须是有效类型',
        entityType: 'card',
        severity: 'medium',
        validator: (card: Card) => !card.style || ['solid', 'gradient', 'glass'].includes(card.style.type),
        message: '卡片样式类型无效',
        suggestedFix: '使用 solid、gradient 或 glass 样式'
      },
      {
        id: 'card-empty-content',
        name: '卡片内容验证',
        description: '卡片不能完全为空',
        entityType: 'card',
        severity: 'high',
        validator: (card: Card) => {
          const hasContent =
            card.frontContent.title.trim() ||
            card.frontContent.text.trim() ||
            card.backContent.title.trim() ||
            card.backContent.text.trim() ||
            card.frontContent.images.length > 0 ||
            card.backContent.images.length > 0
          return hasContent
        },
        message: '卡片内容为空',
        suggestedFix: '为卡片添加正面或背面内容'
      },
      {
        id: 'card-invalid-created-date',
        name: '创建日期验证',
        description: '卡片创建日期必须有效',
        entityType: 'card',
        severity: 'medium',
        validator: (card: Card) => {
          const created = new Date(card.createdAt)
          return !isNaN(created.getTime()) && created <= new Date()
        },
        message: '卡片创建日期无效',
        suggestedFix: '设置有效的创建日期'
      }
    ])

    // 文件夹验证规则
    this.validationRules.set('folder', [
      {
        id: 'folder-missing-name',
        name: '文件夹名称必填',
        description: '文件夹必须包含名称',
        entityType: 'folder',
        severity: 'critical',
        validator: (folder: Folder) => !!folder.name?.trim(),
        message: '文件夹缺少名称',
        suggestedFix: '为文件夹设置名称'
      },
      {
        id: 'folder-duplicate-name',
        name: '文件夹名称唯一性',
        description: '同级文件夹名称必须唯一',
        entityType: 'folder',
        severity: 'medium',
        validator: async (folder: Folder) => {
          // 需要在运行时验证同级文件夹
          return true // 简化实现
        },
        message: '文件夹名称重复',
        suggestedFix: '使用唯一的文件夹名称'
      },
      {
        id: 'folder-circular-reference',
        name: '文件夹循环引用',
        description: '文件夹不能循环引用',
        entityType: 'folder',
        severity: 'critical',
        validator: async (folder: Folder) => {
          // 需要在运行时检查循环引用
          return true // 简化实现
        },
        message: '文件夹存在循环引用',
        suggestedFix: '重新组织文件夹结构以避免循环引用'
      }
    ])

    // 标签验证规则
    this.validationRules.set('tag', [
      {
        id: 'tag-missing-name',
        name: '标签名称必填',
        description: '标签必须包含名称',
        entityType: 'tag',
        severity: 'critical',
        validator: (tag: Tag) => !!tag.name?.trim(),
        message: '标签缺少名称',
        suggestedFix: '为标签设置名称'
      },
      {
        id: 'tag-invalid-color',
        name: '标签颜色验证',
        description: '标签颜色格式必须有效',
        entityType: 'tag',
        severity: 'low',
        validator: (tag: Tag) => !tag.color || /^#[0-9A-Fa-f]{6}$/.test(tag.color),
        message: '标签颜色格式无效',
        suggestedFix: '使用有效的十六进制颜色格式（如 #FF5733）'
      }
    ])

    // 图片验证规则
    this.validationRules.set('image', [
      {
        id: 'image-missing-filepath',
        name: '图片路径必填',
        description: '图片必须包含文件路径',
        entityType: 'image',
        severity: 'critical',
        validator: (image: DbImage) => !!image.filePath?.trim(),
        message: '图片缺少文件路径',
        suggestedFix: '为图片设置有效的文件路径'
      },
      {
        id: 'image-invalid-metadata',
        name: '图片元数据验证',
        description: '图片元数据必须完整',
        entityType: 'image',
        severity: 'high',
        validator: (image: DbImage) => {
          return image.metadata &&
                 image.metadata.size > 0 &&
                 image.metadata.width > 0 &&
                 image.metadata.height > 0
        },
        message: '图片元数据不完整',
        suggestedFix: '确保图片包含完整的尺寸和大小信息'
      },
      {
        id: 'image-large-file',
        name: '图片大小验证',
        description: '图片文件不应过大',
        entityType: 'image',
        severity: 'medium',
        validator: (image: DbImage) => image.metadata.size <= 10 * 1024 * 1024, // 10MB
        message: '图片文件过大',
        suggestedFix: '压缩图片或使用更小的图片格式'
      }
    ])
  }

  /**
   * 验证单个实体
   */
  async validateEntity<T>(
    entity: T,
    entityType: 'card' | 'folder' | 'tag' | 'image' | 'setting'
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    const rules = this.validationRules.get(entityType) || []

    for (const rule of rules) {
      try {
        const isValid = await Promise.resolve(rule.validator(entity))
        if (!isValid) {
          errors.push({
            id: rule.id,
            type: this.getErrorType(rule.id),
            severity: rule.severity,
            entityType,
            entityId: (entity as any).id || 'unknown',
            field: this.getFieldFromRule(rule.id),
            message: rule.message,
            suggestedFix: rule.suggestedFix
          })
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }-validation-error`,
          type: 'data_corruption',
          severity: 'critical',
          entityType,
          entityId: (entity as any).id || 'unknown',
          message: `验证规则执行失败: ${error}`,
          suggestedFix: '检查数据格式或联系技术支持'
        })
      }
    }

    // 执行额外的实体特定验证
    const additionalValidation = await this.performAdditionalValidation(entity, entityType)
    errors.push(...additionalValidation.errors)
    warnings.push(...additionalValidation.warnings)

    const score = this.calculateScore(errors, warnings)

    return {
      isValid: errors.length === 0,
      score,
      errors,
      warnings,
      stats: this.createStats(errors, warnings, 1),
      recommendations: this.generateRecommendations(errors, warnings)
    }
  }

  /**
   * 验证所有数据
   */
  async validateAllData(): Promise<ValidationResult> {
    const startTime = Date.now()
    const cacheKey = 'all-data-validation'

    // 检查缓存
    const cached = this.validationCache.get(cacheKey)
    if (cached && Date.now() - cached.stats.lastValidated.getTime() < this.cacheTTL) {
      return cached
    }

    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    console.log('Starting comprehensive data validation...')

    // 验证卡片
    const cards = await db.cards.toArray()
    for (const card of cards) {
      const result = await this.validateEntity(card, 'card')
      errors.push(...result.errors)
      warnings.push(...result.warnings)
    }

    // 验证文件夹
    const folders = await db.folders.toArray()
    for (const folder of folders) {
      const result = await this.validateEntity(folder, 'folder')
      errors.push(...result.errors)
      warnings.push(...result.warnings)
    }

    // 验证标签
    const tags = await db.tags.toArray()
    for (const tag of tags) {
      const result = await this.validateEntity(tag, 'tag')
      errors.push(...result.errors)
      warnings.push(...result.warnings)
    }

    // 验证图片
    const images = await db.images.toArray()
    for (const image of images) {
      const result = await this.validateEntity(image, 'image')
      errors.push(...result.errors)
      warnings.push(...result.warnings)
    }

    // 执行数据一致性验证
    const consistencyResult = await this.validateDataConsistency()
    errors.push(...consistencyResult.errors)
    warnings.push(...consistencyResult.warnings)

    // 执行性能验证
    const performanceResult = await this.validatePerformance()
    warnings.push(...performanceResult.warnings)

    const totalEntities = cards.length + folders.length + tags.length + images.length
    const score = this.calculateScore(errors, warnings)
    const validationTime = Date.now() - startTime

    const result: ValidationResult = {
      isValid: errors.filter(e => e.severity === 'critical').length === 0,
      score,
      errors,
      warnings,
      stats: {
        totalEntities,
        validEntities: totalEntities - errors.length,
        invalidEntities: errors.length,
        criticalErrors: errors.filter(e => e.severity === 'critical').length,
        highErrors: errors.filter(e => e.severity === 'high').length,
        mediumErrors: errors.filter(e => e.severity === 'medium').length,
        lowErrors: errors.filter(e => e.severity === 'low').length,
        warnings: warnings.length,
        dataQualityScore: score,
        lastValidated: new Date(),
        validationTime
      },
      recommendations: this.generateRecommendations(errors, warnings)
    }

    // 缓存结果
    this.validationCache.set(cacheKey, result)

    console.log(`Data validation completed in ${validationTime}ms. Score: ${score}/100`)

    return result
  }

  /**
   * 验证数据一致性
   */
  private async validateDataConsistency(): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    try {
      // 验证引用完整性
      await this.validateReferenceIntegrity(errors, warnings)

      // 验证数据同步状态
      await this.validateSyncStatus(errors, warnings)

      // 验证数据完整性
      await this.validateDataIntegrity(errors, warnings)

    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        suggestedFix: '重新启动应用或联系技术支持'
      })
    }

    return { errors, warnings }
  }

  /**
   * 验证引用完整性
   */
  private async validateReferenceIntegrity(errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
    // 检查孤立图片
    const images = await db.images.toArray()
    const cardIds = new Set((await db.cards.toArray()).map(c => c.id))

    const orphanedImages = images.filter(image => !cardIds.has(image.cardId))
    for (const image of orphanedImages) {
      errors.push({
        id: 'orphaned-image',
        type: 'reference_broken',
        severity: 'medium',
        entityType: 'image',
        entityId: image.id || 'unknown',
        message: '图片没有对应的卡片',
        suggestedFix: '删除孤立图片或重新关联到有效卡片'
      })
    }

    // 检查无效的文件夹引用
    const cards = await db.cards.toArray()
    const folderIds = new Set((await db.folders.toArray()).map(f => f.id))

    const cardsWithInvalidFolders = cards.filter(card =>
      card.folderId && !folderIds.has(card.folderId)
    )

    for (const card of cardsWithInvalidFolders) {
      warnings.push({
        id: 'invalid-folder-reference',
        type: 'consistency',
        severity: 'medium',
        entityType: 'card',
        entityId: card.id || 'unknown',
        field: 'folderId',
        message: '卡片引用了不存在的文件夹',
        recommendation: '将卡片移动到有效文件夹或设置为无文件夹'
      })
    }
  }

  /**
   * 验证同步状态
   */
  private async validateSyncStatus(errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
    // 检查长时间未同步的项目
    const syncThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24小时前

    const oldPendingCards = await db.cards
      .where('pendingSync')
      .equals(true)
      .filter(card => new Date(card.updatedAt) < syncThreshold)
      .toArray()

    for (const card of oldPendingCards) {
      warnings.push({
        id: 'long-pending-sync',
        type: 'performance',
        severity: 'medium',
        entityType: 'card',
        entityId: card.id || 'unknown',
        message: '卡片长时间未同步',
        recommendation: '检查网络连接并手动同步'
      })
    }

    // 检查同步队列中的过期项目
    const expiredSyncOps = await db.syncQueue
      .where('timestamp')
      .below(syncThreshold)
      .toArray()

    if (expiredSyncOps.length > 0) {
      warnings.push({
        id: 'expired-sync-queue',
        type: 'performance',
        severity: 'high',
        entityType: 'system',
        message: `发现 ${expiredSyncOps.length} 个过期的同步队列项目`,
        recommendation: '清理同步队列并检查同步功能'
      })
    }
  }

  /**
   * 验证数据完整性
   */
  private async validateDataIntegrity(errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
    // 检查重复ID
    const checkDuplicateIds = async <T extends { id?: string }>(
      tableName: string,
      entities: T[]
    ) => {
      const idMap = new Map<string, number>()
      const duplicates: string[] = []

      for (const entity of entities) {
        if (entity.id) {
          const count = idMap.get(entity.id) || 0
          idMap.set(entity.id, count + 1)
          if (count === 1) {
            duplicates.push(entity.id)
          }
        }
      }

      for (const duplicateId of duplicates) {
        errors.push({
          id: `duplicate-id-${tableName}`,
          type: 'data_corruption',
          severity: 'critical',
          entityType: tableName as any,
          entityId: duplicateId,
          message: `发现重复的ID: ${duplicateId}`,
          suggestedFix: '修复重复ID问题'
        })
      }
    }

    await checkDuplicateIds('card', await db.cards.toArray())
    await checkDuplicateIds('folder', await db.folders.toArray())
    await checkDuplicateIds('tag', await db.tags.toArray())

    // 检查数据库健康状态
    const health = await db.healthCheck()
    if (!health.isHealthy) {
      for (const issue of health.issues) {
        errors.push({
          id: 'database-health-issue',
          type: 'data_corruption',
          severity: 'critical',
          entityType: 'system',
          entityId: 'system',
          message: `数据库健康问题: ${issue}`,
          suggestedFix: '修复数据库问题或重新初始化数据库'
        })
      }
    }
  }

  /**
   * 验证性能相关警告
   */
  private async validatePerformance(): Promise<{ warnings: ValidationWarning[] }> {
    const warnings: ValidationWarning[] = []

    // 检查数据大小
    const stats = await db.getStats()
    if (stats.totalSize > 100 * 1024 * 1024) { // 100MB
      warnings.push({
        id: 'large-database-size',
        type: 'performance',
        severity: 'medium',
        entityType: 'system',
        message: `数据库大小较大: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`,
        recommendation: '考虑清理不必要的数据或优化存储'
      })
    }

    // 检查图片数量
    if (stats.images > 1000) {
      warnings.push({
        id: 'many-images',
        type: 'performance',
        severity: 'medium',
        entityType: 'system',
        message: `发现大量图片: ${stats.images} 个`,
        recommendation: '考虑压缩图片或使用外部存储'
      })
    }

    // 检查待同步项目数量
    if (stats.pendingSync > 50) {
      warnings.push({
        id: 'many-pending-sync',
        type: 'performance',
        severity: 'high',
        entityType: 'system',
        message: `大量待同步项目: ${stats.pendingSync} 个`,
        recommendation: '检查同步功能并及时同步数据'
      })
    }

    return { warnings }
  }

  /**
   * 执行额外的实体验证
   */
  private async performAdditionalValidation<T>(
    entity: T,
    entityType: string
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    switch (entityType) {
      case 'card':
        return await this.validateCardAdditional(entity as DbCard)
      case 'folder':
        return await this.validateFolderAdditional(entity as DbFolder)
      case 'tag':
        return await this.validateTagAdditional(entity as DbTag)
      case 'image':
        return await this.validateImageAdditional(entity as DbImage)
      default:
        return { errors: [], warnings: [] }
    }
  }

  /**
   * 额外的卡片验证
   */
  private async validateCardAdditional(card: DbCard): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // 检查标签长度
    const allTags = [...card.frontContent.tags, ...card.backContent.tags]
    for (const tag of allTags) {
      if (tag.length > 50) {
        warnings.push({
          id: 'long-tag-name',
          type: 'best_practice',
          severity: 'low',
          entityType: 'card',
          entityId: card.id || 'unknown',
          field: 'tags',
          message: `标签名称过长: ${tag}`,
          recommendation: '将标签名称缩短到50个字符以内'
        })
      }
    }

    // 检查文本长度
    const maxLength = 10000
    if (card.frontContent.text.length > maxLength) {
      warnings.push({
        id: 'long-front-text',
        type: 'performance',
        severity: 'medium',
        entityType: 'card',
        entityId: card.id || 'unknown',
        field: 'frontContent.text',
        message: '正面文本过长',
        recommendation: '考虑分割长文本或使用外部文件'
      })
    }

    if (card.backContent.text.length > maxLength) {
      warnings.push({
        id: 'long-back-text',
        type: 'performance',
        severity: 'medium',
        entityType: 'card',
        entityId: card.id || 'unknown',
        field: 'backContent.text',
        message: '背面文本过长',
        recommendation: '考虑分割长文本或使用外部文件'
      })
    }

    return { errors, warnings }
  }

  /**
   * 额外的文件夹验证
   */
  private async validateFolderAdditional(folder: DbFolder): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // 检查文件夹名称长度
    if (folder.name.length > 100) {
      warnings.push({
        id: 'long-folder-name',
        type: 'best_practice',
        severity: 'low',
        entityType: 'folder',
        entityId: folder.id || 'unknown',
        field: 'name',
        message: '文件夹名称过长',
        recommendation: '将文件夹名称缩短到100个字符以内'
      })
    }

    // 检查文件夹名称特殊字符
    if (/[<>:"/\\|?*]/.test(folder.name)) {
      errors.push({
        id: 'invalid-folder-name-chars',
        type: 'invalid_format',
        severity: 'high',
        entityType: 'folder',
        entityId: folder.id || 'unknown',
        field: 'name',
        message: '文件夹名称包含无效字符',
        suggestedFix: '移除特殊字符：<>:"/\\|?*'
      })
    }

    return { errors, warnings }
  }

  /**
   * 额外的标签验证
   */
  private async validateTagAdditional(tag: DbTag): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // 检查标签名称长度
    if (tag.name.length > 50) {
      warnings.push({
        id: 'long-tag-name',
        type: 'best_practice',
        severity: 'low',
        entityType: 'tag',
        entityId: tag.id || 'unknown',
        field: 'name',
        message: '标签名称过长',
        recommendation: '将标签名称缩短到50个字符以内'
      })
    }

    // 检查标签名称特殊字符
    if (tag.name.includes(',')) {
      errors.push({
        id: 'invalid-tag-name-chars',
        type: 'invalid_format',
        severity: 'medium',
        entityType: 'tag',
        entityId: tag.id || 'unknown',
        field: 'name',
        message: '标签名称不能包含逗号',
        suggestedFix: '移除标签名称中的逗号'
      })
    }

    return { errors, warnings }
  }

  /**
   * 额外的图片验证
   */
  private async validateImageAdditional(image: DbImage): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // 检查图片文件是否存在
    // 这里可以添加文件系统检查逻辑

    // 检查图片尺寸合理性
    if (image.metadata.width > 10000 || image.metadata.height > 10000) {
      warnings.push({
        id: 'very-large-image-dimensions',
        type: 'performance',
        severity: 'medium',
        entityType: 'image',
        entityId: image.id || 'unknown',
        field: 'metadata',
        message: '图片尺寸非常大',
        recommendation: '考虑调整图片尺寸以提高性能'
      })
    }

    // 检查图片宽高比
    const aspectRatio = image.metadata.width / image.metadata.height
    if (aspectRatio > 10 || aspectRatio < 0.1) {
      warnings.push({
        id: 'extreme-aspect-ratio',
        type: 'best_practice',
        severity: 'low',
        entityType: 'image',
        entityId: image.id || 'unknown',
        field: 'metadata',
        message: '图片宽高比极端',
        recommendation: '考虑调整图片宽高比以获得更好的显示效果'
      })
    }

    return { errors, warnings }
  }

  /**
   * 获取错误类型
   */
  private getErrorType(ruleId: string): ValidationError['type'] {
    if (ruleId.includes('missing')) return 'missing_field'
    if (ruleId.includes('invalid')) return 'invalid_format'
    if (ruleId.includes('reference') || ruleId.includes('orphaned')) return 'reference_broken'
    if (ruleId.includes('constraint') || ruleId.includes('duplicate')) return 'constraint_violation'
    return 'data_corruption'
  }

  /**
   * 从规则ID获取字段名
   */
  private getFieldFromRule(ruleId: string): string | undefined {
    const fieldMatch = ruleId.match(/-(\w+)$/)
    return fieldMatch ? fieldMatch[1] : undefined
  }

  /**
   * 计算数据质量分数
   */
  private calculateScore(errors: ValidationError[], warnings: ValidationWarning[]): number {
    let score = 100

    // 根据错误严重程度扣分
    const errorWeights = {
      critical: 30,
      high: 15,
      medium: 8,
      low: 3
    }

    const warningWeights = {
      high: 5,
      medium: 2,
      low: 1
    }

    for (const error of errors) {
      score -= errorWeights[error.severity]
    }

    for (const warning of warnings) {
      score -= warningWeights[warning.severity]
    }

    return Math.max(0, Math.min(100, score))
  }

  /**
   * 创建验证统计
   */
  private createStats(errors: ValidationError[], warnings: ValidationWarning[], totalEntities: number): DataValidationStats {
    return {
      totalEntities,
      validEntities: totalEntities - errors.length,
      invalidEntities: errors.length,
      criticalErrors: errors.filter(e => e.severity === 'critical').length,
      highErrors: errors.filter(e => e.severity === 'high').length,
      mediumErrors: errors.filter(e => e.severity === 'medium').length,
      lowErrors: errors.filter(e => e.severity === 'low').length,
      warnings: warnings.length,
      dataQualityScore: this.calculateScore(errors, warnings),
      lastValidated: new Date(),
      validationTime: 0
    }
  }

  /**
   * 生成修复建议
   */
  private generateRecommendations(errors: ValidationError[], warnings: ValidationWarning[]): string[] {
    const recommendations: string[] = []

    if (errors.filter(e => e.severity === 'critical').length > 0) {
      recommendations.push('发现严重错误,建议立即修复以确保数据完整性')
    }

    if (errors.filter(e => e.type === 'reference_broken').length > 0) {
      recommendations.push('存在引用完整性问题,建议检查并修复关联关系')
    }

    if (errors.filter(e => e.type === 'duplicate').length > 0) {
      recommendations.push('发现重复数据,建议清理重复项')
    }

    if (warnings.filter(w => w.type === 'performance').length > 0) {
      recommendations.push('存在性能问题,建议优化数据结构和存储')
    }

    if (warnings.filter(w => w.severity === 'high').length > 0) {
      recommendations.push('发现高优先级警告,建议关注并处理')
    }

    if (recommendations.length === 0) {
      recommendations.push('数据质量良好,建议定期验证以保持数据健康')
    }

    return recommendations
  }

  /**
   * 自动修复数据问题
   */
  async autoFixIssues(issues: ValidationError[]): Promise<{
    fixed: string[]
    failed: string[]
    warnings: string[]
  }> {
    const fixed: string[] = []
    const failed: string[] = []
    const warnings: string[] = []

    for (const issue of issues) {
      try {
        const result = await this.fixSingleIssue(issue)
        if (result.success) {
          fixed.push(issue.id)
        } else {
          failed.push(issue.id)
          if (result.warning) {
            warnings.push(result.warning)
          }
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }`)
      }
    }

    return { fixed, failed, warnings }
  }

  /**
   * 修复单个问题
   */
  private async fixSingleIssue(issue: ValidationError): Promise<{
    success: boolean
    warning?: string
  }> {
    switch (issue.type) {
      case 'missing_field':
        return await this.fixMissingField(issue)
      case 'invalid_format':
        return await this.fixInvalidFormat(issue)
      case 'reference_broken':
        return await this.fixReferenceIssue(issue)
      default:
        return { success: false, warning: '无法自动修复此类型的问题' }
    }
  }

  /**
   * 修复缺失字段
   */
  private async fixMissingField(issue: ValidationError): Promise<{
    success: boolean
    warning?: string
  }> {
    if (issue.entityType === 'card') {
      if (issue.field?.includes('title')) {
        const card = await db.cards.get(issue.entityId)
        if (card) {
          if (issue.field?.includes('front')) {
            card.frontContent.title = card.frontContent.title || '未命名卡片'
          } else {
            card.backContent.title = card.backContent.title || '未命名卡片'
          }
          await db.cards.update(issue.entityId, card)
          return { success: true }
        }
      }
    }

    if (issue.entityType === 'folder') {
      if (issue.field === 'name') {
        await db.folders.update(issue.entityId, { name: '未命名文件夹' })
        return { success: true }
      }
    }

    if (issue.entityType === 'tag') {
      if (issue.field === 'name') {
        await db.tags.update(issue.entityId, { name: '未命名标签' })
        return { success: true }
      }
    }

    return { success: false, warning: '无法自动修复缺失字段' }
  }

  /**
   * 修复格式错误
   */
  private async fixInvalidFormat(issue: ValidationError): Promise<{
    success: boolean
    warning?: string
  }> {
    if (issue.entityType === 'card' && issue.field === 'style') {
      const card = await db.cards.get(issue.entityId)
      if (card && card.style) {
        card.style.type = 'solid' // 重置为默认样式
        await db.cards.update(issue.entityId, card)
        return { success: true }
      }
    }

    return { success: false, warning: '无法自动修复格式错误' }
  }

  /**
   * 修复引用问题
   */
  private async fixReferenceIssue(issue: ValidationError): Promise<{
    success: boolean
    warning?: string
  }> {
    if (issue.entityType === 'image' && issue.type === 'reference_broken') {
      // 删除孤立图片
      await db.images.delete(issue.entityId)
      return { success: true, warning: '已删除孤立图片' }
    }

    return { success: false, warning: '无法自动修复引用问题' }
  }

  /**
   * 清除验证缓存
   */
  clearValidationCache(): void {
    this.validationCache.clear()
  }

  /**
   * 获取验证规则
   */
  getValidationRules(): Map<string, ValidationRule[]> {
    return new Map(this.validationRules)
  }

  /**
   * 添加自定义验证规则
   */
  addValidationRule(
    entityType: string,
    rule: ValidationRule
  ): void {
    if (!this.validationRules.has(entityType)) {
      this.validationRules.set(entityType, [])
    }
    this.validationRules.get(entityType)!.push(rule)
  }

  /**
   * 移除验证规则
   */
  removeValidationRule(entityType: string, ruleId: string): boolean {
    const rules = this.validationRules.get(entityType)
    if (rules) {
      const index = rules.findIndex(r => r.id === ruleId)
      if (index >= 0) {
        rules.splice(index, 1)
        return true
      }
    }
    return false
  }
}

// 创建数据验证服务实例
export const dataValidator = new DataValidatorService()

// 导出便捷函数
export const validateEntity = <T>(
  entity: T,
  entityType: 'card' | 'folder' | 'tag' | 'image' | 'setting'
) => dataValidator.validateEntity(entity, entityType)

export const validateAllData = () => dataValidator.validateAllData()

export const autoFixIssues = (issues: ValidationError[]) =>
  dataValidator.autoFixIssues(issues)

export const clearValidationCache = () => dataValidator.clearValidationCache()