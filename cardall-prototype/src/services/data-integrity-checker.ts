/**
 * 数据完整性检查器 (Data Integrity Checker)
 *
 * T012任务实现：智能数据完整性检查系统，定期验证本地和远程数据的一致性
 *
 * 功能特性：
 * - 数据哈希比较和验证
 * - 元数据一致性检查
 * - 引用完整性验证
 * - 定期检查调度
 * - 修复建议生成
 * - 检查报告生成
 * - 自动修复机制
 */

import { supabase } from './supabase'
import { db, type DbCard, type DbFolder, type DbTag } from './database'
import { authService } from './auth'
import { eventSystem, AppEvents } from './event-system'
import { coreSyncService, type EntityType } from './core-sync-service'
import { syncOrchestrator } from './sync-orchestrator'

// ============================================================================
// 核心类型定义
// ============================================================================

export enum IntegrityCheckType {
  HASH = 'hash',
  METADATA = 'metadata',
  REFERENCE = 'reference',
  STRUCTURE = 'structure',
  CONSISTENCY = 'consistency'
}

export enum SeverityLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum CheckStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface IntegrityIssue {
  id: string
  type: IntegrityCheckType
  severity: SeverityLevel
  entityType: EntityType
  entityId: string
  title: string
  description: string
  details: any
  detectedAt: Date
  fixSuggestions: FixSuggestion[]
  autoFixable: boolean
  fixed: boolean
  fixedAt?: Date
}

export interface FixSuggestion {
  id: string
  action: 'sync_local_to_remote' | 'sync_remote_to_local' | 'merge' | 'delete_local' | 'delete_remote' | 'update_metadata' | 'repair_reference'
  title: string
  description: string
  confidence: number // 0-1
  estimatedImpact: 'low' | 'medium' | 'high'
  requiresConfirmation: boolean
  steps?: string[]
}

export interface IntegrityCheckResult {
  id: string
  status: CheckStatus
  startTime: Date
  endTime?: Date
  duration?: number
  checkTypes: IntegrityCheckType[]
  entityTypes: EntityType[]
  totalEntities: number
  checkedEntities: number
  issues: IntegrityIssue[]
  summary: IntegritySummary
  recommendations: string[]
  autoFixed: number
  requiresUserAction: number
}

export interface IntegritySummary {
  totalIssues: number
  criticalIssues: number
  errorIssues: number
  warningIssues: number
  infoIssues: number
  byType: Record<IntegrityCheckType, number>
  byEntityType: Record<EntityType, number>
}

export interface DataHash {
  entityId: string
  entityType: EntityType
  contentHash: string
  metadataHash: string
  referenceHash: string
  computedAt: Date
  version: number
}

export interface ReferenceCheck {
  entityId: string
  entityType: EntityType
  referenceType: 'folder' | 'tag' | 'image' | 'card'
  referenceId: string
  exists: boolean
  broken: boolean
}

export interface IntegrityCheckConfig {
  // 检查配置
  enabled: boolean
  autoStart: boolean
  checkInterval: number // 毫秒
  batchSize: number
  timeout: number

  // 检查类型
  enableHashCheck: boolean
  enableMetadataCheck: boolean
  enableReferenceCheck: boolean
  enableStructureCheck: boolean
  enableConsistencyCheck: boolean

  // 自动修复
  enableAutoFix: boolean
  autoFixThreshold: SeverityLevel // 自动修复的严重程度阈值
  requireConfirmationFor: string[] // 需要确认的操作类型

  // 报告配置
  enableDetailedReports: boolean
  reportRetentionDays: number
  notificationEnabled: boolean

  // 性能配置
  maxConcurrentChecks: number
  checkPriority: 'low' | 'normal' | 'high'
  throttleNetworkRequests: boolean
}

export interface ScheduledCheck {
  id: string
  name: string
  enabled: boolean
  schedule: string // Cron表达式
  checkTypes: IntegrityCheckType[]
  entityTypes: EntityType[]
  lastRun?: Date
  nextRun?: Date
  autoFix: boolean
  notificationSettings: {
    enabled: boolean
    onIssue: boolean
    onCompletion: boolean
    onFailure: boolean
  }
}

// ============================================================================
// 数据完整性检查器接口
// ============================================================================

export interface IDataIntegrityChecker {
  // 生命周期管理
  initialize(config?: Partial<IntegrityCheckConfig>): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  destroy(): Promise<void>

  // 检查操作
  runFullCheck(options?: Partial<CheckOptions>): Promise<IntegrityCheckResult>
  runPartialCheck(options: CheckOptions): Promise<IntegrityCheckResult>
  runSpecificCheck(checkType: IntegrityCheckType, entityType: EntityType): Promise<IntegrityCheckResult>

  // 问题管理
  getIssues(filters?: IssueFilters): Promise<IntegrityIssue[]>
  fixIssue(issueId: string, fixSuggestionId: string, confirmation?: boolean): Promise<boolean>
  fixMultipleIssues(issueFixes: Array<{ issueId: string; fixSuggestionId: string; confirmation?: boolean }>): Promise<boolean[]>
  ignoreIssue(issueId: string, reason?: string): Promise<void>
  unignoreIssue(issueId: string): Promise<void>

  // 定期检查
  createScheduledCheck(config: Omit<ScheduledCheck, 'id'>): Promise<string>
  updateScheduledCheck(id: string, config: Partial<ScheduledCheck>): Promise<void>
  deleteScheduledCheck(id: string): Promise<void>
  getScheduledChecks(): Promise<ScheduledCheck[]>
  runScheduledCheck(id: string): Promise<IntegrityCheckResult>

  // 报告和分析
  getCheckHistory(limit?: number): Promise<IntegrityCheckResult[]>
  generateReport(checkId: string): Promise<IntegrityReport>
  getIntegrityMetrics(timeRange?: { start: Date; end: Date }): Promise<IntegrityMetrics>

  // 配置管理
  updateConfig(config: Partial<IntegrityCheckConfig>): void
  getConfig(): IntegrityCheckConfig

  // 事件监听
  on(event: string, listener: Function): () => void
  emit(event: string, data: any): void
}

// ============================================================================
// 辅助类型定义
// ============================================================================

export interface CheckOptions {
  checkTypes: IntegrityCheckType[]
  entityTypes: EntityType[]
  entityIds?: string[]
  filters?: any
  autoFix?: boolean
  timeout?: number
  priority?: 'low' | 'normal' | 'high'
}

export interface IssueFilters {
  types?: IntegrityCheckType[]
  severities?: SeverityLevel[]
  entityTypes?: EntityType[]
  fixed?: boolean
  autoFixable?: boolean
  dateRange?: { start: Date; end: Date }
  search?: string
}

export interface IntegrityReport {
  id: string
  checkId: string
  generatedAt: Date
  summary: IntegritySummary
  sections: ReportSection[]
  recommendations: Recommendation[]
  charts: ChartData[]
  rawData: any
}

export interface ReportSection {
  id: string
  title: string
  type: 'summary' | 'issues' | 'metrics' | 'trends' | 'recommendations'
  content: any
  priority: number
}

export interface Recommendation {
  id: string
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  effort: 'low' | 'medium' | 'high'
  category: 'immediate' | 'short-term' | 'long-term'
  actions: string[]
}

export interface ChartData {
  id: string
  title: string
  type: 'line' | 'bar' | 'pie' | 'scatter'
  data: any[]
  config: any
}

export interface IntegrityMetrics {
  totalChecks: number
  successfulChecks: number
  failedChecks: number
  averageCheckTime: number
  totalIssuesDetected: number
  totalIssuesFixed: number
  issuesByType: Record<IntegrityCheckType, number>
  issuesBySeverity: Record<SeverityLevel, number>
  trends: {
    detected: Array<{ date: Date; count: number }>
    fixed: Array<{ date: Date; count: number }>
    resolutionRate: Array<{ date: Date; rate: number }>
  }
}

// ============================================================================
// 数据完整性检查器实现
// ============================================================================

export class DataIntegrityChecker implements IDataIntegrityChecker {
  private static instance: DataIntegrityChecker
  private config: IntegrityCheckConfig
  private eventListeners: Map<string, Set<Function>> = new Map()

  // 内部状态
  private isInitialized = false
  private isStarted = false
  private isRunning = false
  private currentCheck: Promise<IntegrityCheckResult> | null = null

  // 检查调度
  private scheduledChecks: Map<string, ScheduledCheck> = new Map()
  private scheduleTimers: Map<string, any> = new Map()

  // 数据缓存
  private hashCache: Map<string, DataHash> = new Map()
  private referenceCache: Map<string, ReferenceCheck[]> = new Map()
  private issueCache: Map<string, IntegrityIssue[]> = new Map()

  // 默认配置
  private readonly defaultConfig: IntegrityCheckConfig = {
    enabled: true,
    autoStart: true,
    checkInterval: 3600000, // 1小时
    batchSize: 100,
    timeout: 300000, // 5分钟

    enableHashCheck: true,
    enableMetadataCheck: true,
    enableReferenceCheck: true,
    enableStructureCheck: true,
    enableConsistencyCheck: true,

    enableAutoFix: true,
    autoFixThreshold: SeverityLevel.WARNING,
    requireConfirmationFor: ['delete_local', 'delete_remote', 'sync_remote_to_local'],

    enableDetailedReports: true,
    reportRetentionDays: 30,
    notificationEnabled: true,

    maxConcurrentChecks: 3,
    checkPriority: 'normal',
    throttleNetworkRequests: true
  }

