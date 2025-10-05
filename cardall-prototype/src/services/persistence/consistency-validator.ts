import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from '@/services/database'
import { enhancedPersistenceManager } from './enhanced-persistence-manager'

// ============================================================================
// 数据一致性验证系统 - Phase 3 核心组件
// ============================================================================

// 一致性检查类型
export type ConsistencyCheckType =
  | 'entity-integrity'
  | 'reference-integrity'
  | 'data-validation'
  | 'sync-consistency'
  | 'performance-metrics'
  | 'security-audit'
  | 'storage-integrity'
  | 'index-verification'

// 一致性状态
export type ConsistencyStatus = 'valid' | 'warning' | 'invalid' | 'critical'

// 严重程度
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical'

// 一致性检查结果
export // 验证配置
export   // 自动修复选项
  autoFix: {
    enabled: boolean
    maxIssues: number
    severityThreshold: SeverityLevel
    backupBeforeFix: boolean
  }

  // 报告选项
  reporting: {
    generateReport: boolean
    includeDetails: boolean
    includeSuggestions: boolean
    format: 'json' | 'html' | 'summary'
  }
}

// 验证结果汇总
export // ============================================================================
// 数据一致性验证器
// ============================================================================

export class ConsistencyValidator {
  private static instance: ConsistencyValidator
  private isRunning = false
  private checkHistory: ConsistencyCheck[] = []

  // 默认验证配置
  private defaultConfig: ValidationConfig = {
    scope: 'essential',
    checkTypes: [
      'entity-integrity',
      'reference-integrity',
      'data-validation',
      'sync-consistency'
    ],
    options: {
      deepValidation: false,
      crossReferenceValidation: true,
      performanceValidation: true,
      securityValidation: false,
      indexValidation: false
    },
    autoFix: {
      enabled: true,
      maxIssues: 50,
      severityThreshold: 'medium',
      backupBeforeFix: true
    },
    reporting: {
      generateReport: true,
      includeDetails: true,
      includeSuggestions: true,
      format: 'summary'
    }
  }

  private constructor() {}

  public static getInstance(): ConsistencyValidator {
    if (!ConsistencyValidator.instance) {
      ConsistencyValidator.instance = new ConsistencyValidator()
    }
    return ConsistencyValidator.instance
  }

  // ============================================================================
  // 主要验证方法
  // ============================================================================

  /**
   * 执行完整性验证
   */
  async performValidation(config: Partial<ValidationConfig> = {}): Promise<{
    results: ConsistencyCheck[]
    summary: ValidationSummary
    report?: string
  }> {
    if (this.isRunning) {
      throw new Error('Validation already in progress')
    }

    this.isRunning = true
    const startTime = Date.now()

    try {
      console.log('Starting consistency validation...')

      // 合并配置
      const validationConfig = { ...this.defaultConfig, ...config }

      const results: ConsistencyCheck[] = []
      let autoFixedCount = 0

      // 执行各种检查
      for (const checkType of validationConfig.checkTypes) {
        const checkResults = await this.executeCheck(checkType, validationConfig)
        results.push(...checkResults)

        // 自动修复
        if (validationConfig.autoFix.enabled) {
          const fixableIssues = checkResults.filter(check =>
            check.autoFixable &&
            !check.resolved &&
            this.shouldAutoFix(check, validationConfig.autoFix)
          )

          for (const issue of fixableIssues) {
            const fixed = await this.autoFixIssue(issue, validationConfig.autoFix)
            if (fixed) {
              autoFixedCount++
              issue.resolved = true
              issue.resolvedAt = new Date()
              issue.resolutionMethod = 'auto-fix'
            }
          }
        }
      }

      // 生成汇总
      const summary = this.generateSummary(results, Date.now() - startTime, autoFixedCount)

      // 生成报告
      let report: string | undefined
      if (validationConfig.reporting.generateReport) {
        report = await this.generateReport(results, summary, validationConfig.reporting)
      }

      // 保存历史记录
      this.checkHistory.push(...results)
      if (this.checkHistory.length > 1000) {
        this.checkHistory = this.checkHistory.slice(-1000) // 保留最近1000条记录
      }

      console.log(`Validation completed in ${summary.executionTime}ms`)
      console.log(`Found ${results.length} issues, auto-fixed ${autoFixedCount}`)

      return { results, summary, report }

    } catch (error) {
          console.warn("操作失败:", error)
        } finally {
      this.isRunning = false
    }
  }

