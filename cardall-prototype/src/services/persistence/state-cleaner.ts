import { enhancedPersistenceManager } from './enhanced-persistence-manager'
import { db } from '@/services/database'

// ============================================================================
// 状态清理和验证机制 - Phase 3 核心组件
// ============================================================================

// 清理策略配置
export   // 保留策略
  retention: {
    sessionRetentionDays: number
    errorLogRetentionDays: number
    syncQueueRetentionDays: number
    cacheRetentionHours: number
  }

  // 验证选项
  validation: {
    enablePreCleanupValidation: boolean
    enablePostCleanupValidation: boolean
    integrityCheck: boolean
    performanceCheck: boolean
  }

  // 安全选项
  safety: {
    dryRun: boolean
    backupBeforeCleanup: boolean
    rollbackOnError: boolean
    confirmDestructiveActions: boolean
  }
}

// 清理结果
export   spaceFreed: number
  warnings: string[]
  errors: string[]
  backupCreated?: string
}

// 验证结果
export interface ValidationResult {
  isValid: boolean
  issues: Array<{
    type: 'error' | 'warning' | 'info'
    category: 'integrity' | 'consistency' | 'performance' | 'security'
    message: string
    details?: any
    severity: 'low' | 'medium' | 'high' | 'critical'
    fixable: boolean
  }>
  metrics: {
    totalItems: number
    validItems: number
    invalidItems: number
    integrityScore: number // 0-100
  }
  timestamp: Date
}

// ============================================================================
// 状态清理器类
// ============================================================================

export class StateCleaner {
  private static instance: StateCleaner
  private isCleaning = false
  private cleanupHistory: CleanupResult[] = []

  // 默认清理策略
  private defaultStrategy: CleanupStrategy = {
    scope: 'selective',
    cleanupTypes: {
      expiredSessions: true,
      orphanedData: true,
      duplicateEntries: true,
      temporaryFiles: false,
      cacheData: true,
      errorLogs: true,
      syncQueue: false
    },
    retention: {
      sessionRetentionDays: 30,
      errorLogRetentionDays: 7,
      syncQueueRetentionDays: 3,
      cacheRetentionHours: 24
    },
    validation: {
      enablePreCleanupValidation: true,
      enablePostCleanupValidation: true,
      integrityCheck: true,
      performanceCheck: true
    },
    safety: {
      dryRun: false,
      backupBeforeCleanup: true,
      rollbackOnError: true,
      confirmDestructiveActions: false
    }
  }

  private constructor() {}

  public static getInstance(): StateCleaner {
    if (!StateCleaner.instance) {
      StateCleaner.instance = new StateCleaner()
    }
    return StateCleaner.instance
  }

  // ============================================================================
  // 主要清理方法
  // ============================================================================