  static getInstance(): DataIntegrityChecker {
    if (!DataIntegrityChecker.instance) {
      DataIntegrityChecker.instance = new DataIntegrityChecker()
    }
    return DataIntegrityChecker.instance
  }

  constructor(config?: Partial<IntegrityCheckConfig>) {
    this.config = { ...this.defaultConfig, ...config }
    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    // 监听同步完成事件，触发完整性检查
    if (eventSystem) {
      eventSystem.on(AppEvents.SYNC.COMPLETED, () => {
        if (this.isStarted && this.config.enabled) {
          this.scheduleQuickCheck()
        }
      })

      eventSystem.on(AppEvents.AUTH.SIGNED_IN, () => {
        if (this.config.autoStart) {
          this.start()
        }
      })

      eventSystem.on(AppEvents.AUTH.SIGNED_OUT, () => {
        this.stop()
      })
    }
  }

  // ============================================================================
  // 生命周期管理
  // ============================================================================

  async initialize(config?: Partial<IntegrityCheckConfig>): Promise<void> {
    if (this.isInitialized) {
      this.log('DataIntegrityChecker already initialized')
      return
    }

    try {
      this.log('Initializing DataIntegrityChecker...')

      // 更新配置
      if (config) {
        this.config = { ...this.config, ...config }
      }

      // 验证依赖
      await this.validateDependencies()

      // 加载定期检查配置
      await this.loadScheduledChecks()

      // 初始化缓存
      await this.initializeCaches()

      this.isInitialized = true
      this.log('DataIntegrityChecker initialized successfully')
      this.emit('integrity:initialized', { timestamp: new Date() })

      // 自动启动
      if (this.config.autoStart) {
        await this.start()
      }

    } catch (error) {
      this.log('DataIntegrityChecker initialization failed:', error)
      throw error
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('DataIntegrityChecker must be initialized before starting')
    }

    if (this.isStarted) {
      this.log('DataIntegrityChecker already started')
      return
    }

    try {
      this.log('Starting DataIntegrityChecker...')

      // 启动定期检查
      await this.startScheduledChecks()

      this.isStarted = true
      this.log('DataIntegrityChecker started successfully')
      this.emit('integrity:started', { timestamp: new Date() })

    } catch (error) {
      this.log('DataIntegrityChecker start failed:', error)
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      this.log('DataIntegrityChecker already stopped')
      return
    }

    try {
      this.log('Stopping DataIntegrityChecker...')

      // 等待当前检查完成
      if (this.currentCheck) {
        this.log('Waiting for current check to complete...')
        await this.currentCheck
      }

      // 停止定期检查
      this.stopScheduledChecks()

      // 清理定时器
      this.clearAllTimers()

      this.isStarted = false
      this.log('DataIntegrityChecker stopped successfully')
      this.emit('integrity:stopped', { timestamp: new Date() })

    } catch (error) {
      this.log('DataIntegrityChecker stop failed:', error)
      throw error
    }
  }

  async destroy(): Promise<void> {
    try {
      this.log('Destroying DataIntegrityChecker...')

      await this.stop()

      // 清理缓存
      this.clearCaches()

      // 清理事件监听器
      this.eventListeners.clear()

      this.isInitialized = false
      this.log('DataIntegrityChecker destroyed successfully')
      this.emit('integrity:destroyed', { timestamp: new Date() })

    } catch (error) {
      this.log('DataIntegrityChecker destroy failed:', error)
      throw error
    }
  }

  // ============================================================================
  // 检查操作
  // ============================================================================

  async runFullCheck(options: Partial<CheckOptions> = {}): Promise<IntegrityCheckResult> {
    const checkOptions: CheckOptions = {
      checkTypes: [
        IntegrityCheckType.HASH,
        IntegrityCheckType.METADATA,
        IntegrityCheckType.REFERENCE,
        IntegrityCheckType.STRUCTURE,
        IntegrityCheckType.CONSISTENCY
      ],
      entityTypes: ['card', 'folder', 'tag'] as EntityType[],
      autoFix: false,
      ...options
    }

    return this.performIntegrityCheck(checkOptions)
  }

  async runPartialCheck(options: CheckOptions): Promise<IntegrityCheckResult> {
    return this.performIntegrityCheck(options)
  }

  async runSpecificCheck(checkType: IntegrityCheckType, entityType: EntityType): Promise<IntegrityCheckResult> {
    return this.performIntegrityCheck({
      checkTypes: [checkType],
      entityTypes: [entityType]
    })
  }

  private async performIntegrityCheck(options: CheckOptions): Promise<IntegrityCheckResult> {
    if (this.isRunning) {
      throw new Error('Integrity check already in progress')
    }

    const checkId = crypto.randomUUID()
    const startTime = new Date()

    this.isRunning = true
    this.currentCheck = this.executeCheck(checkId, options)

    try {
      this.emit('integrity:check:started', { checkId, options, timestamp: startTime })

      const result = await this.currentCheck
      this.emit('integrity:check:completed', { checkId, result, timestamp: new Date() })

      return result

    } catch (error) {
      const errorResult = this.createErrorResult(checkId, options, error)
      this.emit('integrity:check:failed', { checkId, error: errorResult, timestamp: new Date() })

      return errorResult

    } finally {
      this.isRunning = false
      this.currentCheck = null
    }
  }

  private async executeCheck(checkId: string, options: CheckOptions): Promise<IntegrityCheckResult> {
    const startTime = Date.now()
    const issues: IntegrityIssue[] = []

    try {
      // 获取用户ID
      const userId = await authService.getCurrentUserId()
      if (!userId) {
        throw new Error('用户未登录')
      }

      let totalEntities = 0
      let checkedEntities = 0

      // 执行各类检查
      for (const entityType of options.entityTypes) {
        for (const checkType of options.checkTypes) {
          this.log(`Running ${checkType} check for ${entityType}`)

          const entityIssues = await this.runCheckType(checkType, entityType, userId, options)
          issues.push(...entityIssues)

          // 更新进度
          checkedEntities += await this.getEntityCount(entityType, userId)
        }
      }

      totalEntities = checkedEntities

      // 生成摘要
      const summary = this.generateSummary(issues)

      // 自动修复
      let autoFixed = 0
      if (options.autoFix && this.config.enableAutoFix) {
        autoFixed = await this.autoFixIssues(issues)
      }

      // 生成建议
      const recommendations = this.generateRecommendations(issues, summary)

      const endTime = new Date()
      const duration = endTime.getTime() - startTime

      const result: IntegrityCheckResult = {
        id: checkId,
        status: CheckStatus.COMPLETED,
        startTime: new Date(startTime),
        endTime,
        duration,
        checkTypes: options.checkTypes,
        entityTypes: options.entityTypes,
        totalEntities,
        checkedEntities,
        issues,
        summary,
        recommendations,
        autoFixed,
        requiresUserAction: issues.filter(i => !i.fixed && !i.autoFixable).length
      }

      // 缓存结果
      await this.cacheCheckResult(result)

      return result

    } catch (error) {
      this.log(`Integrity check ${checkId} failed:`, error)
      throw error
    }
  }

  private async runCheckType(
    checkType: IntegrityCheckType,
    entityType: EntityType,
    userId: string,
    options: CheckOptions
  ): Promise<IntegrityIssue[]> {
    switch (checkType) {
      case IntegrityCheckType.HASH:
        return this.checkHashConsistency(entityType, userId, options)
      case IntegrityCheckType.METADATA:
        return this.checkMetadataConsistency(entityType, userId, options)
      case IntegrityCheckType.REFERENCE:
        return this.checkReferenceIntegrity(entityType, userId, options)
      case IntegrityCheckType.STRUCTURE:
        return this.checkDataStructure(entityType, userId, options)
      case IntegrityCheckType.CONSISTENCY:
        return this.checkCrossEntityConsistency(entityType, userId, options)
      default:
        throw new Error(`Unknown check type: ${checkType}`)
    }
  }

  // ============================================================================
  // 哈希一致性检查
  // ============================================================================

  private async checkHashConsistency(
    entityType: EntityType,
    userId: string,
    options: CheckOptions
  ): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = []

    try {
      // 获取本地数据
      const localData = await this.getLocalEntities(entityType, userId)

      // 获取远程数据
      const remoteData = await this.getRemoteEntities(entityType, userId)

      // 比较哈希值
      for (const localEntity of localData) {
        const remoteEntity = remoteData.find(r => r.id === localEntity.id)

        if (remoteEntity) {
          const localHash = this.computeEntityHash(localEntity)
          const remoteHash = this.computeEntityHash(remoteEntity)

          if (localHash.contentHash !== remoteHash.contentHash) {
            issues.push(this.createHashIssue(localEntity, remoteEntity, localHash, remoteHash))
          }
        } else {
          // 本地有但远程没有的数据
          issues.push(this.createMissingRemoteIssue(localEntity, entityType))
        }
      }

      // 检查远程有但本地没有的数据
      for (const remoteEntity of remoteData) {
        const localEntity = localData.find(l => l.id === remoteEntity.id)

        if (!localEntity) {
          issues.push(this.createMissingLocalIssue(remoteEntity, entityType))
        }
      }

    } catch (error) {
      this.log(`Hash consistency check failed for ${entityType}:`, error)
    }