  /**
   * 执行快速验证
   */
  async performQuickValidation(): Promise<{
    results: ConsistencyCheck[]
    summary: ValidationSummary
  }> {
    const quickConfig: Partial<ValidationConfig> = {
      scope: 'essential',
      checkTypes: ['entity-integrity', 'reference-integrity'],
      options: {
        deepValidation: false,
        crossReferenceValidation: false,
        performanceValidation: false,
        securityValidation: false,
        indexValidation: false
      },
      autoFix: {
        enabled: false,
        maxIssues: 10,
        severityThreshold: 'high',
        backupBeforeFix: false
      },
      reporting: {
        generateReport: false,
        includeDetails: false,
        includeSuggestions: false,
        format: 'summary'
      }
    }

    return await this.performValidation(quickConfig)
  }

  /**
   * 执行深度验证
   */
  async performDeepValidation(): Promise<{
    results: ConsistencyCheck[]
    summary: ValidationSummary
    report?: string
  }> {
    const deepConfig: Partial<ValidationConfig> = {
      scope: 'full',
      checkTypes: [
        'entity-integrity',
        'reference-integrity',
        'data-validation',
        'sync-consistency',
        'performance-metrics',
        'security-audit',
        'storage-integrity',
        'index-verification'
      ],
      options: {
        deepValidation: true,
        crossReferenceValidation: true,
        performanceValidation: true,
        securityValidation: true,
        indexValidation: true
      },
      autoFix: {
        enabled: true,
        maxIssues: 100,
        severityThreshold: 'medium',
        backupBeforeFix: true
      },
      reporting: {
        generateReport: true,
        includeDetails: true,
        includeSuggestions: true,
        format: 'json'
      }
    }

    return await this.performValidation(deepConfig)
  }

  // ============================================================================
  // 具体检查实现
  // ============================================================================

  /**
   * 执行特定类型的检查
   */
  private async executeCheck(checkType: ConsistencyCheckType, config: ValidationConfig): Promise<ConsistencyCheck[]> {
    console.log(`Executing ${checkType} check...`)

    switch (checkType) {
      case 'entity-integrity':
        return await this.checkEntityIntegrity(config.options)

      case 'reference-integrity':
        return await this.checkReferenceIntegrity(config.options)

      case 'data-validation':
        return await this.checkDataValidation(config.options)

      case 'sync-consistency':
        return await this.checkSyncConsistency(config.options)

      case 'performance-metrics':
        return await this.checkPerformanceMetrics(config.options)

      case 'security-audit':
        return await this.checkSecurityAudit(config.options)

      case 'storage-integrity':
        return await this.checkStorageIntegrity(config.options)

      case 'index-verification':
        return await this.checkIndexVerification(config.options)

      default:
        console.warn(`Unknown check type: ${checkType}`)
        return []
    }
  }

  /**
   * 实体完整性检查
   */
  private async checkEntityIntegrity(options: ValidationConfig['options']): Promise<ConsistencyCheck[]> {
    const checks: ConsistencyCheck[] = []

    try {
      // 检查卡片实体
      const cards = await db.cards.toArray()
      for (const card of cards) {
        // 检查必需字段
        if (!card.id) {
          checks.push({
            id: crypto.randomUUID(),
            type: 'entity-integrity',
            status: 'critical',
            severity: 'critical',
            title: 'Missing Card ID',
            description: 'Card entity is missing required ID field',
            entityType: 'card',
            entityId: card.id,
            details: { card },
            suggestions: ['Delete corrupted card', 'Recover from backup'],
            autoFixable: false,
            timestamp: new Date(),
            resolved: false
          })
        }

        // 检查内容完整性
        if (!card.frontContent?.title || !card.backContent?.title) {
          checks.push({
            id: crypto.randomUUID(),
            type: 'entity-integrity',
            status: 'warning',
            severity: 'medium',
            title: 'Incomplete Card Content',
            description: 'Card is missing required title fields',
            entityType: 'card',
            entityId: card.id,
            details: { frontTitle: !!card.frontContent?.title, backTitle: !!card.backContent?.title },
            suggestions: ['Add missing titles', 'Set default titles'],
            autoFixable: true,
            timestamp: new Date(),
            resolved: false
          })
        }

        // 检查时间戳有效性
        if (card.updatedAt > new Date()) {
          checks.push({
            id: crypto.randomUUID(),
            type: 'entity-integrity',
            status: 'invalid',
            severity: 'high',
            title: 'Invalid Timestamp',
            description: 'Card has future timestamp',
            entityType: 'card',
            entityId: card.id,
            details: { updatedAt: card.updatedAt, currentTime: new Date() },
            suggestions: ['Update timestamp to current time'],
            autoFixable: true,
            timestamp: new Date(),
            resolved: false
          })
        }
      }

      // 检查文件夹实体
      const folders = await db.folders.toArray()
      for (const folder of folders) {
        if (!folder.id || !folder.name) {
          checks.push({
            id: crypto.randomUUID(),
            type: 'entity-integrity',
            status: 'critical',
            severity: 'critical',
            title: 'Invalid Folder',
            description: 'Folder entity is missing required fields',
            entityType: 'folder',
            entityId: folder.id,
            details: { folder },
            suggestions: ['Delete corrupted folder', 'Recover from backup'],
            autoFixable: false,
            timestamp: new Date(),
            resolved: false
          })
        }
      }

      // 检查标签实体
      const tags = await db.tags.toArray()
      for (const tag of tags) {
        if (!tag.id || !tag.name) {
          checks.push({
            id: crypto.randomUUID(),
            type: 'entity-integrity',
            status: 'critical',
            severity: 'critical',
            title: 'Invalid Tag',
            description: 'Tag entity is missing required fields',
            entityType: 'tag',
            entityId: tag.id,
            details: { tag },
            suggestions: ['Delete corrupted tag', 'Recover from backup'],
            autoFixable: false,
            timestamp: new Date(),
            resolved: false
          })
        }
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        suggestions: ['Retry validation', 'Check database connection'],
        autoFixable: false,
        timestamp: new Date(),
        resolved: false
      })
    }

