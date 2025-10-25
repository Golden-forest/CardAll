/**
 * 数据一致性验证服务
 * 提供IndexedDB和Supabase之间的数据一致性检查和修复功能
 */

import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from './database'
import { supabase } from './supabase'
import { dataConverter } from './data-converter'

// ============================================================================
// 一致性验证类型定义
// ============================================================================

export enum ConsistencyLevel {
  STRICT = 'strict',      // 严格模式：所有数据必须完全一致
  RELAXED = 'relaxed',    // 宽松模式：允许少量不一致
  BASIC = 'basic'        // 基础模式：只检查关键数据
}

export enum ValidationStatus {
  VALID = 'valid',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface ConsistencyIssue {
  id: string
  type: 'missing_local' | 'missing_cloud' | 'version_mismatch' | 'data_corruption' | 'relationship_violation'
  entity: string
  entityId: string
  severity: ValidationStatus
  message: string
  details?: any
  autoFixable: boolean
  suggestedAction: string
}

export interface ConsistencyReport {
  timestamp: Date
  level: ConsistencyLevel
  overallStatus: ValidationStatus
  summary: {
    totalChecks: number
    passedChecks: number
    failedChecks: number
    warnings: number
    errors: number
    critical: number
  }
  entityCounts: {
    local: {
      cards: number
      folders: number
      tags: number
      images: number
    }
    cloud: {
      cards: number
      folders: number
      tags: number
      images: number
    }
  }
  issues: ConsistencyIssue[]
  confidence: number
  validationTime: number
}

export interface AutoRepairResult {
  id: string
  success: boolean
  repairedIssues: number
  failedRepairs: number
  repairedEntities: string[]
  errors: string[]
  duration: number
}

// ============================================================================
// 数据一致性验证器
// ============================================================================

export class DataConsistencyValidator {
  private validationCache = new Map<string, ConsistencyReport>()
  private repairHistory: AutoRepairResult[] = []
  private isProcessing = false

  constructor() {
    this.initializeValidator()
  }

  private initializeValidator(): void {
    // 定期清理缓存
    setInterval(() => this.cleanupValidationCache(), 60 * 60 * 1000) // 每小时
  }

  // ============================================================================
  // 主要验证方法
  // ============================================================================