    return issues
  }

  private computeEntityHash(entity: any): DataHash {
    const content = JSON.stringify({
      ...entity,
      // 排除不需要哈希的字段
      syncVersion: undefined,
      pendingSync: undefined,
      lastSyncAt: undefined
    })

    const contentHash = this.hashString(content)
    const metadataHash = this.hashString(JSON.stringify({
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      syncVersion: entity.syncVersion
    }))

    return {
      entityId: entity.id,
      entityType: this.getEntityType(entity),
      contentHash,
      metadataHash,
      referenceHash: this.computeReferenceHash(entity),
      computedAt: new Date(),
      version: entity.syncVersion || 0
    }
  }

  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }

  private computeReferenceHash(entity: any): string {
    const references: string[] = []

    if (entity.folderId) references.push(`folder:${entity.folderId}`)
    if (entity.cardIds && Array.isArray(entity.cardIds)) {
      references.push(...entity.cardIds.map((id: string) => `card:${id}`))
    }
    if (entity.tags && Array.isArray(entity.tags)) {
      references.push(...entity.tags.map((tag: string) => `tag:${tag}`))
    }

    return this.hashString(references.join('|'))
  }

  // ============================================================================
  // 元数据一致性检查
  // ============================================================================

  private async checkMetadataConsistency(
    entityType: EntityType,
    userId: string,
    options: CheckOptions
  ): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = []

    try {
      const localData = await this.getLocalEntities(entityType, userId)
      const remoteData = await this.getRemoteEntities(entityType, userId)

      for (const localEntity of localData) {
        const remoteEntity = remoteData.find(r => r.id === localEntity.id)

        if (remoteEntity) {
          // 检查版本号
          if (localEntity.syncVersion !== remoteEntity.syncVersion) {
            issues.push(this.createVersionIssue(localEntity, remoteEntity, entityType))
          }

          // 检查时间戳
          if (this.isTimestampInconsistent(localEntity, remoteEntity)) {
            issues.push(this.createTimestampIssue(localEntity, remoteEntity, entityType))
          }

          // 检查删除标记
          if (localEntity.isDeleted !== remoteEntity.is_deleted) {
            issues.push(this.createDeletionFlagIssue(localEntity, remoteEntity, entityType))
          }
        }
      }

    } catch (error) {
      this.log(`Metadata consistency check failed for ${entityType}:`, error)
    }

    return issues
  }

  private isTimestampInconsistent(local: any, remote: any): boolean {
    const localTime = new Date(local.updatedAt).getTime()
    const remoteTime = new Date(remote.updated_at).getTime()

    // 允许5秒的时间差异
    return Math.abs(localTime - remoteTime) > 5000
  }

  // ============================================================================
  // 引用完整性检查
  // ============================================================================

  private async checkReferenceIntegrity(
    entityType: EntityType,
    userId: string,
    options: CheckOptions
  ): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = []

    try {
      const entities = await this.getLocalEntities(entityType, userId)
      const referenceChecks = await this.performReferenceChecks(entities, userId)

      for (const check of referenceChecks) {
        if (check.broken || !check.exists) {
          issues.push(this.createReferenceIssue(check))
        }
      }

    } catch (error) {
      this.log(`Reference integrity check failed for ${entityType}:`, error)
    }

    return issues
  }

  private async performReferenceChecks(entities: any[], userId: string): Promise<ReferenceCheck[]> {
    const checks: ReferenceCheck[] = []

    for (const entity of entities) {
      // 检查文件夹引用
      if (entity.folderId) {
        checks.push(await this.checkReference(entity.id, this.getEntityType(entity), 'folder', entity.folderId, userId))
      }

      // 检查卡片引用（文件夹中的卡片）
      if (entity.cardIds && Array.isArray(entity.cardIds)) {
        for (const cardId of entity.cardIds) {
          checks.push(await this.checkReference(entity.id, this.getEntityType(entity), 'card', cardId, userId))
        }
      }

      // 检查标签引用
      if (entity.tags && Array.isArray(entity.tags)) {
        for (const tagName of entity.tags) {
          const tagId = await this.getTagIdByName(tagName, userId)
          if (tagId) {
            checks.push(await this.checkReference(entity.id, this.getEntityType(entity), 'tag', tagId, userId))
          }
        }
      }
    }

    return checks
  }

  private async checkReference(
    entityId: string,
    entityType: EntityType,
    referenceType: 'folder' | 'tag' | 'image' | 'card',
    referenceId: string,
    userId: string
  ): Promise<ReferenceCheck> {
    try {
      let exists = false

      switch (referenceType) {
        case 'folder':
          const folder = await db.folders.get(referenceId)
          exists = folder && !folder.isDeleted && folder.userId === userId
          break
        case 'card':
          const card = await db.cards.get(referenceId)
          exists = card && !card.isDeleted && card.userId === userId
          break
        case 'tag':
          const tag = await db.tags.get(referenceId)
          exists = tag && !tag.isDeleted && tag.userId === userId
          break
      }

      return {
        entityId,
        entityType,
        referenceType,
        referenceId,
        exists,
        broken: !exists
      }

    } catch (error) {
      this.log(`Reference check failed for ${entityId} -> ${referenceId}:`, error)
      return {
        entityId,
        entityType,
        referenceType,
        referenceId,
        exists: false,
        broken: true
      }
    }
  }

  private async getTagIdByName(tagName: string, userId: string): Promise<string | null> {
    try {
      const tag = await db.tags.where({ name: tagName, userId, isDeleted: false }).first()
      return tag?.id || null
    } catch {
      return null
    }
  }

  // ============================================================================
  // 数据结构检查
  // ============================================================================

  private async checkDataStructure(
    entityType: EntityType,
    userId: string,
    options: CheckOptions
  ): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = []

    try {
      const entities = await this.getLocalEntities(entityType, userId)

      for (const entity of entities) {
        const structureIssues = this.validateEntityStructure(entity, entityType)
        issues.push(...structureIssues)
      }

    } catch (error) {
      this.log(`Data structure check failed for ${entityType}:`, error)
    }

    return issues
  }

  private validateEntityStructure(entity: any, entityType: EntityType): IntegrityIssue[] {
    const issues: IntegrityIssue[] = []

    // 检查必需字段
    const requiredFields = this.getRequiredFields(entityType)
    for (const field of requiredFields) {
      if (!(field in entity) || entity[field] === null || entity[field] === undefined) {
        issues.push(this.createMissingFieldIssue(entity, entityType, field))
      }
    }

    // 检查数据类型
    const typeIssues = this.validateFieldTypes(entity, entityType)
    issues.push(...typeIssues)

    // 检查数据格式
    const formatIssues = this.validateDataFormat(entity, entityType)
    issues.push(...formatIssues)

    return issues
  }

  private getRequiredFields(entityType: EntityType): string[] {
    switch (entityType) {
      case 'card':
        return ['id', 'userId', 'frontContent', 'backContent', 'style', 'createdAt', 'updatedAt']
      case 'folder':
        return ['id', 'userId', 'name', 'cardIds', 'createdAt', 'updatedAt']
      case 'tag':
        return ['id', 'userId', 'name', 'color', 'createdAt']
      default:
        return ['id', 'userId', 'createdAt', 'updatedAt']
    }
  }

  private validateFieldTypes(entity: any, entityType: EntityType): IntegrityIssue[] {
    const issues: IntegrityIssue[] = []

    // 检查ID格式
    if (typeof entity.id !== 'string' || entity.id.length === 0) {
      issues.push(this.createInvalidTypeIssue(entity, entityType, 'id', 'string'))
    }

    // 检查时间戳格式
    if (!(entity.createdAt instanceof Date) && !this.isValidDateString(entity.createdAt)) {
      issues.push(this.createInvalidTypeIssue(entity, entityType, 'createdAt', 'Date'))
    }

    if (!(entity.updatedAt instanceof Date) && !this.isValidDateString(entity.updatedAt)) {
      issues.push(this.createInvalidTypeIssue(entity, entityType, 'updatedAt', 'Date'))
    }

    // 检查数组字段
    if (entityType === 'folder' && !Array.isArray(entity.cardIds)) {
      issues.push(this.createInvalidTypeIssue(entity, entityType, 'cardIds', 'array'))
    }

    return issues
  }

  private validateDataFormat(entity: any, entityType: EntityType): IntegrityIssue[] {
    const issues: IntegrityIssue[] = []

    // 检查循环引用
    if (entityType === 'folder' && entity.parentId) {
      if (this.hasCircularReference(entity, 'folders')) {
        issues.push(this.createCircularReferenceIssue(entity, entityType))
      }
    }

    // 检查内容大小
    if (entityType === 'card') {
      const contentSize = JSON.stringify(entity.frontContent).length + JSON.stringify(entity.backContent).length
      if (contentSize > 1000000) { // 1MB
        issues.push(this.createContentSizeIssue(entity, entityType, contentSize))
      }
    }

    return issues
  }

  private isValidDateString(date: any): boolean {
    return typeof date === 'string' && !isNaN(Date.parse(date))
  }

  private hasCircularReference(entity: any, tableName: string): boolean {
    // 简化的循环引用检测
    // 实际实现需要更复杂的图遍历算法
    return false
  }

  // ============================================================================
  // 跨实体一致性检查
  // ============================================================================

  private async checkCrossEntityConsistency(
    entityType: EntityType,
    userId: string,
    options: CheckOptions
  ): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = []

    try {
      // 检查卡片和文件夹的一致性
      if (entityType === 'card' || entityType === 'folder') {
        const consistencyIssues = await this.checkCardFolderConsistency(userId)
        issues.push(...consistencyIssues)
      }

      // 检查标签使用的一致性
      if (entityType === 'card' || entityType === 'tag') {
        const tagIssues = await this.checkTagConsistency(userId)
        issues.push(...tagIssues)
      }

    } catch (error) {
      this.log(`Cross-entity consistency check failed for ${entityType}:`, error)
    }

    return issues
  }

  private async checkCardFolderConsistency(userId: string): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = []

    try {
      const cards = await db.cards.where({ userId, isDeleted: false }).toArray()
      const folders = await db.folders.where({ userId, isDeleted: false }).toArray()

      // 检查所有卡片是否都在有效的文件夹中
      for (const card of cards) {
        if (card.folderId) {
          const folder = folders.find(f => f.id === card.folderId)
          if (!folder) {
            issues.push(this.createOrphanedCardIssue(card))
          } else if (!folder.cardIds.includes(card.id)) {
            issues.push(this.createInconsistentFolderIssue(card, folder))
          }
        }
      }

      // 检查文件夹中的卡片引用是否有效
      for (const folder of folders) {
        for (const cardId of folder.cardIds) {
          const card = cards.find(c => c.id === cardId)
          if (!card) {
            issues.push(this.createInvalidCardReferenceIssue(folder, cardId))
          } else if (card.folderId !== folder.id) {
            issues.push(this.createMismatchedFolderIssue(card, folder))
          }
        }
      }

    } catch (error) {
      this.log('Card-folder consistency check failed:', error)
    }

    return issues
  }

  private async checkTagConsistency(userId: string): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = []

    try {
      const cards = await db.cards.where({ userId, isDeleted: false }).toArray()
      const tags = await db.tags.where({ userId, isDeleted: false }).toArray()

      // 检查标签计数
      const tagCounts = new Map<string, number>()

      for (const card of cards) {
        const cardTags = this.extractTagsFromCard(card)
        for (const tagName of cardTags) {
          tagCounts.set(tagName, (tagCounts.get(tagName) || 0) + 1)
        }
      }

      for (const tag of tags) {
        const actualCount = tagCounts.get(tag.name) || 0
        if (tag.count !== actualCount) {
          issues.push(this.createTagCountIssue(tag, actualCount))
        }
      }

      // 检查未使用的标签
      for (const tag of tags) {
        if (tag.count === 0 && !tag.isHidden) {
          issues.push(this.createUnusedTagIssue(tag))
        }
      }

    } catch (error) {
      this.log('Tag consistency check failed:', error)
    }

    return issues
  }

  private extractTagsFromCard(card: DbCard): string[] {
    const tags = new Set<string>()

    // 从正面内容提取标签
    if (card.frontContent?.tags && Array.isArray(card.frontContent.tags)) {
      card.frontContent.tags.forEach(tags.add, tags)
    }

    // 从背面内容提取标签
    if (card.backContent?.tags && Array.isArray(card.backContent.tags)) {
      card.backContent.tags.forEach(tags.add, tags)
    }

    return Array.from(tags)
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private async validateDependencies(): Promise<void> {
    const dependencies = [
      { name: 'database', available: !!db, required: true },
      { name: 'supabase', available: !!supabase, required: true },
      { name: 'authService', available: !!authService, required: true },
      { name: 'eventSystem', available: !!eventSystem, required: false }
    ]

    const missingRequired = dependencies.filter(dep => dep.required && !dep.available)
    if (missingRequired.length > 0) {
      throw new Error(`Missing required dependencies: ${missingRequired.map(dep => dep.name).join(', ')}`)
    }
  }

  private async loadScheduledChecks(): Promise<void> {
    // 从本地存储加载定期检查配置
    try {
      const savedChecks = localStorage.getItem('integrity_scheduled_checks')
      if (savedChecks) {
        const checks: ScheduledCheck[] = JSON.parse(savedChecks)
        for (const check of checks) {
          this.scheduledChecks.set(check.id, check)
        }
      }
    } catch (error) {
      this.log('Failed to load scheduled checks:', error)
    }
  }

  private async initializeCaches(): Promise<void> {
    this.hashCache.clear()
    this.referenceCache.clear()
    this.issueCache.clear()
  }

  private async startScheduledChecks(): Promise<void> {
    for (const [id, check] of this.scheduledChecks) {
      if (check.enabled) {
        this.scheduleNextRun(id, check)
      }
    }
  }

  private stopScheduledChecks(): void {
    for (const [id] of this.scheduleTimers) {
      this.clearTimer(id)
    }
  }

  private scheduleNextRun(id: string, check: ScheduledCheck): void {
    // 简化的调度实现，实际应该使用cron库
    const interval = this.parseInterval(check.schedule)
    const nextRun = new Date(Date.now() + interval)

    check.nextRun = nextRun

    const timer = setTimeout(async () => {
      try {
        await this.runScheduledCheck(id)
        this.scheduleNextRun(id, check) // 安排下一次运行
      } catch (error) {
        this.log(`Scheduled check ${id} failed:`, error)
      }
    }, interval)

    this.scheduleTimers.set(id, timer)
  }

  private parseInterval(schedule: string): number {
    // 简化的间隔解析，支持小时和分钟
    if (schedule.includes('hour')) {
      const hours = parseInt(schedule) || 1
      return hours * 3600000
    } else if (schedule.includes('minute')) {
      const minutes = parseInt(schedule) || 30
      return minutes * 60000
    }
    return 3600000 // 默认1小时
  }

  private clearAllTimers(): void {
    for (const [id] of this.scheduleTimers) {
      this.clearTimer(id)
    }
  }

  private clearTimer(id: string): void {
    const timer = this.scheduleTimers.get(id)
    if (timer) {
      clearTimeout(timer)
      this.scheduleTimers.delete(id)
    }
  }

  private clearCaches(): void {
    this.hashCache.clear()
    this.referenceCache.clear()
    this.issueCache.clear()
  }

  private scheduleQuickCheck(): void {
    // 延迟5分钟后执行快速检查
    setTimeout(async () => {
      if (this.isStarted && !this.isRunning) {
        try {
          await this.runPartialCheck({
            checkTypes: [IntegrityCheckType.HASH],
            entityTypes: ['card'] as EntityType[],
            autoFix: false,
            priority: 'low'
          })
        } catch (error) {
          this.log('Quick check failed:', error)
        }
      }
    }, 300000)
  }

  private async getEntityCount(entityType: EntityType, userId: string): Promise<number> {
    try {
      switch (entityType) {
        case 'card':
          return await db.cards.where({ userId, isDeleted: false }).count()
        case 'folder':
          return await db.folders.where({ userId, isDeleted: false }).count()
        case 'tag':
          return await db.tags.where({ userId, isDeleted: false }).count()
        default:
          return 0
      }
    } catch {
      return 0
    }
  }

  private async getLocalEntities(entityType: EntityType, userId: string): Promise<any[]> {
    try {
      switch (entityType) {
        case 'card':
          return await db.cards.where({ userId, isDeleted: false }).toArray()
        case 'folder':
          return await db.folders.where({ userId, isDeleted: false }).toArray()
        case 'tag':
          return await db.tags.where({ userId, isDeleted: false }).toArray()
        default:
          return []
      }
    } catch (error) {
      this.log(`Failed to get local entities for ${entityType}:`, error)
      return []
    }
  }

  private async getRemoteEntities(entityType: EntityType, userId: string): Promise<any[]> {
    try {
      const tableName = this.getEntityTableName(entityType)
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false)

      if (error) throw error
      return data || []
    } catch (error) {
      this.log(`Failed to get remote entities for ${entityType}:`, error)
      return []
    }
  }

  private getEntityType(entity: any): EntityType {
    if (entity.frontContent && entity.backContent) return 'card'
    if (entity.cardIds && Array.isArray(entity.cardIds)) return 'folder'
    if (entity.name && entity.color) return 'tag'
    return 'card' // 默认
  }

  private getEntityTableName(entityType: EntityType): string {
    switch (entityType) {
      case 'card': return 'cards'
      case 'folder': return 'folders'
      case 'tag': return 'tags'
      default: throw new Error(`Unknown entity type: ${entityType}`)
    }
  }

  private generateSummary(issues: IntegrityIssue[]): IntegritySummary {
    const summary: IntegritySummary = {
      totalIssues: issues.length,
      criticalIssues: 0,
      errorIssues: 0,
      warningIssues: 0,
      infoIssues: 0,
      byType: {} as Record<IntegrityCheckType, number>,
      byEntityType: {} as Record<EntityType, number>
    }

    for (const issue of issues) {
      // 按严重程度统计
      switch (issue.severity) {
        case SeverityLevel.CRITICAL:
          summary.criticalIssues++
          break
        case SeverityLevel.ERROR:
          summary.errorIssues++
          break
        case SeverityLevel.WARNING:
          summary.warningIssues++
          break
        case SeverityLevel.INFO:
          summary.infoIssues++
          break
      }

      // 按检查类型统计
      summary.byType[issue.type] = (summary.byType[issue.type] || 0) + 1

      // 按实体类型统计
      summary.byEntityType[issue.entityType] = (summary.byEntityType[issue.entityType] || 0) + 1
    }

    return summary
  }

  private async autoFixIssues(issues: IntegrityIssue[]): Promise<number> {
    let fixedCount = 0

    for (const issue of issues) {
      if (issue.fixed || !issue.autoFixable) continue

      if (issue.severity === 'critical' || issue.severity === 'error') {
        continue // 严重问题需要手动处理
      }

      try {
        const fixed = await this.attemptAutoFix(issue)
        if (fixed) {
          fixedCount++
          issue.fixed = true
          issue.fixedAt = new Date()
        }
      } catch (error) {
        this.log(`Auto fix failed for issue ${issue.id}:`, error)
      }
    }

    return fixedCount
  }

  private async attemptAutoFix(issue: IntegrityIssue): Promise<boolean> {
    // 选择最佳修复建议
    const bestSuggestion = issue.fixSuggestions
      .filter(s => !this.config.requireConfirmationFor.includes(s.action))
      .sort((a, b) => b.confidence - a.confidence)[0]

    if (!bestSuggestion) return false

    return this.applyFixSuggestion(issue, bestSuggestion)
  }

  private async applyFixSuggestion(issue: IntegrityIssue, suggestion: FixSuggestion): Promise<boolean> {
    try {
      switch (suggestion.action) {
        case 'sync_local_to_remote':
          return await this.syncLocalToRemote(issue.entityId, issue.entityType)
        case 'sync_remote_to_local':
          return await this.syncRemoteToLocal(issue.entityId, issue.entityType)
        case 'update_metadata':
          return await this.updateEntityMetadata(issue.entityId, issue.entityType, issue.details)
        default:
          return false
      }
    } catch (error) {
      this.log(`Failed to apply fix suggestion ${suggestion.id}:`, error)
      return false
    }
  }

  private async syncLocalToRemote(entityId: string, entityType: EntityType): Promise<boolean> {
    try {
      const entity = await this.getLocalEntity(entityId, entityType)
      if (!entity) return false

      const tableName = this.getEntityTableName(entityType)
      const { error } = await supabase
        .from(tableName)
        .upload(entity)

      return !error
    } catch {
      return false
    }
  }

  private async syncRemoteToLocal(entityId: string, entityType: EntityType): Promise<boolean> {
    try {
      const entity = await this.getRemoteEntity(entityId, entityType)
      if (!entity) return false

      const table = this.getEntityTable(entityType)
      await table.put(entity)

      return true
    } catch {
      return false
    }
  }

  private async updateEntityMetadata(entityId: string, entityType: EntityType, metadata: any): Promise<boolean> {
    try {
      const table = this.getEntityTable(entityType)
      await table.update(entityId, metadata)
      return true
    } catch {
      return false
    }
  }

  private async getLocalEntity(entityId: string, entityType: EntityType): Promise<any> {
    const table = this.getEntityTable(entityType)
    return await table.get(entityId)
  }

  private async getRemoteEntity(entityId: string, entityType: EntityType): Promise<any> {
    try {
      const tableName = this.getEntityTableName(entityType)
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', entityId)
        .single()

      return error ? null : data
    } catch {
      return null
    }
  }

  private getEntityTable(entityType: EntityType) {
    switch (entityType) {
      case 'card': return db.cards
      case 'folder': return db.folders
      case 'tag': return db.tags
      default: throw new Error(`Unknown entity type: ${entityType}`)
    }
  }

  private generateRecommendations(issues: IntegrityIssue[], summary: IntegritySummary): string[] {
    const recommendations: string[] = []

    if (summary.criticalIssues > 0) {
      recommendations.push(`发现 ${summary.criticalIssues} 个严重问题，建议立即处理以避免数据丢失。`)
    }

    if (summary.errorIssues > 0) {
      recommendations.push(`存在 ${summary.errorIssues} 个错误，可能影响同步功能正常运行。`)
    }

    if (summary.byType[IntegrityCheckType.REFERENCE] > 0) {
      recommendations.push('检测到引用完整性问题，建议清理无效引用以保持数据一致性。')
    }

    if (summary.byType[IntegrityCheckType.HASH] > 0) {
      recommendations.push('发现数据哈希不一致，建议运行完整同步以修复数据差异。')
    }

    if (issues.filter(i => !i.fixed && !i.autoFixable).length > 0) {
      recommendations.push('存在需要手动处理的问题，请查看详细问题列表并进行修复。')
    }

    return recommendations
  }

  private async cacheCheckResult(result: IntegrityCheckResult): Promise<void> {
    try {
      const cacheKey = `check_result_${result.id}`
      this.issueCache.set(cacheKey, result.issues)

      // 限制缓存大小
      if (this.issueCache.size > 100) {
        const oldestKey = this.issueCache.keys().next().value
        this.issueCache.delete(oldestKey)
      }
    } catch (error) {
      this.log('Failed to cache check result:', error)
    }
  }

  private createErrorResult(checkId: string, options: CheckOptions, error: any): IntegrityCheckResult {
    return {
      id: checkId,
      status: CheckStatus.FAILED,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      checkTypes: options.checkTypes,
      entityTypes: options.entityTypes,
      totalEntities: 0,
      checkedEntities: 0,
      issues: [],
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        errorIssues: 0,
        warningIssues: 0,
        infoIssues: 0,
        byType: {} as Record<IntegrityCheckType, number>,
        byEntityType: {} as Record<EntityType, number>
      },
      recommendations: [`检查失败: ${error instanceof Error ? error.message : '未知错误'}`],
      autoFixed: 0,
      requiresUserAction: 0
    }
  }

  // ============================================================================
  // 问题创建方法
  // ============================================================================

  private createHashIssue(local: any, remote: any, localHash: DataHash, remoteHash: DataHash): IntegrityIssue {
    return {
      id: crypto.randomUUID(),
      type: IntegrityCheckType.HASH,
      severity: SeverityLevel.ERROR,
      entityType: this.getEntityType(local),
      entityId: local.id,
      title: '数据哈希不一致',
      description: '本地和远程数据的内容哈希值不匹配，可能存在数据同步问题。',
      details: {
        localHash: localHash.contentHash,
        remoteHash: remoteHash.contentHash,
        localVersion: local.syncVersion,
        remoteVersion: remote.syncVersion
      },
      detectedAt: new Date(),
      fixSuggestions: [
        {
          id: crypto.randomUUID(),
          action: 'sync_local_to_remote',
          title: '同步本地数据到远程',
          description: '将本地数据覆盖到远程，确保数据一致性。',
          confidence: 0.8,
          estimatedImpact: 'medium',
          requiresConfirmation: true
        },
        {
          id: crypto.randomUUID(),
          action: 'sync_remote_to_local',
          title: '同步远程数据到本地',
          description: '将远程数据覆盖到本地，确保数据一致性。',
          confidence: 0.7,
          estimatedImpact: 'medium',
          requiresConfirmation: true
        },
        {
          id: crypto.randomUUID(),
          action: 'merge',
          title: '合并数据',
          description: '尝试智能合并本地和远程数据，保留最新修改。',
          confidence: 0.6,
          estimatedImpact: 'high',
          requiresConfirmation: true
        }
      ],
      autoFixable: false
    }
  }

  private createMissingRemoteIssue(local: any, entityType: EntityType): IntegrityIssue {
    return {
      id: crypto.randomUUID(),
      type: IntegrityCheckType.CONSISTENCY,
      severity: SeverityLevel.WARNING,
      entityType,
      entityId: local.id,
      title: '远程数据缺失',
      description: '本地存在但远程缺失的数据，可能需要上传到服务器。',
      details: {
        localData: local,
        lastSyncTime: local.lastSyncAt
      },
      detectedAt: new Date(),
      fixSuggestions: [
        {
          id: crypto.randomUUID(),
          action: 'sync_local_to_remote',
          title: '上传到远程',
          description: '将本地数据上传到远程服务器。',
          confidence: 0.9,
          estimatedImpact: 'low',
          requiresConfirmation: false
        }
      ],
      autoFixable: true
    }
  }

  private createMissingLocalIssue(remote: any, entityType: EntityType): IntegrityIssue {
    return {
      id: crypto.randomUUID(),
      type: IntegrityCheckType.CONSISTENCY,
      severity: SeverityLevel.WARNING,
      entityType,
      entityId: remote.id,
      title: '本地数据缺失',
      description: '远程存在但本地缺失的数据，可能需要下载到本地。',
      details: {
        remoteData: remote
      },
      detectedAt: new Date(),
      fixSuggestions: [
        {
          id: crypto.randomUUID(),
          action: 'sync_remote_to_local',
          title: '下载到本地',
          description: '从远程服务器下载数据到本地。',
          confidence: 0.9,
          estimatedImpact: 'low',
          requiresConfirmation: false
        }
      ],
      autoFixable: true
    }
  }

  private createVersionIssue(local: any, remote: any, entityType: EntityType): IntegrityIssue {
    return {
      id: crypto.randomUUID(),
      type: IntegrityCheckType.METADATA,
      severity: SeverityLevel.INFO,
      entityType,
      entityId: local.id,
      title: '版本号不一致',
      description: '本地和远程数据的版本号不匹配。',
      details: {
        localVersion: local.syncVersion,
        remoteVersion: remote.sync_version
      },
      detectedAt: new Date(),
      fixSuggestions: [
        {
          id: crypto.randomUUID(),
          action: 'update_metadata',
          title: '更新版本号',
          description: '同步版本号以保持一致性。',
          confidence: 0.9,
          estimatedImpact: 'low',
          requiresConfirmation: false
        }
      ],
      autoFixable: true
    }
  }

  private createTimestampIssue(local: any, remote: any, entityType: EntityType): IntegrityIssue {
    return {
      id: crypto.randomUUID(),
      type: IntegrityCheckType.METADATA,
      severity: SeverityLevel.WARNING,
      entityType,
      entityId: local.id,
      title: '时间戳不一致',
      description: '本地和远程数据的更新时间不一致。',
      details: {
        localUpdatedAt: local.updatedAt,
        remoteUpdatedAt: remote.updated_at
      },
      detectedAt: new Date(),
      fixSuggestions: [
        {
          id: crypto.randomUUID(),
          action: 'update_metadata',
          title: '同步时间戳',
          description: '更新时间戳以保持一致性。',
          confidence: 0.8,
          estimatedImpact: 'low',
          requiresConfirmation: false
        }
      ],
      autoFixable: true
    }
  }

  private createDeletionFlagIssue(local: any, remote: any, entityType: EntityType): IntegrityIssue {
    return {
      id: crypto.randomUUID(),
      type: IntegrityCheckType.METADATA,
      severity: SeverityLevel.ERROR,
      entityType,
      entityId: local.id,
      title: '删除标记不一致',
      description: '本地和远程数据的删除状态不一致。',
      details: {
        localDeleted: local.isDeleted,
        remoteDeleted: remote.is_deleted
      },
      detectedAt: new Date(),
      fixSuggestions: [
        {
          id: crypto.randomUUID(),
          action: local.isDeleted ? 'delete_remote' : 'delete_local',
          title: local.isDeleted ? '删除远程数据' : '删除本地数据',
          description: '同步删除状态以保持一致性。',
          confidence: 0.9,
          estimatedImpact: 'medium',
          requiresConfirmation: true
        }
      ],
      autoFixable: false
    }
  }

  private createReferenceIssue(check: ReferenceCheck): IntegrityIssue {
    return {
      id: crypto.randomUUID(),
      type: IntegrityCheckType.REFERENCE,
      severity: SeverityLevel.ERROR,
      entityType: check.entityType,
      entityId: check.entityId,
      title: '引用完整性问题',
      description: `引用的${check.referenceType}不存在或已被删除。`,
      details: {
        referenceType: check.referenceType,
        referenceId: check.referenceId,
        exists: check.exists
      },
      detectedAt: new Date(),
      fixSuggestions: [
        {
          id: crypto.randomUUID(),
          action: 'repair_reference',
          title: '修复引用',
          description: '移除无效引用或修复引用关系。',
          confidence: 0.8,
          estimatedImpact: 'medium',
          requiresConfirmation: false
        }
      ],
      autoFixable: true
    }
  }

  private createMissingFieldIssue(entity: any, entityType: EntityType, field: string): IntegrityIssue {
    return {
      id: crypto.randomUUID(),
      type: IntegrityCheckType.STRUCTURE,
      severity: SeverityLevel.ERROR,
      entityType,
      entityId: entity.id,
      title: '缺少必需字段',
      description: `实体缺少必需的字段: ${field}`,
      details: {
        missingField: field,
        entityData: entity
      },
      detectedAt: new Date(),
      fixSuggestions: [
        {
          id: crypto.randomUUID(),
          action: 'update_metadata',
          title: '添加缺失字段',
          description: '为实体添加缺失的必需字段。',
          confidence: 0.7,
          estimatedImpact: 'medium',
          requiresConfirmation: false
        }
      ],
      autoFixable: true
    }
  }

  private createInvalidTypeIssue(entity: any, entityType: EntityType, field: string, expectedType: string): IntegrityIssue {
    return {
      id: crypto.randomUUID(),
      type: IntegrityCheckType.STRUCTURE,
      severity: SeverityLevel.WARNING,
      entityType,
      entityId: entity.id,
      title: '字段类型错误',
      description: `字段 ${field} 的类型应为 ${expectedType}`,
      details: {
        field,
        expectedType,
        actualType: typeof entity[field],
        actualValue: entity[field]
      },
      detectedAt: new Date(),
      fixSuggestions: [
        {
          id: crypto.randomUUID(),
          action: 'update_metadata',
          title: '修正字段类型',
          description: `将字段 ${field} 的类型修正为 ${expectedType}`,
          confidence: 0.8,
          estimatedImpact: 'low',
          requiresConfirmation: false
        }
      ],
      autoFixable: true
    }
  }

  private createCircularReferenceIssue(entity: any, entityType: EntityType): IntegrityIssue {
    return {
      id: crypto.randomUUID(),
      type: IntegrityCheckType.STRUCTURE,
      severity: SeverityLevel.CRITICAL,
      entityType,
      entityId: entity.id,
      title: '循环引用',
      description: '检测到循环引用，可能导致无限循环。',
      details: {
        circularPath: [] // 实际实现需要记录循环路径
      },
      detectedAt: new Date(),
      fixSuggestions: [
        {
          id: crypto.randomUUID(),
          action: 'repair_reference',
          title: '修复循环引用',
          description: '打破循环引用以恢复正常的数据结构。',
          confidence: 0.7,
          estimatedImpact: 'high',
          requiresConfirmation: true
        }
      ],
      autoFixable: false
    }
  }

  private createContentSizeIssue(entity: any, entityType: EntityType, size: number): IntegrityIssue {
    return {
      id: crypto.randomUUID(),
      type: IntegrityCheckType.STRUCTURE,
      severity: SeverityLevel.WARNING,
      entityType,
      entityId: entity.id,
      title: '内容过大',
      description: `实体内容大小 (${size} bytes) 超过建议限制 (1MB)`,
      details: {
        contentSize: size,
        recommendedMaxSize: 1000000
      },
      detectedAt: new Date(),
      fixSuggestions: [
        {
          id: crypto.randomUUID(),
          action: 'update_metadata',
          title: '优化内容大小',
          description: '优化实体内容以减少存储空间。',
          confidence: 0.6,
          estimatedImpact: 'medium',
          requiresConfirmation: false
        }
      ],
      autoFixable: false
    }
  }

  private createOrphanedCardIssue(card: DbCard): IntegrityIssue {
    return {
      id: crypto.randomUUID(),
      type: IntegrityCheckType.REFERENCE,
      severity: SeverityLevel.WARNING,
      entityType: 'card',
      entityId: card.id,
      title: '孤立卡片',
      description: '卡片引用了不存在的文件夹。',
      details: {
        folderId: card.folderId
      },
      detectedAt: new Date(),
      fixSuggestions: [
        {
          id: crypto.randomUUID(),
          action: 'repair_reference',
          title: '移除文件夹引用',
          description: '将卡片的文件夹引用设置为null。',
          confidence: 0.9,
          estimatedImpact: 'low',
          requiresConfirmation: false
        }
      ],
      autoFixable: true
    }
  }

  private createInconsistentFolderIssue(card: DbCard, folder: DbFolder): IntegrityIssue {
    return {
      id: crypto.randomUUID(),
      type: IntegrityCheckType.CONSISTENCY,
      severity: SeverityLevel.WARNING,
      entityType: 'card',
      entityId: card.id,
      title: '文件夹引用不一致',
      description: '卡片引用了文件夹，但文件夹中不包含该卡片。',
      details: {
        cardId: card.id,
        folderId: folder.id,
        folderCardIds: folder.cardIds
      },
      detectedAt: new Date(),
      fixSuggestions: [
        {
          id: crypto.randomUUID(),
          action: 'repair_reference',
          title: '修复文件夹引用',
          description: '将卡片添加到文件夹的卡片列表中。',
          confidence: 0.9,
          estimatedImpact: 'low',
          requiresConfirmation: false
        }
      ],
      autoFixable: true
    }
  }

  private createInvalidCardReferenceIssue(folder: DbFolder, cardId: string): IntegrityIssue {
    return {
      id: crypto.randomUUID(),
      type: IntegrityCheckType.REFERENCE,
      severity: SeverityLevel.WARNING,
      entityType: 'folder',
      entityId: folder.id,
      title: '无效的卡片引用',
      description: '文件夹引用了不存在的卡片。',
      details: {
        cardId,
        folderCardIds: folder.cardIds
      },
      detectedAt: new Date(),
      fixSuggestions: [
        {
          id: crypto.randomUUID(),
          action: 'repair_reference',
          title: '移除无效引用',
          description: '从文件夹的卡片列表中移除无效引用。',
          confidence: 0.9,
          estimatedImpact: 'low',
          requiresConfirmation: false
        }
      ],
      autoFixable: true
    }
  }

  private createMismatchedFolderIssue(card: DbCard, folder: DbFolder): IntegrityIssue {
    return {
      id: crypto.randomUUID(),
      type: IntegrityCheckType.CONSISTENCY,
      severity: SeverityLevel.WARNING,
      entityType: 'card',
      entityId: card.id,
      title: '文件夹引用不匹配',
      description: '卡片的文件夹引用与文件夹中的引用不匹配。',
      details: {
        cardFolderId: card.folderId,
        folderId: folder.id,
        folderContainsCard: folder.cardIds.includes(card.id)
      },
      detectedAt: new Date(),
      fixSuggestions: [
        {
          id: crypto.randomUUID(),
          action: 'repair_reference',
          title: '同步引用',
          description: '同步卡片和文件夹之间的引用关系。',
          confidence: 0.8,
          estimatedImpact: 'low',
          requiresConfirmation: false
        }
      ],
      autoFixable: true
    }
  }

  private createTagCountIssue(tag: DbTag, actualCount: number): IntegrityIssue {
    return {
      id: crypto.randomUUID(),
      type: IntegrityCheckType.CONSISTENCY,
      severity: SeverityLevel.INFO,
      entityType: 'tag',
      entityId: tag.id,
      title: '标签计数不准确',
      description: `标签的计数 (${tag.count}) 与实际使用次数 (${actualCount}) 不匹配。`,
      details: {
        recordedCount: tag.count,
        actualCount,
        tagName: tag.name
      },
      detectedAt: new Date(),
      fixSuggestions: [
        {
          id: crypto.randomUUID(),
          action: 'update_metadata',
          title: '更新标签计数',
          description: '将标签计数更新为实际使用次数。',
          confidence: 0.9,
          estimatedImpact: 'low',
          requiresConfirmation: false
        }
      ],
      autoFixable: true
    }
  }

  private createUnusedTagIssue(tag: DbTag): IntegrityIssue {
    return {
      id: crypto.randomUUID(),
      type: IntegrityCheckType.CONSISTENCY,
      severity: SeverityLevel.INFO,
      entityType: 'tag',
      entityId: tag.id,
      title: '未使用的标签',
      description: '标签没有被任何卡片使用。',
      details: {
        tagName: tag.name,
        count: tag.count
      },
      detectedAt: new Date(),
      fixSuggestions: [
        {
          id: crypto.randomUUID(),
          action: 'delete_local',
          title: '删除标签',
          description: '删除未使用的标签以清理数据。',
          confidence: 0.7,
          estimatedImpact: 'low',
          requiresConfirmation: false
        }
      ],
      autoFixable: true
    }
  }

  // ============================================================================
  // 问题管理
  // ============================================================================

  async getIssues(filters?: IssueFilters): Promise<IntegrityIssue[]> {
    // 从缓存中获取问题
    const allIssues: IntegrityIssue[] = []

    for (const issues of this.issueCache.values()) {
      allIssues.push(...issues)
    }

    // 应用过滤器
    if (filters) {
      return this.filterIssues(allIssues, filters)
    }

    return allIssues
  }

  private filterIssues(issues: IntegrityIssue[], filters: IssueFilters): IntegrityIssue[] {
    return issues.filter(issue => {
      if (filters.types && !filters.types.includes(issue.type)) return false
      if (filters.severities && !filters.severities.includes(issue.severity)) return false
      if (filters.entityTypes && !filters.entityTypes.includes(issue.entityType)) return false
      if (filters.fixed !== undefined && issue.fixed !== filters.fixed) return false
      if (filters.autoFixable !== undefined && issue.autoFixable !== filters.autoFixable) return false
      if (filters.dateRange) {
        const issueDate = issue.detectedAt.getTime()
        const start = filters.dateRange.start.getTime()
        const end = filters.dateRange.end.getTime()
        if (issueDate < start || issueDate > end) return false
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        if (!issue.title.toLowerCase().includes(searchLower) &&
            !issue.description.toLowerCase().includes(searchLower)) {
          return false
        }
      }
      return true
    })
  }

  async fixIssue(issueId: string, fixSuggestionId: string, confirmation?: boolean): Promise<boolean> {
    // 查找问题
    const issue = await this.findIssueById(issueId)
    if (!issue) return false

    // 查找修复建议
    const suggestion = issue.fixSuggestions.find(s => s.id === fixSuggestionId)
    if (!suggestion) return false

    // 检查是否需要确认
    if (suggestion.requiresConfirmation && !confirmation) {
      throw new Error('此修复操作需要用户确认')
    }

    // 应用修复
    return this.applyFixSuggestion(issue, suggestion)
  }

  async fixMultipleIssues(issueFixes: Array<{ issueId: string; fixSuggestionId: string; confirmation?: boolean }>): Promise<boolean[]> {
    const results = await Promise.allSettled(
      issueFixes.map(({ issueId, fixSuggestionId, confirmation }) =>
        this.fixIssue(issueId, fixSuggestionId, confirmation)
      )
    )

    return results.map(result => result.status === 'fulfilled' ? result.value : false)
  }

  async ignoreIssue(issueId: string, reason?: string): Promise<void> {
    // 实现忽略问题的逻辑
    this.log(`Issue ${issueId} ignored. Reason: ${reason}`)
  }

  async unignoreIssue(issueId: string): Promise<void> {
    // 实现取消忽略问题的逻辑
    this.log(`Issue ${issueId} unignored`)
  }

  private async findIssueById(issueId: string): Promise<IntegrityIssue | null> {
    for (const issues of this.issueCache.values()) {
      const issue = issues.find(i => i.id === issueId)
      if (issue) return issue
    }
    return null
  }

  // ============================================================================
  // 定期检查管理
  // ============================================================================

  async createScheduledCheck(config: Omit<ScheduledCheck, 'id'>): Promise<string> {
    const id = crypto.randomUUID()
    const scheduledCheck: ScheduledCheck = {
      id,
      ...config
    }

    this.scheduledChecks.set(id, scheduledCheck)

    if (config.enabled && this.isStarted) {
      this.scheduleNextRun(id, scheduledCheck)
    }

    await this.saveScheduledChecks()
    return id
  }

  async updateScheduledCheck(id: string, config: Partial<ScheduledCheck>): Promise<void> {
    const check = this.scheduledChecks.get(id)
    if (!check) {
      throw new Error(`Scheduled check ${id} not found`)
    }

    // 清除现有定时器
    this.clearTimer(id)

    // 更新配置
    Object.assign(check, config)

    // 重新安排
    if (check.enabled && this.isStarted) {
      this.scheduleNextRun(id, check)
    }

    await this.saveScheduledChecks()
  }

  async deleteScheduledCheck(id: string): Promise<void> {
    if (!this.scheduledChecks.has(id)) {
      throw new Error(`Scheduled check ${id} not found`)
    }

    this.clearTimer(id)
    this.scheduledChecks.delete(id)
    await this.saveScheduledChecks()
  }

  async getScheduledChecks(): Promise<ScheduledCheck[]> {
    return Array.from(this.scheduledChecks.values())
  }

  async runScheduledCheck(id: string): Promise<IntegrityCheckResult> {
    const check = this.scheduledChecks.get(id)
    if (!check) {
      throw new Error(`Scheduled check ${id} not found`)
    }

    check.lastRun = new Date()

    const result = await this.performIntegrityCheck({
      checkTypes: check.checkTypes,
      entityTypes: check.entityTypes,
      autoFix: check.autoFix,
      priority: 'normal'
    })

    // 发送通知
    if (check.notificationSettings.enabled) {
      await this.sendScheduledCheckNotifications(check, result)
    }

    return result
  }

  private async saveScheduledChecks(): Promise<void> {
    try {
      const checks = Array.from(this.scheduledChecks.values())
      localStorage.setItem('integrity_scheduled_checks', JSON.stringify(checks))
    } catch (error) {
      this.log('Failed to save scheduled checks:', error)
    }
  }

  private async sendScheduledCheckNotifications(check: ScheduledCheck, result: IntegrityCheckResult): Promise<void> {
    // 实现通知逻辑
    if (check.notificationSettings.onFailure && result.status === CheckStatus.FAILED) {
      this.emit('integrity:notification', {
        type: 'check_failed',
        checkName: check.name,
        result,
        timestamp: new Date()
      })
    }

    if (check.notificationSettings.onCompletion && result.status === CheckStatus.COMPLETED) {
      this.emit('integrity:notification', {
        type: 'check_completed',
        checkName: check.name,
        result,
        timestamp: new Date()
      })
    }

    if (check.notificationSettings.onIssue && result.issues.length > 0) {
      this.emit('integrity:notification', {
        type: 'issues_detected',
        checkName: check.name,
        issueCount: result.issues.length,
        result,
        timestamp: new Date()
      })
    }
  }

  // ============================================================================
  // 报告和分析
  // ============================================================================

  async getCheckHistory(limit: number = 50): Promise<IntegrityCheckResult[]> {
    // 从本地存储获取检查历史
    try {
      const history = localStorage.getItem('integrity_check_history')
      if (history) {
        const results: IntegrityCheckResult[] = JSON.parse(history)
        return results.slice(0, limit)
      }
    } catch (error) {
      this.log('Failed to load check history:', error)
    }
    return []
  }

  async generateReport(checkId: string): Promise<IntegrityReport> {
    const checkHistory = await this.getCheckHistory()
    const checkResult = checkHistory.find(r => r.id === checkId)

    if (!checkResult) {
      throw new Error(`Check result ${checkId} not found`)
    }

    return {
      id: crypto.randomUUID(),
      checkId,
      generatedAt: new Date(),
      summary: checkResult.summary,
      sections: this.generateReportSections(checkResult),
      recommendations: this.generateDetailedRecommendations(checkResult),
      charts: this.generateChartData(checkResult),
      rawData: checkResult
    }
  }

  async getIntegrityMetrics(timeRange?: { start: Date; end: Date }): Promise<IntegrityMetrics> {
    const history = await this.getCheckHistory()

    let filteredHistory = history
    if (timeRange) {
      filteredHistory = history.filter(r => {
        const checkTime = new Date(r.startTime).getTime()
        return checkTime >= timeRange.start.getTime() && checkTime <= timeRange.end.getTime()
      })
    }

    const totalChecks = filteredHistory.length
    const successfulChecks = filteredHistory.filter(r => r.status === CheckStatus.COMPLETED).length
    const failedChecks = filteredHistory.filter(r => r.status === CheckStatus.FAILED).length

    const totalIssuesDetected = filteredHistory.reduce((sum, r) => sum + r.issues.length, 0)
    const totalIssuesFixed = filteredHistory.reduce((sum, r) => sum + r.autoFixed, 0)

    const averageCheckTime = successfulChecks > 0
      ? filteredHistory.reduce((sum, r) => sum + (r.duration || 0), 0) / successfulChecks
      : 0

    const issuesByType: Record<IntegrityCheckType, number> = {} as any
    const issuesBySeverity: Record<SeverityLevel, number> = {} as any

    for (const result of filteredHistory) {
      for (const issue of result.issues) {
        issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1
        issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1
      }
    }

    return {
      totalChecks,
      successfulChecks,
      failedChecks,
      averageCheckTime,
      totalIssuesDetected,
      totalIssuesFixed,
      issuesByType,
      issuesBySeverity,
      trends: {
        detected: this.calculateTrends(filteredHistory, 'detected'),
        fixed: this.calculateTrends(filteredHistory, 'fixed'),
        resolutionRate: this.calculateResolutionRateTrends(filteredHistory)
      }
    }
  }

  private generateReportSections(checkResult: IntegrityCheckResult): ReportSection[] {
    return [
      {
        id: 'summary',
        title: '检查摘要',
        type: 'summary',
        content: checkResult.summary,
        priority: 1
      },
      {
        id: 'issues',
        title: '问题详情',
        type: 'issues',
        content: checkResult.issues,
        priority: 2
      },
      {
        id: 'metrics',
        title: '检查指标',
        type: 'metrics',
        content: {
          duration: checkResult.duration,
          totalEntities: checkResult.totalEntities,
          checkedEntities: checkResult.checkedEntities,
          autoFixed: checkResult.autoFixed,
          requiresUserAction: checkResult.requiresUserAction
        },
        priority: 3
      },
      {
        id: 'recommendations',
        title: '改进建议',
        type: 'recommendations',
        content: checkResult.recommendations,
        priority: 4
      }
    ]
  }

  private generateDetailedRecommendations(checkResult: IntegrityCheckResult): Recommendation[] {
    const recommendations: Recommendation[] = []

    if (checkResult.summary.criticalIssues > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        title: '立即处理严重问题',
        description: `发现 ${checkResult.summary.criticalIssues} 个严重问题，需要立即处理以避免数据丢失或系统故障。`,
        impact: 'high',
        effort: 'medium',
        category: 'immediate',
        actions: [
          '查看严重问题详情',
          '根据修复建议手动修复',
          '在修复前备份数据'
        ]
      })
    }

    if (checkResult.summary.errorIssues > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        title: '修复错误问题',
        description: `存在 ${checkResult.summary.errorIssues} 个错误问题，建议尽快修复以确保系统正常运行。`,
        impact: 'medium',
        effort: 'medium',
        category: 'short-term',
        actions: [
          '分析错误问题的根本原因',
          '应用自动修复或手动修复',
          '验证修复结果'
        ]
      })
    }

    if (checkResult.autoFixed > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        title: '验证自动修复',
        description: `${checkResult.autoFixed} 个问题已自动修复，建议验证修复结果。`,
        impact: 'low',
        effort: 'low',
        category: 'immediate',
        actions: [
          '检查自动修复的问题',
          '验证数据一致性',
          '监控后续同步状态'
        ]
      })
    }

    return recommendations
  }

  private generateChartData(checkResult: IntegrityCheckResult): ChartData[] {
    return [
      {
        id: 'issues-by-type',
        title: '问题类型分布',
        type: 'pie',
        data: Object.entries(checkResult.summary.byType).map(([type, count]) => ({
          label: type,
          value: count
        })),
        config: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      },
      {
        id: 'issues-by-severity',
        title: '问题严重程度分布',
        type: 'bar',
        data: [
          { label: '严重', value: checkResult.summary.criticalIssues },
          { label: '错误', value: checkResult.summary.errorIssues },
          { label: '警告', value: checkResult.summary.warningIssues },
          { label: '信息', value: checkResult.summary.infoIssues }
        ],
        config: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      }
    ]
  }

  private calculateTrends(history: IntegrityCheckResult[], type: 'detected' | 'fixed'): Array<{ date: Date; count: number }> {
    return history.map(result => ({
      date: new Date(result.startTime),
      count: type === 'detected' ? result.issues.length : result.autoFixed
    }))
  }

  private calculateResolutionRateTrends(history: IntegrityCheckResult[]): Array<{ date: Date; rate: number }> {
    return history.map(result => {
      const totalIssues = result.issues.length
      const fixedIssues = result.autoFixed
      const rate = totalIssues > 0 ? (fixedIssues / totalIssues) * 100 : 100

      return {
        date: new Date(result.startTime),
        rate: Math.round(rate * 100) / 100
      }
    })
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  updateConfig(config: Partial<IntegrityCheckConfig>): void {
    const oldConfig = { ...this.config }
    this.config = { ...this.config, ...config }

    this.emit('integrity:config:updated', {
      oldConfig,
      newConfig: this.config,
      timestamp: new Date()
    })

    // 如果检查间隔改变，重新安排定期检查
    if (oldConfig.checkInterval !== this.config.checkInterval) {
      this.restartScheduledChecks()
    }
  }

  getConfig(): IntegrityCheckConfig {
    return { ...this.config }
  }

  private restartScheduledChecks(): void {
    if (!this.isStarted) return

    this.stopScheduledChecks()
    this.startScheduledChecks()
  }

  // ============================================================================
  // 事件处理
  // ============================================================================

  on(event: string, listener: Function): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }

    this.eventListeners.get(event)!.add(listener)

    return () => {
      const listeners = this.eventListeners.get(event)
      if (listeners) {
        listeners.delete(listener)
        if (listeners.size === 0) {
          this.eventListeners.delete(event)
        }
      }
    }
  }

  emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data)
        } catch (error) {
          this.log(`Error in event listener for ${event}:`, error)
        }
      })
    }
  }

  // ============================================================================
  // 日志和调试
  // ============================================================================

  private log(message: string, ...args: any[]): void {
    console.log(`[DataIntegrityChecker] ${message}`, ...args)
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const dataIntegrityChecker = DataIntegrityChecker.getInstance()

// ============================================================================
// 导出便利方法
// ============================================================================

export const initializeDataIntegrityChecker = (config?: Partial<IntegrityCheckConfig>) =>
  dataIntegrityChecker.initialize(config)

export const startDataIntegrityChecker = () =>
  dataIntegrityChecker.start()

export const stopDataIntegrityChecker = () =>
  dataIntegrityChecker.stop()

export const runIntegrityCheck = (options?: Partial<CheckOptions>) =>
  dataIntegrityChecker.runFullCheck(options)

export const getIntegrityIssues = (filters?: IssueFilters) =>
  dataIntegrityChecker.getIssues(filters)

export const fixIntegrityIssue = (issueId: string, fixSuggestionId: string, confirmation?: boolean) =>
  dataIntegrityChecker.fixIssue(issueId, fixSuggestionId, confirmation)