    return checks
  }

  /**
   * 引用完整性检查
   */
  private async checkReferenceIntegrity(options: ValidationConfig['options']): Promise<ConsistencyCheck[]> {
    const checks: ConsistencyCheck[] = []

    try {
      // 检查卡片对文件夹的引用
      if (options.crossReferenceValidation) {
        const cards = await db.cards.where('folderId').notEqual('').toArray()
        const validFolderIds = await db.folders.toCollection().primaryKeys()

        for (const card of cards) {
          if (card.folderId && !validFolderIds.includes(card.folderId)) {
            checks.push({
              id: crypto.randomUUID(),
              type: 'reference-integrity',
              status: 'warning',
              severity: 'medium',
              title: 'Invalid Folder Reference',
              description: 'Card references non-existent folder',
              entityType: 'card',
              entityId: card.id,
              details: { folderId: card.folderId, validFolders: validFolderIds },
              suggestions: ['Remove folder reference', 'Create missing folder'],
              autoFixable: true,
              timestamp: new Date(),
              resolved: false
            })
          }
        }
      }

      // 检查图片对卡片的引用
      const images = await db.images.toArray()
      const validCardIds = await db.cards.toCollection().primaryKeys()

      for (const image of images) {
        if (!validCardIds.includes(image.cardId)) {
          checks.push({
            id: crypto.randomUUID(),
            type: 'reference-integrity',
            status: 'warning',
            severity: 'medium',
            title: 'Invalid Card Reference',
            description: 'Image references non-existent card',
            entityType: 'image',
            entityId: image.id,
            details: { cardId: image.cardId, validCards: validCardIds },
            suggestions: ['Delete orphaned image', 'Recreate referenced card'],
            autoFixable: true,
            timestamp: new Date(),
            resolved: false
          })
        }
      }

      // 检查循环引用（文件夹）
      if (options.deepValidation) {
        const folderReferences = await this.detectCircularFolderReferences()
        for (const circularRef of folderReferences) {
          checks.push({
            id: crypto.randomUUID(),
            type: 'reference-integrity',
            status: 'critical',
            severity: 'high',
            title: 'Circular Folder Reference',
            description: 'Folder contains circular reference to parent',
            entityType: 'folder',
            entityId: circularRef.folderId,
            details: circularRef,
            suggestions: ['Break circular reference', 'Reorganize folder structure'],
            autoFixable: false,
            timestamp: new Date(),
            resolved: false
          })
        }
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        suggestions: ['Retry validation', 'Check database connection'],
        autoFixable: false,
        timestamp: new Date(),
        resolved: false
      })
    }

    return checks
  }

  /**
   * 数据验证检查
   */
  private async checkDataValidation(options: ValidationConfig['options']): Promise<ConsistencyCheck[]> {
    const checks: ConsistencyCheck[] = []

    try {
      // 检查卡片数据格式
      if (options.deepValidation) {
        const cards = await db.cards.toArray()
        for (const card of cards) {
          // 检查JSON格式
          try {
            JSON.stringify(card.frontContent)
            JSON.stringify(card.backContent)
          } catch (error) {
          console.warn("操作失败:", error)
        },
              suggestions: ['Repair JSON data', 'Delete corrupted card'],
              autoFixable: false,
              timestamp: new Date(),
              resolved: false
            })
          }

          // 检查数据大小
          const cardSize = JSON.stringify(card).length
          if (cardSize > 1024 * 1024) { // 1MB
            checks.push({
              id: crypto.randomUUID(),
              type: 'data-validation',
              status: 'warning',
              severity: 'low',
              title: 'Large Card Data',
              description: 'Card contains unusually large amount of data',
              entityType: 'card',
              entityId: card.id,
              details: { size: cardSize },
              suggestions: ['Optimize card content', 'Split into multiple cards'],
              autoFixable: false,
              timestamp: new Date(),
              resolved: false
            })
          }
        }
      }

      // 检查重复数据
      const duplicates = await this.detectDuplicateCards()
      for (const duplicate of duplicates) {
        checks.push({
          id: crypto.randomUUID(),
          type: 'data-validation',
          status: 'warning',
          severity: 'medium',
          title: 'Duplicate Card Detected',
          description: 'Multiple cards with identical content found',
          entityType: 'card',
          details: duplicate,
          suggestions: ['Merge duplicate cards', 'Delete duplicates'],
          autoFixable: true,
          timestamp: new Date(),
          resolved: false
        })
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        suggestions: ['Retry validation', 'Check database connection'],
        autoFixable: false,
        timestamp: new Date(),
        resolved: false
      })
    }

    return checks
  }

  /**
   * 同步一致性检查
   */
  private async checkSyncConsistency(options: ValidationConfig['options']): Promise<ConsistencyCheck[]> {
    const checks: ConsistencyCheck[] = []

    try {
      // 检查同步版本一致性
      const cards = await db.cards.toArray()
      const versionIssues = cards.filter(card =>
        card.syncVersion === 0 || card.syncVersion > 100000
      )

      for (const card of versionIssues) {
        checks.push({
          id: crypto.randomUUID(),
          type: 'sync-consistency',
          status: 'warning',
          severity: 'low',
          title: 'Invalid Sync Version',
          description: 'Card has invalid sync version number',
          entityType: 'card',
          entityId: card.id,
          details: { syncVersion: card.syncVersion },
          suggestions: ['Reset sync version', 'Resync with server'],
          autoFixable: true,
          timestamp: new Date(),
          resolved: false
        })
      }

      // 检查待同步操作
      const pendingSyncCount = await db.syncQueue
        .where('pendingSync')
        .equals(true)
        .count()

      if (pendingSyncCount > 1000) {
        checks.push({
          id: crypto.randomUUID(),
          type: 'sync-consistency',
          status: 'warning',
          severity: 'medium',
          title: 'High Pending Sync Operations',
          description: 'Large number of pending sync operations detected',
          details: { pendingCount: pendingSyncCount },
          suggestions: ['Process pending syncs', 'Clear old sync operations'],
          autoFixable: true,
          timestamp: new Date(),
          resolved: false
        })
      }

      // 检查过期的同步操作
      const expiredSyncDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7天前
      const expiredSyncCount = await db.syncQueue
        .where('timestamp')
        .below(expiredSyncDate)
        .count()

      if (expiredSyncCount > 0) {
        checks.push({
          id: crypto.randomUUID(),
          type: 'sync-consistency',
          status: 'warning',
          severity: 'low',
          title: 'Expired Sync Operations',
          description: 'Found expired sync operations in queue',
          details: { expiredCount: expiredSyncCount },
          suggestions: ['Remove expired operations', 'Reprocess if necessary'],
          autoFixable: true,
          timestamp: new Date(),
          resolved: false
        })
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        suggestions: ['Retry validation', 'Check sync service'],
        autoFixable: false,
        timestamp: new Date(),
        resolved: false
      })
    }

    return checks
  }

  /**
   * 性能指标检查
   */
  private async checkPerformanceMetrics(options: ValidationConfig['options']): Promise<ConsistencyCheck[]> {
    const checks: ConsistencyCheck[] = []

    try {
      const stats = await db.getStats()

      // 检查数据库大小
      const maxDatabaseSize = 500 * 1024 * 1024 // 500MB
      if (stats.totalSize > maxDatabaseSize) {
        checks.push({
          id: crypto.randomUUID(),
          type: 'performance-metrics',
          status: 'warning',
          severity: 'medium',
          title: 'Large Database Size',
          description: 'Database size exceeds recommended limit',
          details: { size: stats.totalSize, maxSize: maxDatabaseSize },
          suggestions: ['Perform cleanup', 'Archive old data'],
          autoFixable: false,
          timestamp: new Date(),
          resolved: false
        })
      }

      // 检查索引效率（简化）
      const cardCount = await db.cards.count()
      if (cardCount > 50000) {
        checks.push({
          id: crypto.randomUUID(),
          type: 'performance-metrics',
          status: 'warning',
          severity: 'medium',
          title: 'Large Dataset',
          description: 'Large number of cards may impact performance',
          details: { cardCount },
          suggestions: ['Optimize indexes', 'Consider pagination'],
          autoFixable: false,
          timestamp: new Date(),
          resolved: false
        })
      }

      // 检查搜索索引
      const cardsWithoutSearchVector = await db.cards
        .where('searchVector')
        .equals(undefined)
        .count()

      if (cardsWithoutSearchVector > 0) {
        checks.push({
          id: crypto.randomUUID(),
          type: 'performance-metrics',
          status: 'warning',
          severity: 'low',
          title: 'Missing Search Indexes',
          description: 'Some cards are missing search vectors',
          details: { count: cardsWithoutSearchVector },
          suggestions: ['Rebuild search indexes'],
          autoFixable: true,
          timestamp: new Date(),
          resolved: false
        })
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        suggestions: ['Retry validation', 'Check database connection'],
        autoFixable: false,
        timestamp: new Date(),
        resolved: false
      })
    }

    return checks
  }

  /**
   * 安全审计检查
   */
  private async checkSecurityAudit(options: ValidationConfig['options']): Promise<ConsistencyCheck[]> {
    const checks: ConsistencyCheck[] = []

    try {
      // 检查敏感数据存储
      const settings = await db.settings.toArray()
      const sensitiveSettings = settings.filter(setting =>
        setting.key.toLowerCase().includes('password') ||
        setting.key.toLowerCase().includes('token') ||
        setting.key.toLowerCase().includes('secret') ||
        setting.key.toLowerCase().includes('key')
      )

      if (sensitiveSettings.length > 0) {
        checks.push({
          id: crypto.randomUUID(),
          type: 'security-audit',
          status: 'warning',
          severity: 'high',
          title: 'Sensitive Data Detected',
          description: 'Settings contain potentially sensitive data',
          details: { keys: sensitiveSettings.map(s => s.key) },
          suggestions: ['Encrypt sensitive data', 'Remove unnecessary credentials'],
          autoFixable: false,
          timestamp: new Date(),
          resolved: false
        })
      }

      // 检查过期会话
      const expiredSessions = await db.sessions
        .where('expiresAt')
        .below(new Date())
        .count()

      if (expiredSessions > 0) {
        checks.push({
          id: crypto.randomUUID(),
          type: 'security-audit',
          status: 'warning',
          severity: 'medium',
          title: 'Expired Sessions',
          description: 'Found expired user sessions',
          details: { count: expiredSessions },
          suggestions: ['Clean up expired sessions'],
          autoFixable: true,
          timestamp: new Date(),
          resolved: false
        })
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        suggestions: ['Retry validation', 'Check database connection'],
        autoFixable: false,
        timestamp: new Date(),
        resolved: false
      })
    }

    return checks
  }

  /**
   * 存储完整性检查
   */
  private async checkStorageIntegrity(options: ValidationConfig['options']): Promise<ConsistencyCheck[]> {
    const checks: ConsistencyCheck[] = []

    try {
      // 检查IndexedDB 存储配额
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        const usagePercentage = (estimate.usage || 0) / (estimate.quota || 1) * 100

        if (usagePercentage > 80) {
          checks.push({
            id: crypto.randomUUID(),
            type: 'storage-integrity',
            status: 'warning',
            severity: 'high',
            title: 'Storage Usage High',
            description: 'Storage usage is approaching quota limit',
            details: { usagePercentage: `${usagePercentage.toFixed(2)  }%` },
            suggestions: ['Clear unused data', 'Increase storage quota'],
            autoFixable: false,
            timestamp: new Date(),
            resolved: false
          })
        }
      }

      // 检查数据库事务完整性
      try {
        await db.transaction('r', [db.cards, db.folders, db.tags], async () => {
          // 简单的事务测试
          await db.cards.limit(1).toArray()
        })
      } catch (error) {
          console.warn("操作失败:", error)
        },
          suggestions: ['Check database corruption', 'Restore from backup'],
          autoFixable: false,
          timestamp: new Date(),
          resolved: false
        })
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        suggestions: ['Retry validation', 'Check browser storage'],
        autoFixable: false,
        timestamp: new Date(),
        resolved: false
      })
    }

    return checks
  }

  /**
   * 索引验证检查
   */
  private async checkIndexVerification(options: ValidationConfig['options']): Promise<ConsistencyCheck[]> {
    const checks: ConsistencyCheck[] = []

    try {
      // 检查索引一致性（简化实现）
      // 在实际应用中,这里可以实现更复杂的索引验证逻辑

      const cardCount = await db.cards.count()
      const indexedCardCount = await db.cards.where('userId').equals('default').count()

      // 简单的索引验证
      if (cardCount > 0 && indexedCardCount === 0) {
        checks.push({
          id: crypto.randomUUID(),
          type: 'index-verification',
          status: 'warning',
          severity: 'medium',
          title: 'Potential Index Issue',
          description: 'Index query returned no results',
          details: { totalCards: cardCount, indexedCards: indexedCardCount },
          suggestions: ['Rebuild indexes', 'Check index definitions'],
          autoFixable: true,
          timestamp: new Date(),
          resolved: false
        })
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        suggestions: ['Retry validation', 'Check database schema'],
        autoFixable: false,
        timestamp: new Date(),
        resolved: false
      })
    }

    return checks
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  /**
   * 检测循环文件夹引用
   */
  private async detectCircularFolderReferences(): Promise<Array<{
    folderId: string
    path: string[]
  }>> {
    const folders = await db.folders.toArray()
    const circularRefs: Array<{ folderId: string; path: string[] }> = []

    for (const folder of folders) {
      const visited = new Set<string>()
      const path: string[] = []

      if (this.hasCircularReference(folder.id!, folders, visited, path)) {
        circularRefs.push({
          folderId: folder.id!,
          path: [...path, folder.id!]
        })
      }
    }

    return circularRefs
  }

  /**
   * 递归检查循环引用
   */
  private hasCircularReference(
    folderId: string,
    folders: DbFolder[],
    visited: Set<string>,
    path: string[]
  ): boolean {
    if (visited.has(folderId)) {
      return true
    }

    visited.add(folderId)
    path.push(folderId)

    const folder = folders.find(f => f.id === folderId)
    if (!folder || !folder.parentId) {
      path.pop()
      return false
    }

    const hasCycle = this.hasCircularReference(folder.parentId, folders, visited, path)
    path.pop()
    return hasCycle
  }

  /**
   * 检测重复卡片
   */
  private async detectDuplicateCards(): Promise<Array<{
    signature: string
    cardIds: string[]
    count: number
  }>> {
    const cards = await db.cards.toArray()
    const signatureMap = new Map<string, string[]>()

    for (const card of cards) {
      const signature = this.generateCardSignature(card)
      if (!signatureMap.has(signature)) {
        signatureMap.set(signature, [])
      }
      signatureMap.get(signature)!.push(card.id!)
    }

    return Array.from(signatureMap.entries())
      .filter(([_, cardIds]) => cardIds.length > 1)
      .map(([signature, cardIds]) => ({
        signature,
        cardIds,
        count: cardIds.length
      }))
  }

  /**
   * 生成卡片签名
   */
  private generateCardSignature(card: DbCard): string {
    return [
      card.frontContent.title,
      card.backContent.title,
      card.frontContent.text,
      card.backContent.text,
      card.folderId || 'root'
    ].join('|').toLowerCase()
  }

  /**
   * 判断是否应该自动修复
   */
  private shouldAutoFix(check: ConsistencyCheck, autoFixConfig: ValidationConfig['autoFix']): boolean {
    if (!check.autoFixable) return false

    // 检查严重程度阈值
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 }
    const checkSeverityLevel = severityOrder[check.severity]
    const thresholdLevel = severityOrder[autoFixConfig.severityThreshold]

    return checkSeverityLevel <= thresholdLevel
  }

  /**
   * 自动修复问题
   */
  private async autoFixIssue(check: ConsistencyCheck, autoFixConfig: ValidationConfig['options']): Promise<boolean> {
    try {
      console.log(`Auto-fixing issue: ${check.title}`)

      switch (check.type) {
        case 'entity-integrity':
          return await this.fixEntityIntegrityIssue(check)

        case 'reference-integrity':
          return await this.fixReferenceIntegrityIssue(check)

        case 'data-validation':
          return await this.fixDataValidationIssue(check)

        case 'sync-consistency':
          return await this.fixSyncConsistencyIssue(check)

        case 'performance-metrics':
          return await this.fixPerformanceMetricsIssue(check)

        default:
          console.warn(`Cannot auto-fix issue type: ${check.type}`)
          return false
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
      return false
    }
  }

  /**
   * 修复实体完整性问题
   */
  private async fixEntityIntegrityIssue(check: ConsistencyCheck): Promise<boolean> {
    if (check.entityType === 'card' && check.entityId) {
      const card = await db.cards.get(check.entityId)
      if (card) {
        // 修复缺失的标题
        if (!card.frontContent?.title || !card.backContent?.title) {
          const updates: Partial<DbCard> = {}
          if (!card.frontContent?.title) {
            updates.frontContent = { ...card.frontContent, title: 'Untitled Front' }
          }
          if (!card.backContent?.title) {
            updates.backContent = { ...card.backContent, title: 'Untitled Back' }
          }
          await db.cards.update(card.id!, updates)
          return true
        }

        // 修复时间戳
        if (card.updatedAt > new Date()) {
          await db.cards.update(card.id!, { updatedAt: new Date() })
          return true
        }
      }
    }

    return false
  }

  /**
   * 修复引用完整性问题
   */
  private async fixReferenceIntegrityIssue(check: ConsistencyCheck): Promise<boolean> {
    if (check.entityType === 'card' && check.entityId) {
      // 移除无效的文件夹引用
      await db.cards.update(check.entityId, { folderId: undefined })
      return true
    }

    if (check.entityType === 'image' && check.entityId) {
      // 删除孤立图片
      await db.images.delete(check.entityId)
      return true
    }

    return false
  }

  /**
   * 修复数据验证问题
   */
  private async fixDataValidationIssue(check: ConsistencyCheck): Promise<boolean> {
    // 这里可以实现数据修复逻辑
    return false
  }

  /**
   * 修复同步一致性问题
   */
  private async fixSyncConsistencyIssue(check: ConsistencyCheck): Promise<boolean> {
    if (check.entityType === 'card' && check.entityId) {
      // 重置同步版本
      await db.cards.update(check.entityId, { syncVersion: 1, pendingSync: true })
      return true
    }

    return false
  }

  /**
   * 修复性能指标问题
   */
  private async fixPerformanceMetricsIssue(check: ConsistencyCheck): Promise<boolean> {
    // 重建搜索索引
    const cards = await db.cards.where('searchVector').equals(undefined).toArray()
    for (const card of cards) {
      const searchVector = this.generateSearchVector(card)
      await db.cards.update(card.id!, { searchVector })
    }
    return true
  }

  /**
   * 生成搜索向量
   */
  private generateSearchVector(card: DbCard): string {
    return [
      card.frontContent.title,
      card.frontContent.text,
      card.backContent.title,
      card.backContent.text,
      ...(card.frontContent.tags || []),
      ...(card.backContent.tags || [])
    ].join(' ').toLowerCase()
  }

  /**
   * 生成验证汇总
   */
  private generateSummary(results: ConsistencyCheck[], executionTime: number, autoFixedCount: number): ValidationSummary {
    const totalChecks = results.length
    const passedChecks = results.filter(r => r.status === 'valid').length
    const warningChecks = results.filter(r => r.status === 'warning').length
    const failedChecks = results.filter(r => r.status === 'invalid').length
    const criticalChecks = results.filter(r => r.status === 'critical').length

    // 计算完整性分数
    let integrityScore = 100
    integrityScore -= (failedChecks * 10)
    integrityScore -= (warningChecks * 5)
    integrityScore -= (criticalChecks * 25)
    integrityScore = Math.max(0, Math.min(100, integrityScore))

    // 生成建议
    const recommendations: string[] = []
    if (criticalChecks > 0) {
      recommendations.push('Address critical issues immediately')
    }
    if (failedChecks > 0) {
      recommendations.push('Review and fix failed validation checks')
    }
    if (warningChecks > 10) {
      recommendations.push('Consider addressing warning issues to improve system health')
    }
    if (integrityScore < 80) {
      recommendations.push('Schedule regular maintenance to improve data integrity')
    }

    return {
      totalChecks,
      passedChecks,
      warningChecks,
      failedChecks,
      criticalChecks,
      autoFixedIssues: autoFixedCount,
      manualInterventionRequired: criticalChecks > 0 || failedChecks > autoFixedCount,
      integrityScore,
      executionTime,
      recommendations
    }
  }

  /**
   * 生成验证报告
   */
  private async generateReport(
    results: ConsistencyCheck[],
    summary: ValidationSummary,
    reporting: ValidationConfig['reporting']
  ): Promise<string> {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary,
      results: reporting.includeDetails ? results : undefined,
      statistics: {
        byType: this.groupResultsByType(results),
        bySeverity: this.groupResultsBySeverity(results),
        byEntity: this.groupResultsByEntity(results)
      }
    }

    switch (reporting.format) {
      case 'json':
        return JSON.stringify(reportData, null, 2)

      case 'html':
        return this.generateHtmlReport(reportData)

      case 'summary':
      default:
        return this.generateSummaryReport(reportData)
    }
  }

  /**
   * 按类型分组结果
   */
  private groupResultsByType(results: ConsistencyCheck[]): Record<string, number> {
    return results.reduce((acc, result) => {
      acc[result.type] = (acc[result.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  /**
   * 按严重程度分组结果
   */
  private groupResultsBySeverity(results: ConsistencyCheck[]): Record<SeverityLevel, number> {
    return results.reduce((acc, result) => {
      acc[result.severity] = (acc[result.severity] || 0) + 1
      return acc
    }, { low: 0, medium: 0, high: 0, critical: 0 })
  }

  /**
   * 按实体类型分组结果
   */
  private groupResultsByEntity(results: ConsistencyCheck[]): Record<string, number> {
    return results.reduce((acc, result) => {
      const entityType = result.entityType || 'unknown'
      acc[entityType] = (acc[entityType] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  /**
   * 生成HTML报告
   */
  private generateHtmlReport(data: any): string {
    // 简化的HTML报告生成
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Data Consistency Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .issue { margin: 10px 0; padding: 10px; border-left: 4px solid; }
        .critical { border-color: #dc3545; background: #f8d7da; }
        .high { border-color: #fd7e14; background: #fff3cd; }
        .medium { border-color: #ffc107; background: #fff3cd; }
        .low { border-color: #28a745; background: #d4edda; }
    </style>
</head>
<body>
    <h1>Data Consistency Validation Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p>Generated: ${new Date(data.timestamp).toLocaleString()}</p>
        <p>Total Checks: ${data.summary.totalChecks}</p>
        <p>Passed: ${data.summary.passedChecks}</p>
        <p>Warnings: ${data.summary.warningChecks}</p>
        <p>Failed: ${data.summary.failedChecks}</p>
        <p>Critical: ${data.summary.criticalChecks}</p>
        <p>Integrity Score: ${data.summary.integrityScore}/100</p>
    </div>
    ${data.results ? data.results.map((issue: any) => `
        <div class="issue ${issue.severity}">
            <h3>${issue.title}</h3>
            <p>${issue.description}</p>
            <p>Type: ${issue.type} | Severity: ${issue.severity}</p>
            ${issue.suggestions ? `<p>Suggestions: ${issue.suggestions.join(', ')}</p>` : ''}
        </div>
    `).join('') : ''}
</body>
</html>
    `
  }

  /**
   * 生成汇总报告
   */
  private generateSummaryReport(data: any): string {
    return `
Data Consistency Validation Report
=====================================
Generated: ${new Date(data.timestamp).toLocaleString()}
Execution Time: ${data.summary.executionTime}ms

Summary:
- Total Checks: ${data.summary.totalChecks}
- Passed: ${data.summary.passedChecks}
- Warnings: ${data.summary.warningChecks}
- Failed: ${data.summary.failedChecks}
- Critical: ${data.summary.criticalChecks}
- Auto-Fixed: ${data.summary.autoFixedIssues}
- Integrity Score: ${data.summary.integrityScore}/100

Recommendations:
${data.summary.recommendations.map((rec: string) => `- ${rec}`).join('\n')}

Statistics by Type:
${Object.entries(data.statistics.byType).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

Statistics by Severity:
${Object.entries(data.statistics.bySeverity).map(([severity, count]) => `- ${severity}: ${count}`).join('\n')}
    `
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  /**
   * 获取验证历史
   */
  getValidationHistory(): ConsistencyCheck[] {
    return [...this.checkHistory]
  }

  /**
   * 清理验证历史
   */
  clearValidationHistory(): void {
    this.checkHistory = []
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): ValidationConfig {
    return { ...this.defaultConfig }
  }

  /**
   * 设置默认配置
   */
  setDefaultConfig(config: ValidationConfig): void {
    this.defaultConfig = { ...config }
  }

  /**
   * 检查是否正在运行
   */
  isValidationRunning(): boolean {
    return this.isRunning
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const consistencyValidator = ConsistencyValidator.getInstance()

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 执行快速验证
 */
export const performQuickConsistencyValidation = async (): Promise<{
  results: ConsistencyCheck[]
  summary: ValidationSummary
}> => {
  return await consistencyValidator.performQuickValidation()
}

/**
 * 执行深度验证
 */
export const performDeepConsistencyValidation = async (): Promise<{
  results: ConsistencyCheck[]
  summary: ValidationSummary
  report?: string
}> => {
  return await consistencyValidator.performDeepValidation()
}