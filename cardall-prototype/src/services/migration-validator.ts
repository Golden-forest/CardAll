import { Card } from '@/types/card'
import { DbCard } from '@/services/database'
import { db } from '@/services/database'
import { DataConverterAdapter } from './data-converter-adapter'
import { dataMigrationService } from './data-migration.service'
import {
  BackupResult,
  createStorageError
} from './storage-adapter'

/**
 * 迁移验证服务
 * 负责验证迁移结果的完整性和正确性,并提供回滚机制
 */
export class MigrationValidator {
  private static instance: MigrationValidator | null = null
  private readonly VALIDATION_CACHE_KEY = 'cardall_validation_cache'
  private readonly VALIDATION_TIMEOUT = 5 * 60 * 1000 // 5分钟

  public static getInstance(): MigrationValidator {
    if (!MigrationValidator.instance) {
      MigrationValidator.instance = new MigrationValidator()
    }
    return MigrationValidator.instance
  }

  /**
   * 验证迁移的完整性和正确性
   */
  async validateMigration(options: {
    sourceCards?: Card[]
    checkDataIntegrity?: boolean
    checkFunctionality?: boolean
    performanceTest?: boolean
    detailedReport?: boolean
  } = {}): Promise<ValidationReport> {
    const {
      sourceCards,
      checkDataIntegrity = true,
      checkFunctionality = true,
      performanceTest = false,
      detailedReport = false
    } = options

    const startTime = Date.now()
    const report: ValidationReport = {
      timestamp: new Date(),
      overall: {
        status: 'pending' as ValidationStatus,
        score: 0,
        duration: 0
      },
      sections: []
    }

    try {
      // 1. 数据完整性验证
      if (checkDataIntegrity) {
        const integrityResult = await this.validateDataIntegrity(sourceCards)
        report.sections.push(integrityResult)
      }

      // 2. 功能性验证
      if (checkFunctionality) {
        const functionalityResult = await this.validateFunctionality()
        report.sections.push(functionalityResult)
      }

      // 3. 性能测试
      if (performanceTest) {
        const performanceResult = await this.validatePerformance()
        report.sections.push(performanceResult)
      }

      // 计算总体得分
      const totalScore = report.sections.reduce((sum, section) => sum + section.score, 0)
      const maxScore = report.sections.length * 100
      report.overall.score = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0

      // 确定总体状态
      if (report.overall.score >= 90) {
        report.overall.status = 'excellent'
      } else if (report.overall.score >= 70) {
        report.overall.status = 'good'
      } else if (report.overall.score >= 50) {
        report.overall.status = 'fair'
      } else {
        report.overall.status = 'poor'
      }

      report.overall.duration = Date.now() - startTime

      // 缓存验证结果
      this.cacheValidationResult(report)

      return report
    } catch (error) {
          console.warn("操作失败:", error)
        }

      return report
    }
  }

  /**
   * 验证数据完整性
   */
  private async validateDataIntegrity(sourceCards?: Card[]): Promise<ValidationSection> {
    const startTime = Date.now()
    const section: ValidationSection = {
      name: 'Data Integrity',
      status: 'pending' as ValidationStatus,
      score: 0,
      checks: [],
      errors: [],
      warnings: [],
      recommendations: [],
      duration: 0
    }

    try {
      // 检查1: 记录数量对比
      const dbCount = await db.cards.count()
      const expectedCount = sourceCards?.length || dbCount

      const countCheck: ValidationCheck = {
        name: 'Record Count',
        passed: dbCount === expectedCount,
        details: `Expected: ${expectedCount}, Actual: ${dbCount}`,
        importance: 'critical'
      }
      section.checks.push(countCheck)

      if (!countCheck.passed) {
        section.errors.push(`Record count mismatch: expected ${expectedCount}, got ${dbCount}`)
      }

      // 检查2: 数据抽样验证
      const sampleSize = Math.min(10, dbCount)
      let validSamples = 0

      if (dbCount > 0) {
        const sampleCards = await db.cards.limit(sampleSize).toArray()

        for (const dbCard of sampleCards) {
          try {
            const card = DataConverterAdapter.dbCardToCard(dbCard)
            const validation = DataConverterAdapter.validateCard(card)

            const sampleCheck: ValidationCheck = {
              name: `Sample Card ${card.id}`,
              passed: validation.valid,
              details: validation.valid ? 'Valid' : `Errors: ${validation.errors.join(', ')}`,
              importance: 'high'
            }
            section.checks.push(sampleCheck)

            if (validation.valid) {
              validSamples++
            } else {
              section.errors.push(`Invalid card ${card.id}: ${validation.errors.join(', ')}`)
            }
          } catch (error) {
          console.warn("操作失败:", error)
        }`,
              passed: false,
              details: `Conversion error: ${error instanceof Error ? error.message : String(error)}`,
              importance: 'high'
            }
            section.checks.push(sampleCheck)
            section.errors.push(`Conversion error for card ${dbCard.id}`)
          }
        }
      }

      // 检查3: 字段完整性
      const fieldCheck = await this.validateFieldCompleteness()
      section.checks.push(fieldCheck)

      // 检查4: 数据一致性（如果有源数据）
      if (sourceCards && sourceCards.length > 0) {
        const consistencyCheck = await this.validateDataConsistency(sourceCards)
        section.checks.push(consistencyCheck)
      }

      // 检查5: 唯一性约束
      const uniquenessCheck = await this.validateUniquenessConstraints()
      section.checks.push(uniquenessCheck)

      // 计算得分
      const passedChecks = section.checks.filter(check => check.passed).length
      const totalChecks = section.checks.length
      section.score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0

      // 确定状态
      if (section.score >= 90) {
        section.status = 'excellent'
      } else if (section.score >= 70) {
        section.status = 'good'
      } else if (section.score >= 50) {
        section.status = 'fair'
      } else {
        section.status = 'poor'
      }

      // 生成建议
      if (section.score < 100) {
        section.recommendations.push('Review failed checks and address any data issues')
      }

      if (section.errors.length > 0) {
        section.recommendations.push('Consider running data repair utilities')
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }`)
      section.recommendations.push('Check database connectivity and permissions')
    }

    section.duration = Date.now() - startTime
    return section
  }

  /**
   * 验证字段完整性
   */
  private async validateFieldCompleteness(): Promise<ValidationCheck> {
    try {
      const sampleCards = await db.cards.limit(5).toArray()
      const requiredFields = ['id', 'frontContent', 'backContent', 'createdAt', 'updatedAt']

      let allFieldsComplete = true
      const missingFields: string[] = []

      for (const card of sampleCards) {
        for (const field of requiredFields) {
          if (!(field in card) || card[field as keyof DbCard] === undefined || card[field as keyof DbCard] === null) {
            allFieldsComplete = false
            missingFields.push(`${card.id}.${field}`)
          }
        }
      }

      return {
        name: 'Field Completeness',
        passed: allFieldsComplete,
        details: allFieldsComplete ? 'All required fields present' : `Missing fields: ${missingFields.join(', ')}`,
        importance: 'high'
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        importance: 'high'
      }
    }
  }

  /**
   * 验证数据一致性
   */
  private async validateDataConsistency(sourceCards: Card[]): Promise<ValidationCheck> {
    try {
      const dbCards = await db.cards.toArray()
      const sourceMap = new Map(sourceCards.map(c => [c.id, c]))
      const dbMap = new Map(dbCards.map(c => [c.id, DataConverterAdapter.dbCardToCard(c)]))

      let inconsistencies = 0

      for (const [id, sourceCard] of sourceMap) {
        const dbCard = dbMap.get(id)
        if (!dbCard) {
          inconsistencies++
          continue
        }

        if (!DataConverterAdapter.areCardsEqual(sourceCard, dbCard)) {
          inconsistencies++
        }
      }

      const total = sourceMap.size
      const consistency = total > 0 ? ((total - inconsistencies) / total) * 100 : 100

      return {
        name: 'Data Consistency',
        passed: consistency >= 95,
        details: `${consistency.toFixed(1)}% consistency (${inconsibilities}/${total} differences)`,
        importance: 'critical'
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        importance: 'critical'
      }
    }
  }

  /**
   * 验证唯一性约束
   */
  private async validateUniquenessConstraints(): Promise<ValidationCheck> {
    try {
      const cards = await db.cards.toArray()
      const idSet = new Set<string>()
      const duplicates: string[] = []

      for (const card of cards) {
        if (idSet.has(card.id)) {
          duplicates.push(card.id)
        } else {
          idSet.add(card.id)
        }
      }

      return {
        name: 'Unique Constraints',
        passed: duplicates.length === 0,
        details: duplicates.length === 0 ? 'All IDs are unique' : `Duplicate IDs found: ${duplicates.join(', ')}`,
        importance: 'critical'
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        importance: 'critical'
      }
    }
  }

  /**
   * 验证功能性
   */
  private async validateFunctionality(): Promise<ValidationSection> {
    const startTime = Date.now()
    const section: ValidationSection = {
      name: 'Functionality',
      status: 'pending' as ValidationStatus,
      score: 0,
      checks: [],
      errors: [],
      warnings: [],
      recommendations: [],
      duration: 0
    }

    try {
      // 检查1: CRUD操作
      const crudCheck = await this.validateCRUDOperations()
      section.checks.push(crudCheck)

      // 检查2: 查询功能
      const queryCheck = await this.validateQueryFunctionality()
      section.checks.push(queryCheck)

      // 检查3: 事务支持
      const transactionCheck = await this.validateTransactionSupport()
      section.checks.push(transactionCheck)

      // 计算得分
      const passedChecks = section.checks.filter(check => check.passed).length
      const totalChecks = section.checks.length
      section.score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0

      // 确定状态
      if (section.score >= 90) {
        section.status = 'excellent'
      } else if (section.score >= 70) {
        section.status = 'good'
      } else if (section.score >= 50) {
        section.status = 'fair'
      } else {
        section.status = 'poor'
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }`)
      section.recommendations.push('Check database permissions and connection')
    }

    section.duration = Date.now() - startTime
    return section
  }

  /**
   * 验证CRUD操作
   */
  private async validateCRUDOperations(): Promise<ValidationCheck> {
    const testCard = {
      frontContent: { title: 'Test Card', text: 'Test content', tags: [], images: [], lastModified: new Date() },
      backContent: { title: 'Test Back', text: 'Test back content', tags: [], images: [], lastModified: new Date() },
      style: { type: 'solid' as const, backgroundColor: '#ffffff', fontFamily: 'system-ui', fontSize: 'base', fontWeight: 'normal', textColor: '#000000', borderRadius: 'md', shadow: 'none', borderWidth: 0 },
      isFlipped: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    try {
      // Create
      const dbCard = DataConverterAdapter.cardToDbCard(testCard)
      const id = await db.cards.add(dbCard)

      // Read
      const retrieved = await db.cards.get(id)
      const readSuccess = retrieved !== undefined

      // Update
      const updatedCard = { ...retrieved!, frontContent: { ...retrieved!.frontContent, title: 'Updated Test Card' } }
      await db.cards.put(updatedCard)

      const updated = await db.cards.get(id)
      const updateSuccess = updated?.frontContent.title === 'Updated Test Card'

      // Delete
      await db.cards.delete(id)
      const deleted = await db.cards.get(id)
      const deleteSuccess = deleted === undefined

      return {
        name: 'CRUD Operations',
        passed: readSuccess && updateSuccess && deleteSuccess,
        details: `Create: ${id ? 'OK' : 'FAIL'}, Read: ${readSuccess ? 'OK' : 'FAIL'}, Update: ${updateSuccess ? 'OK' : 'FAIL'}, Delete: ${deleteSuccess ? 'OK' : 'FAIL'}`,
        importance: 'critical'
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        importance: 'critical'
      }
    }
  }

  /**
   * 验证查询功能
   */
  private async validateQueryFunctionality(): Promise<ValidationCheck> {
    try {
      // 测试查询
      const allCards = await db.cards.toArray()
      const count = await db.cards.count()
      const limitCards = await db.cards.limit(5).toArray()

      const querySuccess = Array.isArray(allCards) &&
                          typeof count === 'number' &&
                          Array.isArray(limitCards) &&
                          limitCards.length <= Math.min(5, count)

      return {
        name: 'Query Functionality',
        passed: querySuccess,
        details: `Basic queries work correctly`,
        importance: 'high'
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        importance: 'high'
      }
    }
  }

  /**
   * 验证事务支持
   */
  private async validateTransactionSupport(): Promise<ValidationCheck> {
    try {
      let transactionSuccess = false

      await db.transaction('rw', db.cards, async () => {
        // 测试事务中的操作
        const testCard = {
          frontContent: { title: 'Transaction Test', text: 'Test', tags: [], images: [], lastModified: new Date() },
          backContent: { title: 'Transaction Test Back', text: 'Test back', tags: [], images: [], lastModified: new Date() },
          style: { type: 'solid' as const, backgroundColor: '#ffffff', fontFamily: 'system-ui', fontSize: 'base', fontWeight: 'normal', textColor: '#000000', borderRadius: 'md', shadow: 'none', borderWidth: 0 },
          isFlipped: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        const dbCard = DataConverterAdapter.cardToDbCard(testCard)
        const id = await db.cards.add(dbCard)
        await db.cards.delete(id)

        transactionSuccess = true
      })

      return {
        name: 'Transaction Support',
        passed: transactionSuccess,
        details: transactionSuccess ? 'Transactions work correctly' : 'Transaction test failed',
        importance: 'medium'
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        importance: 'medium'
      }
    }
  }

  /**
   * 验证性能
   */
  private async validatePerformance(): Promise<ValidationSection> {
    const startTime = Date.now()
    const section: ValidationSection = {
      name: 'Performance',
      status: 'pending' as ValidationStatus,
      score: 0,
      checks: [],
      errors: [],
      warnings: [],
      recommendations: [],
      duration: 0
    }

    try {
      // 检查1: 读取性能
      const readPerfCheck = await this.validateReadPerformance()
      section.checks.push(readPerfCheck)

      // 检查2: 写入性能
      const writePerfCheck = await this.validateWritePerformance()
      section.checks.push(writePerfCheck)

      // 检查3: 查询性能
      const queryPerfCheck = await this.validateQueryPerformance()
      section.checks.push(queryPerfCheck)

      // 计算得分
      const passedChecks = section.checks.filter(check => check.passed).length
      const totalChecks = section.checks.length
      section.score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0

      // 确定状态
      if (section.score >= 90) {
        section.status = 'excellent'
      } else if (section.score >= 70) {
        section.status = 'good'
      } else if (section.score >= 50) {
        section.status = 'fair'
      } else {
        section.status = 'poor'
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }`)
    }

    section.duration = Date.now() - startTime
    return section
  }

  /**
   * 验证读取性能
   */
  private async validateReadPerformance(): Promise<ValidationCheck> {
    try {
      const startTime = performance.now()
      await db.cards.toArray()
      const duration = performance.now() - startTime

      const threshold = 100 // 100ms
      const passed = duration <= threshold

      return {
        name: 'Read Performance',
        passed,
        details: `${duration.toFixed(2)}ms (threshold: ${threshold}ms)`,
        importance: 'medium'
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        importance: 'medium'
      }
    }
  }

  /**
   * 验证写入性能
   */
  private async validateWritePerformance(): Promise<ValidationCheck> {
    try {
      const testCard = {
        frontContent: { title: 'Perf Test', text: 'Performance test', tags: [], images: [], lastModified: new Date() },
        backContent: { title: 'Perf Test Back', text: 'Performance test back', tags: [], images: [], lastModified: new Date() },
        style: { type: 'solid' as const, backgroundColor: '#ffffff', fontFamily: 'system-ui', fontSize: 'base', fontWeight: 'normal', textColor: '#000000', borderRadius: 'md', shadow: 'none', borderWidth: 0 },
        isFlipped: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const startTime = performance.now()
      const dbCard = DataConverterAdapter.cardToDbCard(testCard)
      const id = await db.cards.add(dbCard)
      await db.cards.delete(id)
      const duration = performance.now() - startTime

      const threshold = 50 // 50ms
      const passed = duration <= threshold

      return {
        name: 'Write Performance',
        passed,
        details: `${duration.toFixed(2)}ms (threshold: ${threshold}ms)`,
        importance: 'medium'
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        importance: 'medium'
      }
    }
  }

  /**
   * 验证查询性能
   */
  private async validateQueryPerformance(): Promise<ValidationCheck> {
    try {
      const startTime = performance.now()
      await db.cards.limit(10).toArray()
      const duration = performance.now() - startTime

      const threshold = 20 // 20ms
      const passed = duration <= threshold

      return {
        name: 'Query Performance',
        passed,
        details: `${duration.toFixed(2)}ms (threshold: ${threshold}ms)`,
        importance: 'medium'
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        importance: 'medium'
      }
    }
  }

  /**
   * 执行回滚操作
   */
  async rollbackMigration(options: {
    backupId?: string
    force?: boolean
    validateRollback?: boolean
  } = {}): Promise<RollbackResult> {
    const {
      backupId,
      force = false,
      validateRollback = true
    } = options

    const startTime = Date.now()

    try {
      // 检查是否可以安全回滚
      if (!force) {
        const safetyCheck = await this.checkRollbackSafety()
        if (!safetyCheck.safe) {
          return {
            success: false,
            duration: Date.now() - startTime,
            errors: safetyCheck.issues,
            warnings: safetyCheck.warnings,
            backupUsed: false,
            cardsAffected: 0
          }
        }
      }

      // 获取要使用的备份
      let backup: BackupResult | undefined
      if (backupId) {
        const backups = dataMigrationService.getAvailableBackups()
        backup = backups.find(b => b.id === backupId)
        if (!backup) {
          throw createStorageError('BACKUP_NOT_FOUND', `Backup ${backupId} not found`)
        }
      } else {
        const backups = dataMigrationService.getAvailableBackups()
        if (backups.length === 0) {
          throw createStorageError('NO_BACKUP', 'No backup available for rollback')
        }
        backup = backups[0]
      }

      // 执行回滚
      const rollbackSuccess = await dataMigrationService.rollback()

      if (!rollbackSuccess) {
        return {
          success: false,
          duration: Date.now() - startTime,
          errors: ['Rollback operation failed'],
          warnings: [],
          backupUsed: true,
          backupId: backup.id,
          cardsAffected: backup.cardCount
        }
      }

      // 验证回滚结果
      if (validateRollback) {
        const validation = await this.validateRollbackResult(backup)
        if (!validation.success) {
          return {
            success: false,
            duration: Date.now() - startTime,
            errors: validation.errors,
            warnings: validation.warnings,
            backupUsed: true,
            backupId: backup.id,
            cardsAffected: backup.cardCount
          }
        }
      }

      return {
        success: true,
        duration: Date.now() - startTime,
        errors: [],
        warnings: [],
        backupUsed: true,
        backupId: backup.id,
        cardsAffected: backup.cardCount
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 检查回滚安全性
   */
  private async checkRollbackSafety(): Promise<{ safe: boolean; issues: string[]; warnings: string[] }> {
    const issues: string[] = []
    const warnings: string[] = []

    try {
      // 检查IndexedDB中的数据量
      const dbCount = await db.cards.count()
      if (dbCount > 1000) {
        warnings.push(`Large dataset (${dbCount} cards) - rollback may take time`)
      }

      // 检查是否有最近的修改
      const recentCards = await db.cards
        .filter(card => card.updatedAt > new Date(Date.now() - 24 * 60 * 60 * 1000))
        .toArray()

      if (recentCards.length > 0) {
        warnings.push(`${recentCards.length} cards modified in the last 24 hours`)
      }

      // 检查备份可用性
      const backups = dataMigrationService.getAvailableBackups()
      if (backups.length === 0) {
        issues.push('No backup available for rollback')
      }

      return {
        safe: issues.length === 0,
        issues,
        warnings
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 验证回滚结果
   */
  private async validateRollbackResult(backup: BackupResult): Promise<{ success: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // 检查IndexedDB是否已清空
      const dbCount = await db.cards.count()
      if (dbCount > 0) {
        errors.push(`IndexedDB not properly cleared (${dbCount} cards remaining)`)
      }

      // 这里可以添加更多的验证逻辑

      return {
        success: errors.length === 0,
        errors,
        warnings
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 缓存验证结果
   */
  private cacheValidationResult(report: ValidationReport): void {
    try {
      const cache = {
        report,
        timestamp: Date.now()
      }
      localStorage.setItem(this.VALIDATION_CACHE_KEY, JSON.stringify(cache))
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 获取缓存的验证结果
   */
  getCachedValidationResult(): ValidationReport | null {
    try {
      const cacheStr = localStorage.getItem(this.VALIDATION_CACHE_KEY)
      if (!cacheStr) return null

      const cache = JSON.parse(cacheStr)
      const now = Date.now()

      if (now - cache.timestamp > this.VALIDATION_TIMEOUT) {
        localStorage.removeItem(this.VALIDATION_CACHE_KEY)
        return null
      }

      return cache.report
    } catch {
      return null
    }
  }

  /**
   * 清除验证缓存
   */
  clearValidationCache(): void {
    try {
      localStorage.removeItem(this.VALIDATION_CACHE_KEY)
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }
}

// 类型定义
export type ValidationStatus = 'excellent' | 'good' | 'fair' | 'poor' | 'failed' | 'pending'

export   sections: ValidationSection[]
}

export export export // 导出单例实例
export const migrationValidator = MigrationValidator.getInstance()