  /**
   * 执行状态清理
   */
  async performCleanup(strategy: Partial<CleanupStrategy> = {}): Promise<CleanupResult> {
    if (this.isCleaning) {
      throw new Error('Cleanup already in progress')
    }

    this.isCleaning = true
    const startTime = Date.now()

    try {
      console.log('Starting state cleanup...')

      // 合并策略
      const cleanupStrategy = { ...this.defaultStrategy, ...strategy }

      const result: CleanupResult = {
        success: false,
        executionTime: 0,
        cleanedItems: {
          sessions: 0,
          orphanedData: 0,
          duplicates: 0,
          temporaryFiles: 0,
          cache: 0,
          errorLogs: 0,
          syncQueue: 0
        },
        spaceFreed: 0,
        warnings: [],
        errors: []
      }

      // 1. 预清理验证
      if (cleanupStrategy.validation.enablePreCleanupValidation) {
        const preValidation = await this.validateState()
        if (!preValidation.isValid && preValidation.issues.some(i => i.severity === 'critical')) {
          throw new Error('Pre-cleanup validation failed with critical issues')
        }
      }

      // 2. 创建备份（如果要求）
      if (cleanupStrategy.safety.backupBeforeCleanup) {
        try {
          result.backupCreated = await enhancedPersistenceManager.createBackup({
            type: 'full',
            includeCards: true,
            includeFolders: true,
            includeTags: true,
            includeImages: false,
            includeSettings: true,
            includeSyncQueue: true,
            compression: true,
            compressionLevel: 6,
            encryption: false,
            storageLocation: 'local'
          })
          console.log(`Created backup: ${result.backupCreated}`)
        } catch (error) {
          console.warn("操作失败:", error)
        }`)
          if (cleanupStrategy.safety.rollbackOnError) {
            throw error
          }
        }
      }

      // 3. 执行清理操作
      if (cleanupStrategy.safety.dryRun) {
        console.log('DRY RUN: Cleanup operations will be simulated')
        await this.simulateCleanup(cleanupStrategy, result)
      } else {
        await this.executeCleanup(cleanupStrategy, result)
      }

      // 4. 后清理验证
      if (cleanupStrategy.validation.enablePostCleanupValidation && !cleanupStrategy.safety.dryRun) {
        const postValidation = await this.validateState()
        if (!postValidation.isValid) {
          result.errors.push('Post-cleanup validation failed')
          if (cleanupStrategy.safety.rollbackOnError) {
            await this.rollbackCleanup(result.backupCreated!)
            throw new Error('Cleanup failed, rolled back from backup')
          }
        }
      }

      // 5. 计算清理结果
      result.executionTime = Date.now() - startTime
      result.success = result.errors.length === 0

      // 6. 记录清理历史
      this.cleanupHistory.push(result)

      console.log(`Cleanup completed in ${result.executionTime}ms`)
      console.log(`Cleaned items:`, result.cleanedItems)
      console.log(`Space freed: ${result.spaceFreed} bytes`)

      return result

    } catch (error) {
          console.warn("操作失败:", error)
        } finally {
      this.isCleaning = false
    }
  }

  /**
   * 快速清理
   */
  async performQuickCleanup(): Promise<CleanupResult> {
    const quickStrategy: Partial<CleanupStrategy> = {
      scope: 'selective',
      cleanupTypes: {
        expiredSessions: true,
        orphanedData: true,
        duplicateEntries: false,
        temporaryFiles: false,
        cacheData: true,
        errorLogs: true,
        syncQueue: false
      },
      safety: {
        dryRun: false,
        backupBeforeCleanup: false,
        rollbackOnError: false,
        confirmDestructiveActions: false
      }
    }

    return await this.performCleanup(quickStrategy)
  }

  /**
   * 深度清理
   */
  async performDeepCleanup(): Promise<CleanupResult> {
    const deepStrategy: Partial<CleanupStrategy> = {
      scope: 'aggressive',
      cleanupTypes: {
        expiredSessions: true,
        orphanedData: true,
        duplicateEntries: true,
        temporaryFiles: true,
        cacheData: true,
        errorLogs: true,
        syncQueue: true
      },
      safety: {
        dryRun: false,
        backupBeforeCleanup: true,
        rollbackOnError: true,
        confirmDestructiveActions: true
      }
    }

    return await this.performCleanup(deepStrategy)
  }

  // ============================================================================
  // 状态验证方法
  // ============================================================================

  /**
   * 验证当前状态
   */
  async validateState(): Promise<ValidationResult> {
    const startTime = Date.now()

    try {
      console.log('Validating current state...')

      const issues: ValidationResult['issues'] = []
      let totalItems = 0
      let validItems = 0
      let invalidItems = 0

      // 数据库连接验证
      try {
        await db.tables.toArray()
        issues.push({
          type: 'info',
          category: 'integrity',
          message: 'Database connection is healthy',
          severity: 'low',
          fixable: false
        })
      } catch (error) {
          console.warn("操作失败:", error)
        }
      }

      // 数据完整性验证
      const integrityIssues = await this.validateDataIntegrity()
      issues.push(...integrityIssues)
      totalItems += integrityIssues.length

      // 引用完整性验证
      const referenceIssues = await this.validateReferenceIntegrity()
      issues.push(...referenceIssues)
      totalItems += referenceIssues.length

      // 性能验证
      const performanceIssues = await this.validatePerformance()
      issues.push(...performanceIssues)
      totalItems += performanceIssues.length

      // 安全验证
      const securityIssues = await this.validateSecurity()
      issues.push(...securityIssues)
      totalItems += securityIssues.length

      // 计算有效项目数
      validItems = issues.filter(i => i.type === 'info').length
      invalidItems = issues.filter(i => i.type === 'error' || i.type === 'warning').length

      // 计算完整性分数
      const integrityScore = this.calculateIntegrityScore(issues)

      const result: ValidationResult = {
        isValid: !issues.some(i => i.type === 'error' && i.severity === 'critical'),
        issues,
        metrics: {
          totalItems,
          validItems,
          invalidItems,
          integrityScore
        },
        timestamp: new Date()
      }

      console.log(`State validation completed in ${Date.now() - startTime}ms`)
      console.log(`Integrity score: ${integrityScore}/100`)

      return result

    } catch (error) {
          console.warn("操作失败:", error)
        }],
        metrics: {
          totalItems: 1,
          validItems: 0,
          invalidItems: 1,
          integrityScore: 0
        },
        timestamp: new Date()
      }
    }
  }

  /**
   * 验证数据完整性
   */
  private async validateDataIntegrity(): Promise<ValidationResult['issues']> {
    const issues: ValidationResult['issues'] = []

    try {
      // 验证卡片数据
      const cards = await db.cards.toArray()
      for (const card of cards) {
        if (!card.id) {
          issues.push({
            type: 'error',
            category: 'integrity',
            message: 'Card missing ID',
            details: { card },
            severity: 'high',
            fixable: false
          })
        }

        if (!card.frontContent?.title) {
          issues.push({
            type: 'warning',
            category: 'integrity',
            message: 'Card missing front title',
            details: { cardId: card.id },
            severity: 'medium',
            fixable: true
          })
        }

        if (!card.backContent?.title) {
          issues.push({
            type: 'warning',
            category: 'integrity',
            message: 'Card missing back title',
            details: { cardId: card.id },
            severity: 'medium',
            fixable: true
          })
        }

        // 验证时间戳
        if (card.updatedAt > new Date()) {
          issues.push({
            type: 'error',
            category: 'integrity',
            message: 'Card has future timestamp',
            details: { cardId: card.id, updatedAt: card.updatedAt },
            severity: 'high',
            fixable: true
          })
        }
      }

      // 验证文件夹数据
      const folders = await db.folders.toArray()
      for (const folder of folders) {
        if (!folder.id || !folder.name) {
          issues.push({
            type: 'error',
            category: 'integrity',
            message: 'Folder missing required fields',
            details: { folder },
            severity: 'high',
            fixable: false
          })
        }
      }

      // 验证标签数据
      const tags = await db.tags.toArray()
      for (const tag of tags) {
        if (!tag.id || !tag.name) {
          issues.push({
            type: 'error',
            category: 'integrity',
            message: 'Tag missing required fields',
            details: { tag },
            severity: 'high',
            fixable: false
          })
        }
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }
    }

    return issues
  }

  /**
   * 验证引用完整性
   */
  private async validateReferenceIntegrity(): Promise<ValidationResult['issues']> {
    const issues: ValidationResult['issues'] = []

    try {
      // 验证文件夹引用
      const cards = await db.cards.where('folderId').notEqual('').toArray()
      const validFolderIds = await db.folders.toCollection().primaryKeys()

      for (const card of cards) {
        if (card.folderId && !validFolderIds.includes(card.folderId)) {
          issues.push({
            type: 'warning',
            category: 'consistency',
            message: 'Card references non-existent folder',
            details: { cardId: card.id, folderId: card.folderId },
            severity: 'medium',
            fixable: true
          })
        }
      }

      // 验证图片引用
      const images = await db.images.toArray()
      const validCardIds = await db.cards.toCollection().primaryKeys()

      for (const image of images) {
        if (!validCardIds.includes(image.cardId)) {
          issues.push({
            type: 'warning',
            category: 'consistency',
            message: 'Image references non-existent card',
            details: { imageId: image.id, cardId: image.cardId },
            severity: 'medium',
            fixable: true
          })
        }
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }
    }

    return issues
  }

  /**
   * 验证性能指标
   */
  private async validatePerformance(): Promise<ValidationResult['issues']> {
    const issues: ValidationResult['issues'] = []

    try {
      // 检查数据库大小
      const stats = await db.getStats()
      const maxDatabaseSize = 500 * 1024 * 1024 // 500MB

      if (stats.totalSize > maxDatabaseSize) {
        issues.push({
          type: 'warning',
          category: 'performance',
          message: 'Database size is large',
          details: { size: stats.totalSize, maxSize: maxDatabaseSize },
          severity: 'medium',
          fixable: true
        })
      }

      // 检查待同步项目数量
      if (stats.pendingSync > 1000) {
        issues.push({
          type: 'warning',
          category: 'performance',
          message: 'High number of pending sync operations',
          details: { pendingSync: stats.pendingSync },
          severity: 'medium',
          fixable: true
        })
      }

      // 检查索引效率（简化实现）
      const cardCount = await db.cards.count()
      if (cardCount > 10000) {
        issues.push({
          type: 'info',
          category: 'performance',
          message: 'Large dataset detected, consider optimization',
          details: { cardCount },
          severity: 'low',
          fixable: true
        })
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }
    }

    return issues
  }

  /**
   * 验证安全性
   */
  private async validateSecurity(): Promise<ValidationResult['issues']> {
    const issues: ValidationResult['issues'] = []

    try {
      // 检查敏感数据存储
      const settings = await db.settings.toArray()
      const sensitiveKeys = settings.filter(s =>
        s.key.toLowerCase().includes('password') ||
        s.key.toLowerCase().includes('token') ||
        s.key.toLowerCase().includes('secret')
      )

      if (sensitiveKeys.length > 0) {
        issues.push({
          type: 'warning',
          category: 'security',
          message: 'Potentially sensitive data found in settings',
          details: { keys: sensitiveKeys.map(s => s.key) },
          severity: 'high',
          fixable: true
        })
      }

      // 检查过期会话
      const expiredSessions = await db.sessions
        .where('expiresAt')
        .below(new Date())
        .toArray()

      if (expiredSessions.length > 0) {
        issues.push({
          type: 'warning',
          category: 'security',
          message: 'Expired sessions found',
          details: { count: expiredSessions.length },
          severity: 'medium',
          fixable: true
        })
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }
    }

    return issues
  }

  /**
   * 计算完整性分数
   */
  private calculateIntegrityScore(issues: ValidationResult['issues']): number {
    if (issues.length === 0) return 100

    let score = 100
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 30
          break
        case 'high':
          score -= 20
          break
        case 'medium':
          score -= 10
          break
        case 'low':
          score -= 5
          break
      }

      switch (issue.type) {
        case 'error':
          score -= 15
          break
        case 'warning':
          score -= 5
          break
      }
    }

    return Math.max(0, Math.min(100, score))
  }

  // ============================================================================
  // 清理实现
  // ============================================================================

  /**
   * 模拟清理
   */
  private async simulateCleanup(strategy: CleanupStrategy, result: CleanupResult): Promise<void> {
    console.log('Simulating cleanup operations...')

    if (strategy.cleanupTypes.expiredSessions) {
      const expiredCount = await this.countExpiredSessions(strategy.retention.sessionRetentionDays)
      result.cleanedItems.sessions = expiredCount
      console.log(`Would clean ${expiredCount} expired sessions`)
    }

    if (strategy.cleanupTypes.orphanedData) {
      const orphanedCount = await this.countOrphanedData()
      result.cleanedItems.orphanedData = orphanedCount
      console.log(`Would clean ${orphanedCount} orphaned data items`)
    }

    if (strategy.cleanupTypes.duplicateEntries) {
      const duplicateCount = await this.countDuplicateEntries()
      result.cleanedItems.duplicates = duplicateCount
      console.log(`Would clean ${duplicateCount} duplicate entries`)
    }

    if (strategy.cleanupTypes.cacheData) {
      const cacheCount = await this.countCacheData()
      result.cleanedItems.cache = cacheCount
      console.log(`Would clean ${cacheCount} cache items`)
    }

    if (strategy.cleanupTypes.errorLogs) {
      const errorCount = await this.countErrorLogs(strategy.retention.errorLogRetentionDays)
      result.cleanedItems.errorLogs = errorCount
      console.log(`Would clean ${errorCount} error log items`)
    }
  }

  /**
   * 执行清理
   */
  private async executeCleanup(strategy: CleanupStrategy, result: CleanupResult): Promise<void> {
    console.log('Executing cleanup operations...')

    try {
      // 清理过期会话
      if (strategy.cleanupTypes.expiredSessions) {
        result.cleanedItems.sessions = await this.cleanupExpiredSessions(strategy.retention.sessionRetentionDays)
      }

      // 清理孤立数据
      if (strategy.cleanupTypes.orphanedData) {
        result.cleanedItems.orphanedData = await this.cleanupOrphanedData()
      }

      // 清理重复条目
      if (strategy.cleanupTypes.duplicateEntries) {
        result.cleanedItems.duplicates = await this.cleanupDuplicateEntries()
      }

      // 清理临时文件
      if (strategy.cleanupTypes.temporaryFiles) {
        result.cleanedItems.temporaryFiles = await this.cleanupTemporaryFiles()
      }

      // 清理缓存数据
      if (strategy.cleanupTypes.cacheData) {
        result.cleanedItems.cache = await this.cleanupCacheData(strategy.retention.cacheRetentionHours)
      }

      // 清理错误日志
      if (strategy.cleanupTypes.errorLogs) {
        result.cleanedItems.errorLogs = await this.cleanupErrorLogs(strategy.retention.errorLogRetentionDays)
      }

      // 清理同步队列
      if (strategy.cleanupTypes.syncQueue) {
        result.cleanedItems.syncQueue = await this.cleanupSyncQueue(strategy.retention.syncQueueRetentionDays)
      }

      // 计算释放的空间
      result.spaceFreed = await this.calculateSpaceFreed(result.cleanedItems)

    } catch (error) {
          console.warn("操作失败:", error)
        }`)
      throw error
    }
  }