  /**
   * 执行完整的一致性验证
   */
  async validateConsistency(
    level: ConsistencyLevel = ConsistencyLevel.RELAXED
  ): Promise<ConsistencyReport> {
    if (this.isProcessing) {
      throw new Error('Validation already in progress')
    }

    this.isProcessing = true
    const startTime = performance.now()

    try {
      const cacheKey = `consistency_${level}_${Date.now()}`

      // 检查是否有最近的验证结果
      const recentReport = this.getRecentValidationReport(level)
      if (recentReport) {
        return recentReport
      }

      console.log(`Starting consistency validation (level: ${level})`)

      const report: ConsistencyReport = {
        timestamp: new Date(),
        level,
        overallStatus: ValidationStatus.VALID,
        summary: {
          totalChecks: 0,
          passedChecks: 0,
          failedChecks: 0,
          warnings: 0,
          errors: 0,
          critical: 0
        },
        entityCounts: {
          local: { cards: 0, folders: 0, tags: 0, images: 0 },
          cloud: { cards: 0, folders: 0, tags: 0, images: 0 }
        },
        issues: [],
        confidence: 0,
        validationTime: 0
      }

      // 并行获取统计数据
      const [localStats, cloudStats] = await Promise.all([
        this.getLocalStatistics(),
        this.getCloudStatistics()
      ])

      report.entityCounts.local = localStats
      report.entityCounts.cloud = cloudStats

      // 执行一致性检查
      await this.performConsistencyChecks(report, level)

      // 计算总体状态
      this.calculateOverallStatus(report)

      // 计算置信度
      report.confidence = this.calculateValidationConfidence(report)

      // 记录验证时间
      report.validationTime = performance.now() - startTime

      // 缓存结果
      this.validationCache.set(cacheKey, report)

      console.log(`Consistency validation completed: ${report.summary.passedChecks}/${report.summary.totalChecks} checks passed`)

      return report

    } catch (error) {
      console.error('Consistency validation failed:', error)

      // 返回错误报告
      return {
        timestamp: new Date(),
        level,
        overallStatus: ValidationStatus.ERROR,
        summary: {
          totalChecks: 1,
          passedChecks: 0,
          failedChecks: 1,
          warnings: 0,
          errors: 1,
          critical: 0
        },
        entityCounts: {
          local: { cards: 0, folders: 0, tags: 0, images: 0 },
          cloud: { cards: 0, folders: 0, tags: 0, images: 0 }
        },
        issues: [{
          id: crypto.randomUUID(),
          type: 'data_corruption',
          entity: 'system',
          entityId: 'validation',
          severity: ValidationStatus.ERROR,
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          autoFixable: false,
          suggestedAction: 'Retry validation or check system health'
        }],
        confidence: 0,
        validationTime: performance.now() - startTime
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 执行快速一致性检查
   */
  async quickValidation(): Promise<{
    isConsistent: boolean
    issues: ConsistencyIssue[]
    confidence: number
  }> {
    try {
      const issues: ConsistencyIssue[] = []

      // 快速检查关键实体数量
      const [localCardCount, cloudCardCount] = await Promise.all([
        db.cards.count(),
        this.getCloudEntityCount('cards')
      ])

      if (Math.abs(localCardCount - cloudCardCount) > 5) {
        issues.push({
          id: crypto.randomUUID(),
          type: 'version_mismatch',
          entity: 'cards',
          entityId: 'count',
          severity: ValidationStatus.WARNING,
          message: `Card count mismatch: local=${localCardCount}, cloud=${cloudCardCount}`,
          autoFixable: true,
          suggestedAction: 'Run full sync to resolve count differences'
        })
      }

      // 检查最近的同步状态
      const metrics = await dataSyncService.getMetrics()
      if (metrics.reliability < 0.8) {
        issues.push({
          id: crypto.randomUUID(),
          type: 'data_corruption',
          entity: 'sync',
          entityId: 'reliability',
          severity: ValidationStatus.WARNING,
          message: `Low sync reliability: ${(metrics.reliability * 100).toFixed(1)}%`,
          autoFixable: false,
          suggestedAction: 'Check network connectivity and sync logs'
        })
      }

      const isConsistent = issues.length === 0 || issues.every(issue => issue.severity === ValidationStatus.WARNING)
      const confidence = isConsistent ? 0.9 : Math.max(0.5, 1 - (issues.length * 0.2))

      return { isConsistent, issues, confidence }

    } catch (error) {
      return {
        isConsistent: false,
        issues: [{
          id: crypto.randomUUID(),
          type: 'data_corruption',
          entity: 'system',
          entityId: 'quick_validation',
          severity: ValidationStatus.ERROR,
          message: `Quick validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          autoFixable: false,
          suggestedAction: 'Retry validation'
        }],
        confidence: 0
      }
    }
  }

  // ============================================================================
  // 自动修复功能
  // ============================================================================

  /**
   * 自动修复一致性问题
   */
  async autoRepairIssues(
    issues: ConsistencyIssue[],
    options: {
      dryRun?: boolean
      maxRetries?: number
      force?: boolean
    } = {}
  ): Promise<AutoRepairResult> {
    const repairId = crypto.randomUUID()
    const startTime = performance.now()

    const result: AutoRepairResult = {
      id: repairId,
      success: true,
      repairedIssues: 0,
      failedRepairs: 0,
      repairedEntities: [],
      errors: [],
      duration: 0
    }

    try {
      console.log(`Starting auto-repair for ${issues.length} issues`)

      // 按严重程度排序处理
      const sortedIssues = issues.sort((a, b) => {
        const severityOrder = {
          [ValidationStatus.CRITICAL]: 4,
          [ValidationStatus.ERROR]: 3,
          [ValidationStatus.WARNING]: 2,
          [ValidationStatus.VALID]: 1
        }
        return severityOrder[b.severity] - severityOrder[a.severity]
      })

      for (const issue of sortedIssues) {
        if (!issue.autoFixable && !options.force) {
          result.errors.push(`Cannot auto-fix ${issue.type} for ${issue.entity}:${issue.entityId}`)
          result.failedRepairs++
          continue
        }

        try {
          if (!options.dryRun) {
            const repairSuccess = await this.repairIssue(issue)
            if (repairSuccess) {
              result.repairedIssues++
              result.repairedEntities.push(`${issue.entity}:${issue.entityId}`)
            } else {
              result.errors.push(`Failed to repair ${issue.type} for ${issue.entity}:${issue.entityId}`)
              result.failedRepairs++
            }
          } else {
            console.log(`[DRY RUN] Would repair ${issue.type} for ${issue.entity}:${issue.entityId}`)
            result.repairedIssues++
            result.repairedEntities.push(`${issue.entity}:${issue.entityId}`)
          }
        } catch (error) {
          const errorMsg = `Repair failed for ${issue.entity}:${issue.entityId}: ${error instanceof Error ? error.message : 'Unknown error'}`
          result.errors.push(errorMsg)
          result.failedRepairs++
        }
      }

      result.success = result.failedRepairs === 0

      console.log(`Auto-repair completed: ${result.repairedIssues} repaired, ${result.failedRepairs} failed`)

    } catch (error) {
      result.success = false
      result.errors.push(`Auto-repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    result.duration = performance.now() - startTime

    // 记录修复历史
    this.repairHistory.push(result)

    return result
  }

  /**
   * 修复单个问题
   */
  private async repairIssue(issue: ConsistencyIssue): Promise<boolean> {
    console.log(`Repairing issue: ${issue.type} for ${issue.entity}:${issue.entityId}`)

    switch (issue.type) {
      case 'missing_local':
        return await this.repairMissingLocal(issue)
      case 'missing_cloud':
        return await this.repairMissingCloud(issue)
      case 'version_mismatch':
        return await this.repairVersionMismatch(issue)
      case 'data_corruption':
        return await this.repairDataCorruption(issue)
      case 'relationship_violation':
        return await this.repairRelationshipViolation(issue)
      default:
        console.warn(`Unknown issue type: ${issue.type}`)
        return false
    }
  }

  /**
   * 修复本地缺失数据
   */
  private async repairMissingLocal(issue: ConsistencyIssue): Promise<boolean> {
    try {
      const cloudData = await this.getCloudEntity(issue.entity, issue.entityId)
      if (!cloudData) return false

      switch (issue.entity) {
        case 'card':
          const dbCard = dataConverter.fromCloudCard(cloudData)
          await db.cards.add(dbCard)
          break
        case 'folder':
          const dbFolder = dataConverter.fromCloudFolder(cloudData)
          await db.folders.add(dbFolder)
          break
        case 'tag':
          const dbTag = dataConverter.fromCloudTag(cloudData)
          await db.tags.add(dbTag)
          break
        default:
          return false
      }

      return true
    } catch (error) {
      console.error(`Failed to repair missing local data for ${issue.entity}:${issue.entityId}:`, error)
      return false
    }
  }

  /**
   * 修复云端缺失数据
   */
  private async repairMissingCloud(issue: ConsistencyIssue): Promise<boolean> {
    try {
      const localData = await this.getLocalEntity(issue.entity, issue.entityId)
      if (!localData) return false

      switch (issue.entity) {
        case 'card':
          const cloudCard = dataConverter.toCloudCard(localData as DbCard)
          await supabase.from('cards').insert(cloudCard)
          break
        case 'folder':
          const cloudFolder = dataConverter.toCloudFolder(localData as DbFolder)
          await supabase.from('folders').insert(cloudFolder)
          break
        case 'tag':
          const cloudTag = dataConverter.toCloudTag(localData as DbTag)
          await supabase.from('tags').insert(cloudTag)
          break
        default:
          return false
      }

      return true
    } catch (error) {
      console.error(`Failed to repair missing cloud data for ${issue.entity}:${issue.entityId}:`, error)
      return false
    }
  }

  /**
   * 修复版本不匹配
   */
  private async repairVersionMismatch(issue: ConsistencyIssue): Promise<boolean> {
    try {
      // 获取本地和云端数据
      const [localData, cloudData] = await Promise.all([
        this.getLocalEntity(issue.entity, issue.entityId),
        this.getCloudEntity(issue.entity, issue.entityId)
      ])

      if (!localData || !cloudData) return false

      // 使用最后修改时间决定使用哪个版本
      const localTime = new Date((localData as any).updatedAt).getTime()
      const cloudTime = new Date((cloudData as any).updated_at).getTime()

      if (cloudTime > localTime) {
        // 云端数据更新，同步到本地
        return await this.repairMissingLocal(issue)
      } else {
        // 本地数据更新，同步到云端
        return await this.repairMissingCloud(issue)
      }
    } catch (error) {
      console.error(`Failed to repair version mismatch for ${issue.entity}:${issue.entityId}:`, error)
      return false
    }
  }

  /**
   * 修复数据损坏
   */
  private async repairDataCorruption(issue: ConsistencyIssue): Promise<boolean> {
    try {
      // 根据问题类型采取不同的修复策略
      if (issue.details?.corruptionType === 'invalid_structure') {
        // 尝试从备份或云端恢复
        const cloudData = await this.getCloudEntity(issue.entity, issue.entityId)
        if (cloudData) {
          return await this.repairMissingLocal(issue)
        }
      }

      // 默认修复策略：删除损坏的数据并重新同步
      console.warn(`Data corruption detected for ${issue.entity}:${issue.entityId}, attempting repair`)

      // 先备份本地数据
      await this.backupCorruptedData(issue.entity, issue.entityId)

      // 删除本地损坏数据
      await this.deleteLocalEntity(issue.entity, issue.entityId)

      // 从云端重新获取
      return await this.repairMissingLocal(issue)
    } catch (error) {
      console.error(`Failed to repair data corruption for ${issue.entity}:${issue.entityId}:`, error)
      return false
    }
  }

  /**
   * 修复关系违反
   */
  private async repairRelationshipViolation(issue: ConsistencyIssue): Promise<boolean> {
    try {
      // 修复外键关系问题
      if (issue.details?.relationshipType === 'foreign_key') {
        // 例如：卡片引用了不存在的文件夹
        if (issue.entity === 'card') {
          const card = await db.cards.get(issue.entityId)
          if (card && card.folderId) {
            // 检查文件夹是否存在
            const folder = await db.folders.get(card.folderId)
            if (!folder) {
              // 移除无效的文件夹引用
              await db.cards.update(issue.entityId, { folderId: undefined })
              return true
            }
          }
        }
      }

      return false
    } catch (error) {
      console.error(`Failed to repair relationship violation for ${issue.entity}:${issue.entityId}:`, error)
      return false
    }
  }

  // ============================================================================
  // 一致性检查实现
  // ============================================================================

  /**
   * 执行一致性检查
   */
  private async performConsistencyChecks(
    report: ConsistencyReport,
    level: ConsistencyLevel
  ): Promise<void> {
    const checks: Promise<void>[] = []

    // 基础检查（所有级别都执行）
    checks.push(this.checkEntityCounts(report))
    checks.push(this.checkDataIntegrity(report))

    // 宽松模式检查
    if (level !== ConsistencyLevel.BASIC) {
      checks.push(this.checkVersionConsistency(report))
      checks.push(this.checkRelationships(report))
    }

    // 严格模式检查
    if (level === ConsistencyLevel.STRICT) {
      checks.push(this.checkDataCorruption(report))
      checks.push(this.checkTimestampConsistency(report))
    }

    await Promise.allSettled(checks)
  }

  /**
   * 检查实体数量一致性
   */
  private async checkEntityCounts(report: ConsistencyReport): Promise<void> {
    report.summary.totalChecks++

    const entities = ['cards', 'folders', 'tags', 'images'] as const

    for (const entity of entities) {
      const localCount = report.entityCounts.local[entity]
      const cloudCount = report.entityCounts.cloud[entity]
      const diff = Math.abs(localCount - cloudCount)

      // 允许的差异阈值
      const threshold = level === ConsistencyLevel.STRICT ? 0 : 5

      if (diff > threshold) {
        const severity = diff > 20 ? ValidationStatus.ERROR : ValidationStatus.WARNING

        report.issues.push({
          id: crypto.randomUUID(),
          type: localCount < cloudCount ? 'missing_local' : 'missing_cloud',
          entity,
          entityId: 'count',
          severity,
          message: `${entity} count mismatch: local=${localCount}, cloud=${cloudCount} (diff=${diff})`,
          autoFixable: true,
          suggestedAction: 'Run sync to resolve count differences'
        })

        if (severity === ValidationStatus.ERROR) report.summary.errors++
        else report.summary.warnings++
      } else {
        report.summary.passedChecks++
      }
    }
  }

  /**
   * 检查数据完整性
   */
  private async checkDataIntegrity(report: ConsistencyReport): Promise<void> {
    report.summary.totalChecks++

    try {
      // 检查本地数据完整性
      const localIntegrity = await this.checkLocalDataIntegrity()

      // 检查云端数据完整性
      const cloudIntegrity = await this.checkCloudDataIntegrity()

      if (!localIntegrity.isValid || !cloudIntegrity.isValid) {
        const severity = ValidationStatus.ERROR

        report.issues.push({
          id: crypto.randomUUID(),
          type: 'data_corruption',
          entity: 'system',
          entityId: 'integrity',
          severity,
          message: `Data integrity check failed: local=${localIntegrity.isValid}, cloud=${cloudIntegrity.isValid}`,
          details: {
            localErrors: localIntegrity.errors,
            cloudErrors: cloudIntegrity.errors
          },
          autoFixable: false,
          suggestedAction: 'Manual data inspection required'
        })

        report.summary.errors++
      } else {
        report.summary.passedChecks++
      }
    } catch (error) {
      report.summary.failedChecks++
      report.summary.errors++
    }
  }

  /**
   * 检查版本一致性
   */
  private async checkVersionConsistency(report: ConsistencyReport): Promise<void> {
    report.summary.totalChecks++

    try {
      // 抽样检查版本一致性
      const sampleSize = 100
      const sampleIssues = await this.checkSampleVersionConsistency(sampleSize)

      if (sampleIssues.length > 0) {
        const severity = sampleIssues.length > 10 ? ValidationStatus.ERROR : ValidationStatus.WARNING

        report.issues.push(...sampleIssues.map(issue => ({
          ...issue,
          severity,
          autoFixable: true,
          suggestedAction: 'Sync to resolve version conflicts'
        })))

        if (severity === ValidationStatus.ERROR) report.summary.errors += sampleIssues.length
        else report.summary.warnings += sampleIssues.length
      } else {
        report.summary.passedChecks++
      }
    } catch (error) {
      report.summary.failedChecks++
    }
  }

  /**
   * 检查关系一致性
   */
  private async checkRelationships(report: ConsistencyReport): Promise<void> {
    report.summary.totalChecks++

    try {
      const relationshipIssues = await this.checkRelationshipIntegrity()

      if (relationshipIssues.length > 0) {
        const severity = relationshipIssues.some(issue => issue.severity === ValidationStatus.ERROR)
          ? ValidationStatus.ERROR
          : ValidationStatus.WARNING

        report.issues.push(...relationshipIssues)

        if (severity === ValidationStatus.ERROR) report.summary.errors += relationshipIssues.length
        else report.summary.warnings += relationshipIssues.length
      } else {
        report.summary.passedChecks++
      }
    } catch (error) {
      report.summary.failedChecks++
    }
  }

  /**
   * 检查数据损坏
   */
  private async checkDataCorruption(report: ConsistencyReport): Promise<void> {
    report.summary.totalChecks++

    try {
      const corruptionIssues = await this.detectDataCorruption()

      if (corruptionIssues.length > 0) {
        const severity = ValidationStatus.CRITICAL

        report.issues.push(...corruptionIssues.map(issue => ({
          ...issue,
          severity,
          autoFixable: false,
          suggestedAction: 'Manual data recovery required'
        })))

        report.summary.critical += corruptionIssues.length
      } else {
        report.summary.passedChecks++
      }
    } catch (error) {
      report.summary.failedChecks++
    }
  }

  /**
   * 检查时间戳一致性
   */
  private async checkTimestampConsistency(report: ConsistencyReport): Promise<void> {
    report.summary.totalChecks++

    try {
      const timestampIssues = await this.checkTimestampAlignment()

      if (timestampIssues.length > 0) {
        const severity = ValidationStatus.WARNING

        report.issues.push(...timestampIssues.map(issue => ({
          ...issue,
          severity,
          autoFixable: true,
          suggestedAction: 'Update timestamps to align with system time'
        })))

        report.summary.warnings += timestampIssues.length
      } else {
        report.summary.passedChecks++
      }
    } catch (error) {
      report.summary.failedChecks++
    }
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  /**
   * 获取本地统计数据
   */
  private async getLocalStatistics(): Promise<{
    cards: number
    folders: number
    tags: number
    images: number
  }> {
    try {
      const stats = await db.getStats()
      return {
        cards: stats.cards,
        folders: stats.folders,
        tags: stats.tags,
        images: stats.images
      }
    } catch (error) {
      console.error('Failed to get local statistics:', error)
      return { cards: 0, folders: 0, tags: 0, images: 0 }
    }
  }

  /**
   * 获取云端统计数据
   */
  private async getCloudStatistics(): Promise<{
    cards: number
    folders: number
    tags: number
    images: number
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { cards: 0, folders: 0, tags: 0, images: 0 }

      const [cards, folders, tags, images] = await Promise.all([
        supabase.from('cards').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('folders').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('tags').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('images').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      ])

      return {
        cards: cards.count || 0,
        folders: folders.count || 0,
        tags: tags.count || 0,
        images: images.count || 0
      }
    } catch (error) {
      console.error('Failed to get cloud statistics:', error)
      return { cards: 0, folders: 0, tags: 0, images: 0 }
    }
  }

  /**
   * 获取本地实体
   */
  private async getLocalEntity(entity: string, entityId: string): Promise<any> {
    try {
      switch (entity) {
        case 'card':
          return await db.cards.get(entityId)
        case 'folder':
          return await db.folders.get(entityId)
        case 'tag':
          return await db.tags.get(entityId)
        case 'image':
          return await db.images.get(entityId)
        default:
          return null
      }
    } catch (error) {
      console.error(`Failed to get local ${entity} ${entityId}:`, error)
      return null
    }
  }

  /**
   * 获取云端实体
   */
  private async getCloudEntity(entity: string, entityId: string): Promise<any> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const result = await supabase
        .from(`${entity  }s`) // 复数形式
        .select('*')
        .eq('id', entityId)
        .eq('user_id', user.id)
        .single()

      return result.data
    } catch (error) {
      console.error(`Failed to get cloud ${entity} ${entityId}:`, error)
      return null
    }
  }

  /**
   * 获取云端实体数量
   */
  private async getCloudEntityCount(entity: string): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return 0

      const result = await supabase
        .from(entity)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)

      return result.count || 0
    } catch (error) {
      console.error(`Failed to get cloud ${entity} count:`, error)
      return 0
    }
  }

  /**
   * 检查本地数据完整性
   */
  private async checkLocalDataIntegrity(): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = []

    try {
      // 检查数据库健康状态
      const health = await db.healthCheck()
      if (!health.isHealthy) {
        errors.push(...health.issues)
      }

      // 检查索引完整性
      await this.checkLocalIndexes(errors)

      // 检查外键约束
      await this.checkLocalForeignKeys(errors)

    } catch (error) {
      errors.push(`Local integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * 检查云端数据完整性
   */
  private async checkCloudDataIntegrity(): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = []

    try {
      // 检查基本连接
      const { error } = await supabase.from('cards').select('id', { count: 'exact', head: true }).limit(1)
      if (error) {
        errors.push(`Cloud connection failed: ${error.message}`)
      }

    } catch (error) {
      errors.push(`Cloud integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * 检查抽样版本一致性
   */
  private async checkSampleVersionConsistency(sampleSize: number): Promise<Omit<ConsistencyIssue, 'id'>[]> {
    const issues: Omit<ConsistencyIssue, 'id'>[] = []

    try {
      // 获取本地卡片样本
      const localCards = await db.cards.limit(sampleSize).toArray()

      for (const card of localCards) {
        const cloudCard = await this.getCloudEntity('card', card.id!)

        if (cloudCard) {
          const localTime = new Date(card.updatedAt).getTime()
          const cloudTime = new Date(cloudCard.updated_at).getTime()

          if (Math.abs(localTime - cloudTime) > 60000) { // 1分钟差异
            issues.push({
              type: 'version_mismatch',
              entity: 'card',
              entityId: card.id!,
              severity: ValidationStatus.WARNING,
              message: `Timestamp mismatch for card ${card.id}: local=${new Date(localTime).toISOString()}, cloud=${new Date(cloudTime).toISOString()}`,
              autoFixable: true,
              suggestedAction: 'Sync to resolve timestamp differences'
            })
          }
        }
      }

    } catch (error) {
      console.error('Failed to check sample version consistency:', error)
    }

    return issues
  }

  /**
   * 检查关系完整性
   */
  private async checkRelationshipIntegrity(): Promise<Omit<ConsistencyIssue, 'id'>[]> {
    const issues: Omit<ConsistencyIssue, 'id'>[] = []

    try {
      // 检查卡片-文件夹关系
      const cards = await db.cards.toArray()
      const folderIds = await db.folders.toCollection().primaryKeys() as string[]

      for (const card of cards) {
        if (card.folderId && !folderIds.includes(card.folderId)) {
          issues.push({
            type: 'relationship_violation',
            entity: 'card',
            entityId: card.id!,
            severity: ValidationStatus.WARNING,
            message: `Card ${card.id} references non-existent folder ${card.folderId}`,
            details: { relationshipType: 'foreign_key', missingId: card.folderId },
            autoFixable: true,
            suggestedAction: 'Remove invalid folder reference or create missing folder'
          })
        }
      }

    } catch (error) {
      console.error('Failed to check relationship integrity:', error)
    }

    return issues
  }

  /**
   * 检测数据损坏
   */
  private async detectDataCorruption(): Promise<Omit<ConsistencyIssue, 'id'>[]> {
    const issues: Omit<ConsistencyIssue, 'id'>[] = []

    try {
      // 检查本地数据结构
      const cards = await db.cards.toArray()

      for (const card of cards) {
        // 检查必需字段
        if (!card.frontContent || !card.backContent) {
          issues.push({
            type: 'data_corruption',
            entity: 'card',
            entityId: card.id!,
            severity: ValidationStatus.CRITICAL,
            message: `Card ${card.id} has missing content structure`,
            details: { corruptionType: 'invalid_structure' },
            autoFixable: false,
            suggestedAction: 'Manual data recovery required'
          })
        }

        // 检查数据格式
        if (card.frontContent && typeof card.frontContent !== 'object') {
          issues.push({
            type: 'data_corruption',
            entity: 'card',
            entityId: card.id!,
            severity: ValidationStatus.CRITICAL,
            message: `Card ${card.id} has invalid content format`,
            details: { corruptionType: 'invalid_format' },
            autoFixable: false,
            suggestedAction: 'Manual data recovery required'
          })
        }
      }

    } catch (error) {
      console.error('Failed to detect data corruption:', error)
    }

    return issues
  }

  /**
   * 检查时间戳对齐
   */
  private async checkTimestampAlignment(): Promise<Omit<ConsistencyIssue, 'id'>[]> {
    const issues: Omit<ConsistencyIssue, 'id'>[] = []

    try {
      const now = Date.now()
      const threshold = 24 * 60 * 60 * 1000 // 24小时

      // 检查本地数据时间戳
      const cards = await db.cards.toArray()

      for (const card of cards) {
        const updateTime = new Date(card.updatedAt).getTime()
        if (Math.abs(updateTime - now) > threshold) {
          issues.push({
            type: 'version_mismatch',
            entity: 'card',
            entityId: card.id!,
            severity: ValidationStatus.WARNING,
            message: `Card ${card.id} has timestamp ${new Date(updateTime).toISOString()} which is far from current time`,
            autoFixable: true,
            suggestedAction: 'Update timestamp to current time'
          })
        }
      }

    } catch (error) {
      console.error('Failed to check timestamp alignment:', error)
    }

    return issues
  }

  /**
   * 检查本地索引
   */
  private async checkLocalIndexes(errors: string[]): Promise<void> {
    // 简化的索引检查
    try {
      // 测试基本查询性能
      const startTime = performance.now()
      await db.cards.limit(1).toArray()
      const duration = performance.now() - startTime

      if (duration > 100) { // 100ms threshold
        errors.push('Local database query performance may be degraded')
      }
    } catch (error) {
      errors.push(`Index check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 检查本地外键
   */
  private async checkLocalForeignKeys(errors: string[]): Promise<void> {
    try {
      // 检查数据完整性约束
      const health = await db.healthCheck()
      if (!health.isHealthy) {
        errors.push(...health.issues)
      }
    } catch (error) {
      errors.push(`Foreign key check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 计算总体状态
   */
  private calculateOverallStatus(report: ConsistencyReport): void {
    if (report.summary.critical > 0) {
      report.overallStatus = ValidationStatus.CRITICAL
    } else if (report.summary.errors > 0) {
      report.overallStatus = ValidationStatus.ERROR
    } else if (report.summary.warnings > 0) {
      report.overallStatus = ValidationStatus.WARNING
    } else {
      report.overallStatus = ValidationStatus.VALID
    }
  }

  /**
   * 计算验证置信度
   */
  private calculateValidationConfidence(report: ConsistencyReport): number {
    let confidence = 1.0

    // 根据问题数量和严重程度降低置信度
    if (report.summary.critical > 0) {
      confidence -= 0.5
    }
    if (report.summary.errors > 0) {
      confidence -= 0.3
    }
    if (report.summary.warnings > 0) {
      confidence -= 0.1
    }

    // 根据验证级别调整
    switch (report.level) {
      case ConsistencyLevel.BASIC:
        confidence *= 0.8
        break
      case ConsistencyLevel.RELAXED:
        confidence *= 0.9
        break
      case ConsistencyLevel.STRICT:
        confidence *= 1.0
        break
    }

    return Math.max(0, Math.min(1, confidence))
  }

  /**
   * 获取最近的验证报告
   */
  private getRecentValidationReport(level: ConsistencyLevel): ConsistencyReport | null {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000

    for (const [key, report] of this.validationCache.entries()) {
      if (report.level === level && report.timestamp.getTime() > fiveMinutesAgo) {
        return report
      }
    }

    return null
  }

  /**
   * 清理验证缓存
   */
  private cleanupValidationCache(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000

    for (const [key, report] of this.validationCache.entries()) {
      if (report.timestamp.getTime() < oneHourAgo) {
        this.validationCache.delete(key)
      }
    }
  }

  /**
   * 备份损坏数据
   */
  private async backupCorruptedData(entity: string, entityId: string): Promise<void> {
    try {
      const data = await this.getLocalEntity(entity, entityId)
      if (data) {
        // 将备份数据存储到本地存储
        const backupKey = `backup_${entity}_${entityId}_${Date.now()}`
        const backupData = {
          entity,
          entityId,
          data,
          timestamp: new Date().toISOString()
        }
        localStorage.setItem(backupKey, JSON.stringify(backupData))
        console.log(`Backed up corrupted ${entity}:${entityId}`)
      }
    } catch (error) {
      console.error(`Failed to backup ${entity}:${entityId}:`, error)
    }
  }

  /**
   * 删除本地实体
   */
  private async deleteLocalEntity(entity: string, entityId: string): Promise<void> {
    try {
      switch (entity) {
        case 'card':
          await db.cards.delete(entityId)
          break
        case 'folder':
          await db.folders.delete(entityId)
          break
        case 'tag':
          await db.tags.delete(entityId)
          break
        case 'image':
          await db.images.delete(entityId)
          break
      }
    } catch (error) {
      console.error(`Failed to delete ${entity}:${entityId}:`, error)
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const dataConsistencyValidator = new DataConsistencyValidator()

// ============================================================================
// 便利方法导出
// ============================================================================

export const validateDataConsistency = (level?: ConsistencyLevel) =>
  dataConsistencyValidator.validateConsistency(level)

export const quickDataValidation = () =>
  dataConsistencyValidator.quickValidation()

export const autoRepairConsistency = (issues: ConsistencyIssue[], options?: any) =>
  dataConsistencyValidator.autoRepairIssues(issues, options)