  // ============================================================================
  // 具体清理实现
  // ============================================================================

  private async cleanupExpiredSessions(retentionDays: number): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
      const expiredSessions = await db.sessions
        .where('expiresAt')
        .below(cutoffDate)
        .toArray()

      if (expiredSessions.length > 0) {
        await db.sessions.bulkDelete(expiredSessions.map(s => s.id!))
        console.log(`Cleaned ${expiredSessions.length} expired sessions`)
      }

      return expiredSessions.length
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async cleanupOrphanedData(): Promise<number> {
    let cleanedCount = 0

    try {
      // 清理没有对应卡片的图片
      const validCardIds = await db.cards.toCollection().primaryKeys()
      const orphanedImages = await db.images
        .where('cardId')
        .noneOf(validCardIds as string[])
        .toArray()

      if (orphanedImages.length > 0) {
        await db.images.bulkDelete(orphanedImages.map(img => img.id!))
        cleanedCount += orphanedImages.length
        console.log(`Cleaned ${orphanedImages.length} orphaned images`)
      }

      // 清理无效的文件夹引用
      const validFolderIds = await db.folders.toCollection().primaryKeys()
      const cardsWithInvalidFolders = await db.cards
        .where('folderId')
        .noneOf(validFolderIds as string[])
        .toArray()

      if (cardsWithInvalidFolders.length > 0) {
        for (const card of cardsWithInvalidFolders) {
          await db.cards.update(card.id!, { folderId: undefined })
        }
        cleanedCount += cardsWithInvalidFolders.length
        console.log(`Cleaned ${cardsWithInvalidFolders.length} invalid folder references`)
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }

    return cleanedCount
  }

  private async cleanupDuplicateEntries(): Promise<number> {
    let cleanedCount = 0

    try {
      // 检查重复卡片（基于标题和内容）
      const cards = await db.cards.toArray()
      const cardSignatures = new Map<string, string[]>()

      for (const card of cards) {
        const signature = `${card.frontContent.title}_${card.backContent.title}_${card.folderId || 'root'}`
        if (!cardSignatures.has(signature)) {
          cardSignatures.set(signature, [])
        }
        cardSignatures.get(signature)!.push(card.id!)
      }

      // 删除重复项（保留最新的）
      for (const [signature, cardIds] of cardSignatures.entries()) {
        if (cardIds.length > 1) {
          // 保留最新的卡片,删除其他的
          const sortedCards = await Promise.all(
            cardIds.map(id => db.cards.get(id))
          )
          sortedCards.sort((a, b) => new Date(b!.updatedAt).getTime() - new Date(a!.updatedAt).getTime())

          const toDelete = sortedCards.slice(1).map(card => card!.id)
          await db.cards.bulkDelete(toDelete)
          cleanedCount += toDelete.length
          console.log(`Cleaned ${toDelete.length} duplicate cards for signature: ${signature}`)
        }
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }

    return cleanedCount
  }

  private async cleanupTemporaryFiles(): Promise<number> {
    // 这里可以实现临时文件清理逻辑
    // 暂时返回0,实际应用中需要检查文件系统
    return 0
  }

  private async cleanupCacheData(retentionHours: number): Promise<number> {
    try {
      // 清理增强持久化管理器的缓存
      const manager = enhancedPersistenceManager
      const method = manager['clearCache'] as () => Promise<{ success: boolean; clearedItems: number }>

      if (method) {
        const result = await method()
        if (result.success) {
          console.log(`Cleaned ${result.clearedItems} cache items`)
          return result.clearedItems
        }
      }

      return 0
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async cleanupErrorLogs(retentionDays: number): Promise<number> {
    try {
      // 清理系统状态中的错误记录
      const state = enhancedPersistenceManager.getCurrentState()
      if (state && state.systemState.errorCount > 0) {
        const previousErrorCount = state.systemState.errorCount
        state.systemState.errorCount = 0
        state.systemState.lastErrorTime = undefined
        await enhancedPersistenceManager.persistState(state)
        console.log(`Cleaned ${previousErrorCount} error log entries`)
        return previousErrorCount
      }

      return 0
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async cleanupSyncQueue(retentionDays: number): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
      const expiredSyncOperations = await db.syncQueue
        .where('timestamp')
        .below(cutoffDate)
        .toArray()

      if (expiredSyncOperations.length > 0) {
        await db.syncQueue.bulkDelete(expiredSyncOperations.map(op => op.id!))
        console.log(`Cleaned ${expiredSyncOperations.length} expired sync operations`)
      }

      return expiredSyncOperations.length
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private async countExpiredSessions(retentionDays: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    return await db.sessions
      .where('expiresAt')
      .below(cutoffDate)
      .count()
  }

  private async countOrphanedData(): Promise<number> {
    const validCardIds = await db.cards.toCollection().primaryKeys()
    const orphanedImages = await db.images
      .where('cardId')
      .noneOf(validCardIds as string[])
      .count()

    const validFolderIds = await db.folders.toCollection().primaryKeys()
    const invalidFolderReferences = await db.cards
      .where('folderId')
      .noneOf(validFolderIds as string[])
      .count()

    return orphanedImages + invalidFolderReferences
  }

  private async countDuplicateEntries(): Promise<number> {
    const cards = await db.cards.toArray()
    const cardSignatures = new Map<string, number>()

    for (const card of cards) {
      const signature = `${card.frontContent.title}_${card.backContent.title}_${card.folderId || 'root'}`
      cardSignatures.set(signature, (cardSignatures.get(signature) || 0) + 1)
    }

    return Array.from(cardSignatures.values()).filter(count => count > 1).length
  }

  private async countCacheData(): Promise<number> {
    // 简化实现
    return 0
  }

  private async countErrorLogs(retentionDays: number): Promise<number> {
    const state = enhancedPersistenceManager.getCurrentState()
    return state?.systemState.errorCount || 0
  }

  private async calculateSpaceFreed(cleanedItems: CleanupResult['cleanedItems']): Promise<number> {
    // 简化的空间计算（实际应用中需要更精确的计算）
    let estimatedSpace = 0

    // 每个会话约1KB
    estimatedSpace += cleanedItems.sessions * 1024

    // 每个孤立数据项约2KB
    estimatedSpace += cleanedItems.orphanedData * 2048

    // 每个重复条目约5KB
    estimatedSpace += cleanedItems.duplicates * 5120

    // 每个缓存项约1KB
    estimatedSpace += cleanedItems.cache * 1024

    // 每个同步操作约500B
    estimatedSpace += cleanedItems.syncQueue * 512

    return estimatedSpace
  }

  private async rollbackCleanup(backupId: string): Promise<void> {
    try {
      console.log('Rolling back cleanup from backup...')
      await enhancedPersistenceManager.restoreFromBackup(backupId, {
        scope: 'full',
        validateData: true,
        fixInconsistencies: false,
        rollbackOnError: false,
        createBackup: false,
        timeout: 60000
      })
      console.log('Cleanup rollback completed successfully')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  /**
   * 获取清理历史
   */
  getCleanupHistory(): CleanupResult[] {
    return [...this.cleanupHistory]
  }

  /**
   * 清理历史记录
   */
  clearCleanupHistory(): void {
    this.cleanupHistory = []
  }

  /**
   * 获取默认策略
   */
  getDefaultStrategy(): CleanupStrategy {
    return { ...this.defaultStrategy }
  }

  /**
   * 设置默认策略
   */
  setDefaultStrategy(strategy: CleanupStrategy): void {
    this.defaultStrategy = { ...strategy }
  }

  /**
   * 检查是否正在清理
   */
  isCleaningInProgress(): boolean {
    return this.isCleaning
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const stateCleaner = StateCleaner.getInstance()

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 执行快速清理
 */
export const performQuickCleanup = async (): Promise<CleanupResult> => {
  return await stateCleaner.performQuickCleanup()
}

/**
 * 执行深度清理
 */
export const performDeepCleanup = async (): Promise<CleanupResult> => {
  return await stateCleaner.performDeepCleanup()
}

/**
 * 验证当前状态
 */
export const validateCurrentState = async (): Promise<ValidationResult> => {
  return await stateCleaner.validateState()
}