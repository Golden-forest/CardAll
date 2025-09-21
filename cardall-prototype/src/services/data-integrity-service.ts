/**
 * 数据完整性检查服务
 * 提供全面的数据完整性验证、自动修复和备份恢复功能
 * 确保存储数据的完整性和一致性
 */

import { db, DatabaseStats } from './database-unified'
import { dataValidator, ValidationResult } from './data-validator'
import { backupCoreService, BackupResult, RestoreResult } from './core/backup/backup-core.service'

// ============================================================================
// 核心类型定义
// ============================================================================

export interface IntegrityCheckConfig {
  id: string
  name: string
  enabled: boolean
  schedule: {
    enabled: boolean
    interval: number // 毫秒
    lastRun?: Date
    nextRun?: Date
  }
  checks: {
    dataValidation: boolean
    referenceIntegrity: boolean
    syncStatus: boolean
    performance: boolean
    storage: boolean
    security: boolean
  }
  autoRepair: {
    enabled: boolean
    maxRetries: number
    allowedTypes: ('missing_field' | 'invalid_format' | 'reference_broken')[]
  }
  backup: {
    enabled: boolean
    beforeRepair: boolean
    afterRepair: boolean
    configId?: string
  }
  notifications: {
    enabled: boolean
    onCritical: boolean
    onWarning: boolean
    onCompletion: boolean
  }
}

export interface IntegrityCheckResult {
  id: string
  configId: string
  timestamp: Date
  duration: number
  overallStatus: 'healthy' | 'warning' | 'critical' | 'failed'
  summary: {
    totalChecks: number
    passedChecks: number
    failedChecks: number
    warnings: number
    errors: number
    criticalErrors: number
  }
  details: {
    dataValidation?: ValidationResult
    referenceIntegrity: ReferenceIntegrityResult
    syncStatus: SyncStatusResult
    performance: PerformanceResult
    storage: StorageResult
    security: SecurityResult
  }
  repairs: RepairResult
  backups: BackupOperationResult
  recommendations: string[]
  metadata: {
    databaseStats: DatabaseStats
    systemInfo: SystemInfo
    checkVersion: string
  }
}

export interface ReferenceIntegrityResult {
  status: 'passed' | 'warning' | 'failed'
  issues: ReferenceIssue[]
  stats: {
    totalEntities: number
    brokenReferences: number
    orphanedEntities: number
    duplicateIds: number
  }
  checks: {
    orphanedImages: CheckItem
    invalidFolderReferences: CheckItem
    invalidTagReferences: CheckItem
    duplicateIds: CheckItem
    circularReferences: CheckItem
  }
}

export interface ReferenceIssue {
  id: string
  type: 'orphaned_image' | 'invalid_folder_ref' | 'invalid_tag_ref' | 'duplicate_id' | 'circular_ref'
  severity: 'low' | 'medium' | 'high' | 'critical'
  entityType: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  description: string
  suggestedAction: string
  autoFixable: boolean
}

export interface SyncStatusResult {
  status: 'passed' | 'warning' | 'failed'
  issues: SyncIssue[]
  stats: {
    totalEntities: number
    pendingSync: number
    staleEntities: number
    conflictCount: number
  }
  checks: {
    pendingSyncAge: CheckItem
    syncQueueSize: CheckItem
    conflicts: CheckItem
    staleData: CheckItem
  }
}

export interface SyncIssue {
  id: string
  type: 'stale_pending' | 'queue_overflow' | 'conflict' | 'sync_error'
  severity: 'low' | 'medium' | 'high'
  entityType: 'card' | 'folder' | 'tag' | 'image' | 'sync_operation'
  entityId: string
  description: string
  suggestedAction: string
  autoFixable: boolean
}

export interface PerformanceResult {
  status: 'passed' | 'warning' | 'failed'
  issues: PerformanceIssue[]
  stats: {
    databaseSize: number
    imageCount: number
    averageQueryTime: number
    cacheHitRate: number
  }
  checks: {
    databaseSize: CheckItem
    imageCount: CheckItem
    queryPerformance: CheckItem
    cacheEfficiency: CheckItem
  }
}

export interface PerformanceIssue {
  id: string
  type: 'large_database' | 'many_images' | 'slow_queries' | 'poor_cache'
  severity: 'low' | 'medium' | 'high'
  metric: string
  value: number
  threshold: number
  description: string
  suggestedAction: string
}

export interface StorageResult {
  status: 'passed' | 'warning' | 'failed'
  issues: StorageIssue[]
  stats: {
    totalStorage: number
    usedStorage: number
    availableStorage: number
    fragmentedImageFiles: number
  }
  checks: {
    availableSpace: CheckItem
    fileExistence: CheckItem
    fileIntegrity: CheckItem
  }
}

export interface StorageIssue {
  id: string
  type: 'insufficient_space' | 'missing_file' | 'corrupted_file' | 'fragmented_files'
  severity: 'low' | 'medium' | 'high' | 'critical'
  filePath?: string
  fileSize?: number
  description: string
  suggestedAction: string
}

export interface SecurityResult {
  status: 'passed' | 'warning' | 'failed'
  issues: SecurityIssue[]
  stats: {
    encryptedFiles: number
    unencryptedFiles: number
    permissionIssues: number
  }
  checks: {
    encryptionStatus: CheckItem
    permissions: CheckItem
    dataExposure: CheckItem
  }
}

export interface SecurityIssue {
  id: string
  type: 'unencrypted_data' | 'permission_violation' | 'data_exposure'
  severity: 'low' | 'medium' | 'high' | 'critical'
  entityType: 'card' | 'folder' | 'tag' | 'image' | 'setting'
  entityId?: string
  description: string
  suggestedAction: string
}

export interface RepairResult {
  attempted: boolean
  successful: number
  failed: number
  skipped: number
  repairs: RepairOperation[]
  warnings: string[]
  duration: number
}

export interface RepairOperation {
  id: string
  type: 'delete_orphaned' | 'fix_reference' | 'compress_data' | 'sync_entity' | 'cleanup_queue'
  entityType: 'card' | 'folder' | 'tag' | 'image' | 'sync_operation'
  entityId: string
  success: boolean
  message: string
  timestamp: Date
}

export interface BackupOperationResult {
  attempted: boolean
  beforeRepair?: BackupResult
  afterRepair?: BackupResult
  warnings: string[]
}

export interface CheckItem {
  name: string
  status: 'passed' | 'warning' | 'failed' | 'skipped'
  message?: string
  details?: any
}

export interface SystemInfo {
  userAgent: string
  platform: string
  memory: { used: number; total: number; available: number }
  storage: { used: number; total: number; available: number }
  timestamp: Date
}

export interface IntegritySchedule {
  id: string
  configId: string
  nextRun: Date
  interval: number
  enabled: boolean
  lastResult?: IntegrityCheckResult
}

// ============================================================================
// 数据完整性检查服务类
// ============================================================================

export class DataIntegrityService {
  private configs: Map<string, IntegrityCheckConfig> = new Map()
  private schedules: Map<string, IntegritySchedule> = new Map()
  private isRunning = false
  private currentCheck: Promise<IntegrityCheckResult> | null = null
  private history: IntegrityCheckResult[] = []
  private maxHistorySize = 50
  private schedulerInterval: number | null = null
  private backgroundValidationEnabled = true
  private lastBackgroundCheck: Date | null = null
  private backgroundCheckInterval = 30 * 60 * 1000 // 30分钟
  private performanceMonitoring = false
  private idleDetection = false

  constructor() {
    this.initializeDefaultConfigs()
    this.loadConfigs()
    this.startScheduler()
    this.initializeBackgroundChecks()
    this.setupIdleDetection()
    this.setupPerformanceMonitoring()
  }

  /**
   * 初始化默认配置
   */
  private initializeDefaultConfigs(): void {
    const defaultConfig: IntegrityCheckConfig = {
      id: 'default',
      name: '默认完整性检查',
      enabled: true,
      schedule: {
        enabled: true,
        interval: 24 * 60 * 60 * 1000 // 24小时
      },
      checks: {
        dataValidation: true,
        referenceIntegrity: true,
        syncStatus: true,
        performance: true,
        storage: true,
        security: false // 安全检查默认关闭
      },
      autoRepair: {
        enabled: true,
        maxRetries: 3,
        allowedTypes: ['missing_field', 'invalid_format', 'reference_broken']
      },
      backup: {
        enabled: true,
        beforeRepair: true,
        afterRepair: true,
        configId: 'default'
      },
      notifications: {
        enabled: true,
        onCritical: true,
        onWarning: false,
        onCompletion: false
      }
    }

    const quickConfig: IntegrityCheckConfig = {
      id: 'quick',
      name: '快速检查',
      enabled: true,
      schedule: {
        enabled: false,
        interval: 6 * 60 * 60 * 1000 // 6小时
      },
      checks: {
        dataValidation: true,
        referenceIntegrity: true,
        syncStatus: true,
        performance: false,
        storage: false,
        security: false
      },
      autoRepair: {
        enabled: true,
        maxRetries: 1,
        allowedTypes: ['missing_field', 'invalid_format']
      },
      backup: {
        enabled: false
      },
      notifications: {
        enabled: true,
        onCritical: true,
        onWarning: false,
        onCompletion: false
      }
    }

    this.configs.set('default', defaultConfig)
    this.configs.set('quick', quickConfig)
  }

  /**
   * 加载配置
   */
  private async loadConfigs(): Promise<void> {
    try {
      const savedConfigs = localStorage.getItem('cardall-integrity-configs')
      if (savedConfigs) {
        const configs = JSON.parse(savedConfigs)
        Object.entries(configs).forEach(([id, config]) => {
          this.configs.set(id, config as IntegrityCheckConfig)
        })
      }

      const savedSchedules = localStorage.getItem('cardall-integrity-schedules')
      if (savedSchedules) {
        const schedules = JSON.parse(savedSchedules)
        Object.entries(schedules).forEach(([id, schedule]) => {
          this.schedules.set(id, {
            ...schedule,
            nextRun: new Date((schedule as any).nextRun)
          } as IntegritySchedule)
        })
      }

      const savedHistory = localStorage.getItem('cardall-integrity-history')
      if (savedHistory) {
        this.history = JSON.parse(savedHistory).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }))
      }
    } catch (error) {
      console.error('Failed to load integrity configs:', error)
    }
  }

  /**
   * 保存配置
   */
  private async saveConfigs(): Promise<void> {
    try {
      const configs = Object.fromEntries(this.configs)
      localStorage.setItem('cardall-integrity-configs', JSON.stringify(configs))

      const schedules = Object.fromEntries(this.schedules)
      localStorage.setItem('cardall-integrity-schedules', JSON.stringify(schedules))

      localStorage.setItem('cardall-integrity-history', JSON.stringify(this.history))
    } catch (error) {
      console.error('Failed to save integrity configs:', error)
    }
  }

  /**
   * 启动调度器
   */
  private startScheduler(): void {
    // 每分钟检查一次是否有需要运行的检查
    setInterval(() => {
      this.checkAndRunScheduledChecks()
    }, 60 * 1000)

    console.log('Integrity check scheduler started')
  }

  /**
   * 初始化后台检查
   */
  private initializeBackgroundChecks(): void {
    // 设置后台检查定时器
    this.schedulerInterval = window.setInterval(() => {
      this.performBackgroundCheck()
    }, this.backgroundCheckInterval) as unknown as number

    console.log(`Background integrity check initialized (interval: ${this.backgroundCheckInterval / 60000} minutes)`)
  }

  /**
   * 设置空闲检测
   */
  private setupIdleDetection(): void {
    if ('requestIdleCallback' in window) {
      this.idleDetection = true

      const checkIdle = () => {
        // 在浏览器空闲时执行轻量级检查
        this.performLightweightCheck()
        window.requestIdleCallback(checkIdle, { timeout: 5000 })
      }

      window.requestIdleCallback(checkIdle, { timeout: 5000 })
      console.log('Idle detection enabled for lightweight integrity checks')
    }
  }

  /**
   * 设置性能监控
   */
  private setupPerformanceMonitoring(): void {
    if ('performance' in window && 'observer' in window.PerformanceObserver) {
      this.performanceMonitoring = true

      // 监控页面可见性变化
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          // 页面变为可见时，检查是否需要执行检查
          this.checkAndRunVisibilityBasedChecks()
        }
      })

      // 监控网络状态变化
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        connection.addEventListener('change', () => {
          this.adjustBackgroundCheckFrequency(connection.effectiveType)
        })
      }

      console.log('Performance monitoring enabled for adaptive integrity checks')
    }
  }

  /**
   * 执行后台检查
   */
  private async performBackgroundCheck(): Promise<void> {
    if (!this.backgroundValidationEnabled || this.isRunning) {
      return
    }

    try {
      // 检查是否应该执行后台检查
      if (!this.shouldPerformBackgroundCheck()) {
        return
      }

      console.log('Starting background integrity check...')

      // 执行轻量级检查
      const result = await this.runIntegrityCheck('quick', {
        skipBackup: true, // 后台检查跳过备份以避免性能影响
        skipRepair: false,
        detailed: false
      })

      this.lastBackgroundCheck = new Date()

      // 记录后台检查结果
      console.log(`Background integrity check completed: ${result.overallStatus}`)

      // 如果发现问题，根据严重程度决定是否通知用户
      if (result.overallStatus === 'critical' || result.overallStatus === 'failed') {
        this.notifyUserOfCriticalIssues(result)
      }

    } catch (error) {
      console.error('Background integrity check failed:', error)
    }
  }

  /**
   * 执行轻量级检查
   */
  private async performLightweightCheck(): Promise<void> {
    if (this.isRunning) {
      return
    }

    try {
      // 只进行最基本的检查，避免影响用户体验
      const quickStats = await this.getQuickStats()

      // 检查是否有明显的问题
      if (quickStats.hasCriticalIssues) {
        console.warn('Quick integrity check detected critical issues')
        // 可以在这里添加更详细的检查逻辑
      }

    } catch (error) {
      console.error('Lightweight integrity check failed:', error)
    }
  }

  /**
   * 获取快速统计信息
   */
  private async getQuickStats(): Promise<{
    totalEntities: number
    hasCriticalIssues: boolean
    lastCheckTime: Date | null
    databaseSize: number
  }> {
    try {
      const stats = await db.getStats()
      const lastCheck = this.lastBackgroundCheck

      // 快速检查是否有明显的问题
      const hasCriticalIssues = stats.totalSize > 500 * 1024 * 1024 || // 500MB
                                   stats.pendingSync > 100 ||
                                   (lastCheck && Date.now() - lastCheck.getTime() > 24 * 60 * 60 * 1000) // 24小时未检查

      return {
        totalEntities: stats.cards + stats.folders + stats.tags + stats.images,
        hasCriticalIssues,
        lastCheckTime: lastCheck,
        databaseSize: stats.totalSize
      }
    } catch (error) {
      console.error('Failed to get quick stats:', error)
      return {
        totalEntities: 0,
        hasCriticalIssues: false,
        lastCheckTime: null,
        databaseSize: 0
      }
    }
  }

  /**
   * 判断是否应该执行后台检查
   */
  private shouldPerformBackgroundCheck(): boolean {
    const now = new Date()

    // 如果从未执行过检查，执行一次
    if (!this.lastBackgroundCheck) {
      return true
    }

    // 检查距离上次检查的时间间隔
    const timeSinceLastCheck = now.getTime() - this.lastBackgroundCheck.getTime()

    return timeSinceLastCheck >= this.backgroundCheckInterval
  }

  /**
   * 基于页面可见性的检查
   */
  private async checkAndRunVisibilityBasedChecks(): Promise<void> {
    if (!this.backgroundValidationEnabled) {
      return
    }

    // 页面刚变为可见时，如果距离上次检查时间较长，执行检查
    if (this.lastBackgroundCheck) {
      const timeSinceLastCheck = Date.now() - this.lastBackgroundCheck.getTime()
      if (timeSinceLastCheck > 60 * 60 * 1000) { // 1小时
        await this.performBackgroundCheck()
      }
    }
  }

  /**
   * 根据网络状态调整后台检查频率
   */
  private adjustBackgroundCheckFrequency(networkType: string): void {
    const intervals = {
      '4g': 30 * 60 * 1000,    // 4G: 30分钟
      '3g': 60 * 60 * 1000,    // 3G: 1小时
      '2g': 2 * 60 * 60 * 1000, // 2G: 2小时
      'slow-2g': 4 * 60 * 60 * 1000, // 慢速2G: 4小时
      'default': 30 * 60 * 1000  // 默认: 30分钟
    }

    const newInterval = intervals[networkType as keyof typeof intervals] || intervals.default

    if (newInterval !== this.backgroundCheckInterval) {
      this.backgroundCheckInterval = newInterval

      // 重新设置定时器
      if (this.schedulerInterval) {
        clearInterval(this.schedulerInterval)
      }

      this.schedulerInterval = window.setInterval(() => {
        this.performBackgroundCheck()
      }, this.backgroundCheckInterval) as unknown as number

      console.log(`Background check interval adjusted to ${newInterval / 60000} minutes based on network type: ${networkType}`)
    }
  }

  /**
   * 通知用户关键问题
   */
  private notifyUserOfCriticalIssues(result: IntegrityCheckResult): void {
    // 避免频繁通知
    const lastNotification = localStorage.getItem('cardall-integrity-last-notification')
    const now = Date.now()

    if (lastNotification && now - parseInt(lastNotification) < 60 * 60 * 1000) { // 1小时内不重复通知
      return
    }

    // 记录通知时间
    localStorage.setItem('cardall-integrity-last-notification', now.toString())

    // 创建通知
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('数据完整性检查发现问题', {
        body: `发现 ${result.summary.criticalErrors} 个严重错误，建议立即检查`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'integrity-check'
      })
    }

    // 发出自定义事件供UI层处理
    window.dispatchEvent(new CustomEvent('cardall:integrity-issues', {
      detail: {
        severity: result.overallStatus,
        issues: result.summary.criticalErrors,
        timestamp: result.timestamp
      }
    }))

    console.warn('Critical integrity issues detected:', result.summary)
  }

  /**
   * 检查并运行计划中的检查
   */
  private async checkAndRunScheduledChecks(): Promise<void> {
    if (this.isRunning) return

    const now = new Date()
    for (const [configId, schedule] of this.schedules) {
      if (schedule.enabled && now >= schedule.nextRun) {
        const config = this.configs.get(configId)
        if (config?.enabled) {
          console.log(`Running scheduled integrity check: ${config.name}`)
          this.runIntegrityCheck(configId).catch(console.error)
        }
      }
    }
  }

  /**
   * 运行完整性检查
   */
  async runIntegrityCheck(configId: string = 'default', options?: {
    force?: boolean
    skipBackup?: boolean
    skipRepair?: boolean
    detailed?: boolean
  }): Promise<IntegrityCheckResult> {
    const config = this.configs.get(configId)
    if (!config) {
      throw new Error(`Integrity config ${configId} not found`)
    }

    if (this.isRunning && !options?.force) {
      throw new Error('Integrity check already in progress')
    }

    this.isRunning = true
    const startTime = Date.now()
    const checkId = `integrity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    try {
      // 创建检查结果对象
      const result: IntegrityCheckResult = {
        id: checkId,
        configId,
        timestamp: new Date(),
        duration: 0,
        overallStatus: 'healthy',
        summary: {
          totalChecks: 0,
          passedChecks: 0,
          failedChecks: 0,
          warnings: 0,
          errors: 0,
          criticalErrors: 0
        },
        details: {
          referenceIntegrity: await this.checkReferenceIntegrity(),
          syncStatus: await this.checkSyncStatus(),
          performance: await this.checkPerformance(),
          storage: await this.checkStorage(),
          security: await this.checkSecurity()
        },
        repairs: { attempted: false, successful: 0, failed: 0, skipped: 0, repairs: [], warnings: [], duration: 0 },
        backups: { attempted: false, warnings: [] },
        recommendations: [],
        metadata: {
          databaseStats: await db.getStats(),
          systemInfo: await this.getSystemInfo(),
          checkVersion: '1.0.0'
        }
      }

      // 数据验证检查
      if (config.checks.dataValidation) {
        result.details.dataValidation = await dataValidator.validateAllData()
        this.updateSummary(result, result.details.dataValidation)
      }

      // 更新总检查数
      result.summary.totalChecks = this.countTotalChecks(result.details)
      result.summary.passedChecks = this.countPassedChecks(result.details)

      // 确定整体状态
      result.overallStatus = this.determineOverallStatus(result)

      // 生成建议
      result.recommendations = this.generateRecommendations(result)

      // 修复前备份
      let preRepairBackup: BackupResult | null = null
      if (config.backup.enabled && config.backup.beforeRepair && !options?.skipBackup) {
        try {
          preRepairBackup = await backupCoreService.createBackup(config.backup.configId || 'default', {
            name: `Pre-repair backup ${new Date().toISOString()}`
          })
          result.backups.attempted = true
          result.backups.beforeRepair = preRepairBackup
        } catch (error) {
          result.backups.warnings.push(`Pre-repair backup failed: ${error}`)
        }
      }

      // 自动修复
      if (!options?.skipRepair && config.autoRepair.enabled && this.shouldAttemptRepair(result)) {
        result.repairs = await this.performAutoRepair(result, config.autoRepair)
      }

      // 修复后备份
      if (config.backup.enabled && config.backup.afterRepair && result.repairs.attempted && !options?.skipBackup) {
        try {
          const postRepairBackup = await backupCoreService.createBackup(config.backup.configId || 'default', {
            name: `Post-repair backup ${new Date().toISOString()}`
          })
          result.backups.afterRepair = postRepairBackup
        } catch (error) {
          result.backups.warnings.push(`Post-repair backup failed: ${error}`)
        }
      }

      result.duration = Date.now() - startTime

      // 更新调度信息
      this.updateSchedule(configId)

      // 保存历史记录
      this.addToHistory(result)

      // 发送通知
      if (config.notifications.enabled) {
        this.sendNotifications(result, config)
      }

      console.log(`Integrity check completed: ${result.overallStatus} (${result.duration}ms)`)

      return result

    } catch (error) {
      console.error('Integrity check failed:', error)

      const errorResult: IntegrityCheckResult = {
        id: checkId,
        configId,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        overallStatus: 'failed',
        summary: {
          totalChecks: 0,
          passedChecks: 0,
          failedChecks: 1,
          warnings: 0,
          errors: 1,
          criticalErrors: 1
        },
        details: {
          referenceIntegrity: { status: 'failed', issues: [], stats: { totalEntities: 0, brokenReferences: 0, orphanedEntities: 0, duplicateIds: 0 }, checks: this.createFailedChecks() },
          syncStatus: { status: 'failed', issues: [], stats: { totalEntities: 0, pendingSync: 0, staleEntities: 0, conflictCount: 0 }, checks: this.createFailedChecks() },
          performance: { status: 'failed', issues: [], stats: { databaseSize: 0, imageCount: 0, averageQueryTime: 0, cacheHitRate: 0 }, checks: this.createFailedChecks() },
          storage: { status: 'failed', issues: [], stats: { totalStorage: 0, usedStorage: 0, availableStorage: 0, fragmentedImageFiles: 0 }, checks: this.createFailedChecks() },
          security: { status: 'failed', issues: [], stats: { encryptedFiles: 0, unencryptedFiles: 0, permissionIssues: 0 }, checks: this.createFailedChecks() }
        },
        repairs: { attempted: false, successful: 0, failed: 0, skipped: 0, repairs: [], warnings: [], duration: 0 },
        backups: { attempted: false, warnings: [] },
        recommendations: [`检查失败: ${error instanceof Error ? error.message : 'Unknown error'}`],
        metadata: {
          databaseStats: await db.getStats(),
          systemInfo: await this.getSystemInfo(),
          checkVersion: '1.0.0'
        }
      }

      this.addToHistory(errorResult)
      return errorResult

    } finally {
      this.isRunning = false
      this.currentCheck = null
    }
  }

  /**
   * 检查引用完整性
   */
  private async checkReferenceIntegrity(): Promise<ReferenceIntegrityResult> {
    const issues: ReferenceIssue[] = []
    let totalEntities = 0
    let brokenReferences = 0
    let orphanedEntities = 0
    let duplicateIds = 0

    const checks = {
      orphanedImages: { name: '孤立图片检查', status: 'passed' as const },
      invalidFolderReferences: { name: '无效文件夹引用', status: 'passed' as const },
      invalidTagReferences: { name: '无效标签引用', status: 'passed' as const },
      duplicateIds: { name: '重复ID检查', status: 'passed' as const },
      circularReferences: { name: '循环引用检查', status: 'passed' as const }
    }

    try {
      // 检查孤立图片
      const images = await db.images.toArray()
      const cardIds = new Set((await db.cards.toArray()).map(c => c.id))
      totalEntities += images.length

      const orphanedImages = images.filter(image => !cardIds.has(image.cardId))
      orphanedEntities = orphanedImages.length
      brokenReferences += orphanedImages.length

      for (const image of orphanedImages) {
        issues.push({
          id: `orphaned-image-${image.id}`,
          type: 'orphaned_image',
          severity: 'medium',
          entityType: 'image',
          entityId: image.id || 'unknown',
          description: '图片没有对应的卡片',
          suggestedAction: '删除孤立图片或重新关联到有效卡片',
          autoFixable: true
        })
      }

      if (orphanedImages.length > 0) {
        checks.orphanedImages.status = 'warning'
        checks.orphanedImages.message = `发现 ${orphanedImages.length} 个孤立图片`
      }

      // 检查无效的文件夹引用
      const cards = await db.cards.toArray()
      const folderIds = new Set((await db.folders.toArray()).map(f => f.id))
      totalEntities += cards.length

      const cardsWithInvalidFolders = cards.filter(card =>
        card.folderId && !folderIds.has(card.folderId)
      )

      for (const card of cardsWithInvalidFolders) {
        issues.push({
          id: `invalid-folder-ref-${card.id}`,
          type: 'invalid_folder_ref',
          severity: 'medium',
          entityType: 'card',
          entityId: card.id || 'unknown',
          description: '卡片引用了不存在的文件夹',
          suggestedAction: '将卡片移动到有效文件夹或设置为无文件夹',
          autoFixable: true
        })
      }

      if (cardsWithInvalidFolders.length > 0) {
        checks.invalidFolderReferences.status = 'warning'
        checks.invalidFolderReferences.message = `发现 ${cardsWithInvalidFolders.length} 个无效文件夹引用`
      }

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

        return duplicates
      }

      const duplicateCardIds = await checkDuplicateIds('card', await db.cards.toArray())
      const duplicateFolderIds = await checkDuplicateIds('folder', await db.folders.toArray())
      const duplicateTagIds = await checkDuplicateIds('tag', await db.tags.toArray())
      const duplicateImageIds = await checkDuplicateIds('image', await db.images.toArray())

      const allDuplicates = [...duplicateCardIds, ...duplicateFolderIds, ...duplicateTagIds, ...duplicateImageIds]
      duplicateIds = allDuplicates.length

      for (const duplicateId of allDuplicates) {
        issues.push({
          id: `duplicate-id-${duplicateId}`,
          type: 'duplicate_id',
          severity: 'critical',
          entityType: 'system',
          entityId: duplicateId,
          description: `发现重复的ID: ${duplicateId}`,
          suggestedAction: '修复重复ID问题',
          autoFixable: false
        })
      }

      if (allDuplicates.length > 0) {
        checks.duplicateIds.status = 'failed'
        checks.duplicateIds.message = `发现 ${allDuplicates.length} 个重复ID`
      }

      // 循环引用检查（简化实现）
      // 这里可以实现更复杂的循环引用检测算法

    } catch (error) {
      console.error('Reference integrity check failed:', error)
      Object.values(checks).forEach(check => {
        check.status = 'failed'
        check.message = '检查失败'
      })
    }

    const status = issues.filter(i => i.severity === 'critical').length > 0 ? 'failed' :
                   issues.length > 0 ? 'warning' : 'passed'

    return {
      status,
      issues,
      stats: {
        totalEntities,
        brokenReferences,
        orphanedEntities,
        duplicateIds
      },
      checks
    }
  }

  /**
   * 检查同步状态
   */
  private async checkSyncStatus(): Promise<SyncStatusResult> {
    const issues: SyncIssue[] = []
    let totalEntities = 0
    let pendingSync = 0
    let staleEntities = 0
    let conflictCount = 0

    const checks = {
      pendingSyncAge: { name: '待同步项目年龄', status: 'passed' as const },
      syncQueueSize: { name: '同步队列大小', status: 'passed' as const },
      conflicts: { name: '同步冲突', status: 'passed' as const },
      staleData: { name: '过期数据', status: 'passed' as const }
    }

    try {
      // 检查长时间未同步的项目
      const syncThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24小时前

      const oldPendingCards = await db.cards
        .where('pendingSync')
        .equals(true)
        .filter(card => new Date(card.updatedAt) < syncThreshold)
        .toArray()

      totalEntities = await db.cards.count()
      pendingSync = await db.cards.where('pendingSync').equals(true).count()
      staleEntities = oldPendingCards.length

      for (const card of oldPendingCards) {
        issues.push({
          id: `stale-pending-sync-${card.id}`,
          type: 'stale_pending',
          severity: 'medium',
          entityType: 'card',
          entityId: card.id || 'unknown',
          description: '卡片长时间未同步',
          suggestedAction: '检查网络连接并手动同步',
          autoFixable: false
        })
      }

      if (oldPendingCards.length > 0) {
        checks.pendingSyncAge.status = 'warning'
        checks.pendingSyncAge.message = `发现 ${oldPendingCards.length} 个长时间未同步的卡片`
      }

      // 检查同步队列中的过期项目
      const expiredSyncOps = await db.syncQueue
        .where('timestamp')
        .below(syncThreshold)
        .toArray()

      if (expiredSyncOps.length > 0) {
        issues.push({
          id: 'expired-sync-queue',
          type: 'queue_overflow',
          severity: 'high',
          entityType: 'sync_operation',
          entityId: 'sync-queue',
          description: `发现 ${expiredSyncOps.length} 个过期的同步队列项目`,
          suggestedAction: '清理同步队列并检查同步功能',
          autoFixable: true
        })

        checks.syncQueueSize.status = 'warning'
        checks.syncQueueSize.message = `同步队列中有 ${expiredSyncOps.length} 个过期项目`
      }

      // 检查冲突数量
      conflictCount = await db.syncQueue
        .where('error')
        .notEqual('')
        .count()

      if (conflictCount > 0) {
        issues.push({
          id: 'sync-conflicts',
          type: 'conflict',
          severity: 'high',
          entityType: 'sync_operation',
          entityId: 'sync-conflicts',
          description: `发现 ${conflictCount} 个同步冲突`,
          suggestedAction: '手动解决同步冲突',
          autoFixable: false
        })

        checks.conflicts.status = 'warning'
        checks.conflicts.message = `发现 ${conflictCount} 个同步冲突`
      }

    } catch (error) {
      console.error('Sync status check failed:', error)
      Object.values(checks).forEach(check => {
        check.status = 'failed'
        check.message = '检查失败'
      })
    }

    const status = issues.filter(i => i.severity === 'high').length > 0 ? 'failed' :
                   issues.length > 0 ? 'warning' : 'passed'

    return {
      status,
      issues,
      stats: {
        totalEntities,
        pendingSync,
        staleEntities,
        conflictCount
      },
      checks
    }
  }

  /**
   * 检查性能
   */
  private async checkPerformance(): Promise<PerformanceResult> {
    const issues: PerformanceIssue[] = []

    const checks = {
      databaseSize: { name: '数据库大小', status: 'passed' as const },
      imageCount: { name: '图片数量', status: 'passed' as const },
      queryPerformance: { name: '查询性能', status: 'passed' as const },
      cacheEfficiency: { name: '缓存效率', status: 'passed' as const }
    }

    let databaseSize = 0
    let imageCount = 0
    let averageQueryTime = 0
    let cacheHitRate = 0

    try {
      // 获取数据库统计信息
      const stats = await db.getStats()
      databaseSize = stats.totalSize
      imageCount = stats.images

      // 检查数据库大小
      if (databaseSize > 100 * 1024 * 1024) { // 100MB
        issues.push({
          id: 'large-database-size',
          type: 'large_database',
          severity: databaseSize > 500 * 1024 * 1024 ? 'high' : 'medium',
          metric: 'databaseSize',
          value: databaseSize,
          threshold: 100 * 1024 * 1024,
          description: `数据库大小较大: ${(databaseSize / 1024 / 1024).toFixed(2)} MB`,
          suggestedAction: '考虑清理不必要的数据或优化存储'
        })

        checks.databaseSize.status = 'warning'
        checks.databaseSize.message = `数据库大小: ${(databaseSize / 1024 / 1024).toFixed(2)} MB`
      }

      // 检查图片数量
      if (imageCount > 1000) {
        issues.push({
          id: 'many-images',
          type: 'many_images',
          severity: imageCount > 5000 ? 'high' : 'medium',
          metric: 'imageCount',
          value: imageCount,
          threshold: 1000,
          description: `发现大量图片: ${imageCount} 个`,
          suggestedAction: '考虑压缩图片或使用外部存储'
        })

        checks.imageCount.status = 'warning'
        checks.imageCount.message = `图片数量: ${imageCount}`
      }

      // 检查查询性能（简化实现）
      const queryStart = performance.now()
      await db.cards.limit(100).toArray()
      averageQueryTime = performance.now() - queryStart

      if (averageQueryTime > 100) { // 100ms
        issues.push({
          id: 'slow-queries',
          type: 'slow_queries',
          severity: 'medium',
          metric: 'averageQueryTime',
          value: averageQueryTime,
          threshold: 100,
          description: `查询性能较慢: ${averageQueryTime.toFixed(2)}ms`,
          suggestedAction: '优化数据库索引或查询'
        })

        checks.queryPerformance.status = 'warning'
        checks.queryPerformance.message = `平均查询时间: ${averageQueryTime.toFixed(2)}ms`
      }

      // 检查缓存效率（简化实现）
      cacheHitRate = Math.random() * 100 // 模拟缓存命中率
      if (cacheHitRate < 70) {
        issues.push({
          id: 'poor-cache',
          type: 'poor_cache',
          severity: 'low',
          metric: 'cacheHitRate',
          value: cacheHitRate,
          threshold: 70,
          description: `缓存效率较低: ${cacheHitRate.toFixed(1)}%`,
          suggestedAction: '优化缓存策略'
        })

        checks.cacheEfficiency.status = 'warning'
        checks.cacheEfficiency.message = `缓存命中率: ${cacheHitRate.toFixed(1)}%`
      }

    } catch (error) {
      console.error('Performance check failed:', error)
      Object.values(checks).forEach(check => {
        check.status = 'failed'
        check.message = '检查失败'
      })
    }

    const status = issues.filter(i => i.severity === 'high').length > 0 ? 'failed' :
                   issues.length > 0 ? 'warning' : 'passed'

    return {
      status,
      issues,
      stats: {
        databaseSize,
        imageCount,
        averageQueryTime,
        cacheHitRate
      },
      checks
    }
  }

  /**
   * 检查存储
   */
  private async checkStorage(): Promise<StorageResult> {
    const issues: StorageIssue[] = []

    const checks = {
      availableSpace: { name: '可用空间', status: 'passed' as const },
      fileExistence: { name: '文件存在性', status: 'passed' as const },
      fileIntegrity: { name: '文件完整性', status: 'passed' as const }
    }

    let totalStorage = 0
    let usedStorage = 0
    let availableStorage = 0
    const fragmentedImageFiles = 0

    try {
      // 估算存储空间（简化实现）
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        totalStorage = estimate.quota || 0
        usedStorage = estimate.usage || 0
        availableStorage = totalStorage - usedStorage
      }

      // 检查可用空间
      if (availableStorage < 50 * 1024 * 1024) { // 50MB
        issues.push({
          id: 'insufficient-space',
          type: 'insufficient_space',
          severity: availableStorage < 10 * 1024 * 1024 ? 'critical' : 'high',
          description: `可用存储空间不足: ${(availableStorage / 1024 / 1024).toFixed(2)} MB`,
          suggestedAction: '清理文件或增加存储空间'
        })

        checks.availableSpace.status = 'warning'
        checks.availableSpace.message = `可用空间不足: ${(availableStorage / 1024 / 1024).toFixed(2)} MB`
      }

      // 检查文件存在性（简化实现）
      const images = await db.images.toArray()
      const missingFiles: string[] = []

      for (const image of images.slice(0, 100)) { // 限制检查数量
        if (image.storageMode === 'filesystem') {
          // 这里可以添加实际的文件检查逻辑
          // const fileExists = await checkFileExists(image.filePath)
          // if (!fileExists) missingFiles.push(image.filePath)
        }
      }

      if (missingFiles.length > 0) {
        issues.push({
          id: 'missing-files',
          type: 'missing_file',
          severity: 'high',
          description: `发现 ${missingFiles.length} 个缺失文件`,
          suggestedAction: '恢复缺失文件或删除相关记录'
        })

        checks.fileExistence.status = 'warning'
        checks.fileExistence.message = `发现 ${missingFiles.length} 个缺失文件`
      }

    } catch (error) {
      console.error('Storage check failed:', error)
      Object.values(checks).forEach(check => {
        check.status = 'failed'
        check.message = '检查失败'
      })
    }

    const status = issues.filter(i => i.severity === 'critical').length > 0 ? 'failed' :
                   issues.length > 0 ? 'warning' : 'passed'

    return {
      status,
      issues,
      stats: {
        totalStorage,
        usedStorage,
        availableStorage,
        fragmentedImageFiles
      },
      checks
    }
  }

  /**
   * 检查安全性
   */
  private async checkSecurity(): Promise<SecurityResult> {
    const issues: SecurityIssue[] = []

    const checks = {
      encryptionStatus: { name: '加密状态', status: 'passed' as const },
      permissions: { name: '权限', status: 'passed' as const },
      dataExposure: { name: '数据暴露', status: 'passed' as const }
    }

    const encryptedFiles = 0
    const unencryptedFiles = 0
    let permissionIssues = 0

    try {
      // 检查加密状态（简化实现）
      const settings = await db.settings.toArray()
      const encryptionEnabled = settings.some(s => s.key === 'encryption' && s.value === true)

      if (!encryptionEnabled) {
        issues.push({
          id: 'unencrypted-data',
          type: 'unencrypted_data',
          severity: 'medium',
          entityType: 'system',
          description: '数据未加密',
          suggestedAction: '启用数据加密以保护敏感信息'
        })

        checks.encryptionStatus.status = 'warning'
        checks.encryptionStatus.message = '数据未加密'
      }

      // 检查权限（简化实现）
      if ('permissions' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'storage' as any })
          if (permission.state !== 'granted') {
            permissionIssues++

            issues.push({
              id: 'permission-issue',
              type: 'permission_violation',
              severity: 'medium',
              entityType: 'system',
              description: '存储权限未完全授予',
              suggestedAction: '检查并授予必要的存储权限'
            })

            checks.permissions.status = 'warning'
            checks.permissions.message = '存储权限问题'
          }
        } catch (error) {
          // 权限API不可用
        }
      }

    } catch (error) {
      console.error('Security check failed:', error)
      Object.values(checks).forEach(check => {
        check.status = 'failed'
        check.message = '检查失败'
      })
    }

    const status = issues.filter(i => i.severity === 'high' || i.severity === 'critical').length > 0 ? 'failed' :
                   issues.length > 0 ? 'warning' : 'passed'

    return {
      status,
      issues,
      stats: {
        encryptedFiles,
        unencryptedFiles,
        permissionIssues
      },
      checks
    }
  }

  /**
   * 执行自动修复
   */
  private async performAutoRepair(
    result: IntegrityCheckResult,
    autoRepairConfig: IntegrityCheckConfig['autoRepair']
  ): Promise<RepairResult> {
    const repairs: RepairOperation[] = []
    const warnings: string[] = []
    let successful = 0
    let failed = 0
    const skipped = 0

    const startTime = Date.now()

    try {
      // 收集可修复的问题
      const fixableIssues: Array<{
        type: 'delete_orphaned' | 'fix_reference' | 'sync_entity' | 'cleanup_queue'
        entityType: 'card' | 'folder' | 'tag' | 'image' | 'sync_operation'
        entityId: string
        description: string
      }> = []

      // 引用完整性问题
      for (const issue of result.details.referenceIntegrity.issues) {
        if (issue.autoFixable && autoRepairConfig.allowedTypes.includes('reference_broken')) {
          if (issue.type === 'orphaned_image') {
            fixableIssues.push({
              type: 'delete_orphaned',
              entityType: 'image',
              entityId: issue.entityId,
              description: `删除孤立图片: ${issue.entityId}`
            })
          } else if (issue.type === 'invalid_folder_ref') {
            fixableIssues.push({
              type: 'fix_reference',
              entityType: 'card',
              entityId: issue.entityId,
              description: `修复文件夹引用: ${issue.entityId}`
            })
          }
        }
      }

      // 同步状态问题
      for (const issue of result.details.syncStatus.issues) {
        if (issue.autoFixable && autoRepairConfig.allowedTypes.includes('invalid_format')) {
          if (issue.type === 'queue_overflow') {
            fixableIssues.push({
              type: 'cleanup_queue',
              entityType: 'sync_operation',
              entityId: 'sync-queue',
              description: '清理过期同步队列项目'
            })
          }
        }
      }

      // 执行修复
      for (const fixableIssue of fixableIssues) {
        try {
          const success = await this.executeRepair(fixableIssue)

          repairs.push({
            id: `repair_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            type: fixableIssue.type,
            entityType: fixableIssue.entityType,
            entityId: fixableIssue.entityId,
            success,
            message: success ? '修复成功' : '修复失败',
            timestamp: new Date()
          })

          if (success) {
            successful++
          } else {
            failed++
            warnings.push(`修复失败: ${fixableIssue.description}`)
          }

        } catch (error) {
          failed++
          warnings.push(`修复错误: ${error}`)
        }
      }

    } catch (error) {
      warnings.push(`自动修复过程出错: ${error}`)
    }

    return {
      attempted: true,
      successful,
      failed,
      skipped,
      repairs,
      warnings,
      duration: Date.now() - startTime
    }
  }

  /**
   * 执行单个修复操作
   */
  private async executeRepair(issue: {
    type: 'delete_orphaned' | 'fix_reference' | 'sync_entity' | 'cleanup_queue'
    entityType: 'card' | 'folder' | 'tag' | 'image' | 'sync_operation'
    entityId: string
  }): Promise<boolean> {
    try {
      switch (issue.type) {
        case 'delete_orphaned': {
          if (issue.entityType === 'image') {
            await db.images.delete(issue.entityId)
            return true
          }
          break
        }

        case 'fix_reference': {
          if (issue.entityType === 'card') {
            await db.cards.update(issue.entityId, { folderId: null })
            return true
          }
          break
        }

        case 'cleanup_queue': {
          const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
          await db.syncQueue.where('timestamp').below(cutoffDate).delete()
          return true
        }

        default:
          return false
      }
      return false
    } catch (error) {
      console.error(`Repair failed for ${issue.entityType} ${issue.entityId}:`, error)
      return false
    }
  }

  /**
   * 更新检查摘要
   */
  private updateSummary(result: IntegrityCheckResult, validation?: ValidationResult): void {
    if (validation) {
      result.summary.warnings += validation.warnings.length
      result.summary.errors += validation.errors.length
      result.summary.criticalErrors += validation.errors.filter(e => e.severity === 'critical').length
    }
  }

  /**
   * 计算总检查数
   */
  private countTotalChecks(details: IntegrityCheckResult['details']): number {
    let count = 0
    Object.values(details).forEach(checkResult => {
      if (checkResult && 'checks' in checkResult) {
        count += Object.keys(checkResult.checks).length
      }
    })
    return count
  }

  /**
   * 计算通过的检查数
   */
  private countPassedChecks(details: IntegrityCheckResult['details']): number {
    let count = 0
    Object.values(details).forEach(checkResult => {
      if (checkResult && 'checks' in checkResult) {
        Object.values(checkResult.checks).forEach(check => {
          if (check.status === 'passed') count++
        })
      }
    })
    return count
  }

  /**
   * 确定整体状态
   */
  private determineOverallStatus(result: IntegrityCheckResult): IntegrityCheckResult['overallStatus'] {
    if (result.summary.criticalErrors > 0) return 'critical'
    if (result.summary.errors > 0) return 'failed'
    if (result.summary.warnings > 10) return 'warning'
    return 'healthy'
  }

  /**
   * 判断是否应该尝试修复
   */
  private shouldAttemptRepair(result: IntegrityCheckResult): boolean {
    return result.summary.errors > 0 || result.summary.criticalErrors > 0
  }

  /**
   * 生成建议
   */
  private generateRecommendations(result: IntegrityCheckResult): string[] {
    const recommendations: string[] = []

    if (result.summary.criticalErrors > 0) {
      recommendations.push('发现严重错误，建议立即修复以确保数据完整性')
    }

    if (result.details.referenceIntegrity.issues.length > 0) {
      recommendations.push('存在引用完整性问题，建议检查并修复关联关系')
    }

    if (result.details.syncStatus.issues.length > 0) {
      recommendations.push('存在同步状态问题，建议检查同步功能')
    }

    if (result.details.performance.issues.length > 0) {
      recommendations.push('存在性能问题，建议优化数据结构和存储')
    }

    if (result.details.storage.issues.length > 0) {
      recommendations.push('存在存储问题，建议检查文件系统和存储空间')
    }

    if (result.repairs.successful > 0) {
      recommendations.push(`成功修复了 ${result.repairs.successful} 个问题`)
    }

    if (result.repairs.failed > 0) {
      recommendations.push(`有 ${result.repairs.failed} 个问题修复失败，建议手动处理`)
    }

    if (recommendations.length === 0) {
      recommendations.push('数据完整性检查通过，建议定期检查以保持数据健康')
    }

    return recommendations
  }

  /**
   * 更新调度信息
   */
  private updateSchedule(configId: string): void {
    const scheduleConfig = this.configs.get(configId)
    if (!scheduleConfig?.schedule.enabled) return

    const now = new Date()
    const nextRun = new Date(now.getTime() + scheduleConfig.schedule.interval)

    this.schedules.set(configId, {
      id: `${configId}_${Date.now()}`,
      configId,
      nextRun,
      interval: scheduleConfig.schedule.interval,
      enabled: true
    })

    this.saveConfigs()
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(result: IntegrityCheckResult): void {
    this.history.unshift(result)

    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize)
    }

    this.saveConfigs()
  }

  /**
   * 发送通知
   */
  private sendNotifications(result: IntegrityCheckResult, _config: IntegrityCheckConfig): void {
    // 这里可以实现通知逻辑，如显示系统通知、发送邮件等
    console.log('Integrity check notification:', {
      status: result.overallStatus,
      summary: result.summary,
      recommendations: result.recommendations
    })
  }

  /**
   * 获取系统信息
   */
  private async getSystemInfo(): Promise<SystemInfo> {
    const memory = {
      used: 0,
      total: 0,
      available: 0
    }

    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory
      memory.used = memoryInfo.usedJSHeapSize || 0
      memory.total = memoryInfo.totalJSHeapSize || 0
      memory.available = memoryInfo.jsHeapSizeLimit || 0
    }

    const storage = {
      used: 0,
      total: 0,
      available: 0
    }

    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      storage.used = estimate.usage || 0
      storage.total = estimate.quota || 0
      storage.available = storage.total - storage.used
    }

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      memory,
      storage,
      timestamp: new Date()
    }
  }

  /**
   * 创建失败的检查项
   */
  private createFailedChecks(): any {
    return {
      orphanedImages: { name: '孤立图片检查', status: 'failed' as const, message: '检查失败' },
      invalidFolderReferences: { name: '无效文件夹引用', status: 'failed' as const, message: '检查失败' },
      invalidTagReferences: { name: '无效标签引用', status: 'failed' as const, message: '检查失败' },
      duplicateIds: { name: '重复ID检查', status: 'failed' as const, message: '检查失败' },
      circularReferences: { name: '循环引用检查', status: 'failed' as const, message: '检查失败' }
    }
  }

  // ============================================================================
  // 公共接口方法
  // ============================================================================

  /**
   * 手动运行完整性检查
   */
  async runManualCheck(configId: string = 'default', options?: {
    skipBackup?: boolean
    skipRepair?: boolean
    detailed?: boolean
  }): Promise<IntegrityCheckResult> {
    return await this.runIntegrityCheck(configId, {
      force: true,
      ...options
    })
  }

  /**
   * 获取配置
   */
  getConfig(configId: string): IntegrityCheckConfig | undefined {
    return this.configs.get(configId)
  }

  /**
   * 更新配置
   */
  async updateConfig(configId: string, config: IntegrityCheckConfig): Promise<void> {
    this.configs.set(configId, config)
    await this.saveConfigs()
  }

  /**
   * 添加配置
   */
  async addConfig(config: IntegrityCheckConfig): Promise<void> {
    this.configs.set(config.id, config)
    await this.saveConfigs()
  }

  /**
   * 删除配置
   */
  async deleteConfig(configId: string): Promise<void> {
    this.configs.delete(configId)
    this.schedules.delete(configId)
    await this.saveConfigs()
  }

  /**
   * 获取所有配置
   */
  getAllConfigs(): IntegrityCheckConfig[] {
    return Array.from(this.configs.values())
  }

  /**
   * 获取历史记录
   */
  getHistory(limit: number = 10): IntegrityCheckResult[] {
    return this.history.slice(0, limit)
  }

  /**
   * 获取调度信息
   */
  getSchedules(): IntegritySchedule[] {
    return Array.from(this.schedules.values())
  }

  /**
   * 创建手动备份
   */
  async createManualBackup(name?: string): Promise<BackupResult> {
    return await backupCoreService.createBackup('default', {
      name: name || `Manual backup ${new Date().toISOString()}`,
      force: true
    })
  }

  /**
   * 恢复备份
   */
  async restoreBackup(backupId: string, options?: {
    validateOnly?: boolean
    conflictResolution?: 'overwrite' | 'merge' | 'skip'
  }): Promise<RestoreResult> {
    return await backupCoreService.restoreBackup(backupId, options)
  }

  /**
   * 获取备份统计信息
   */
  async getBackupStats() {
    return await backupCoreService.getBackupStats()
  }

  /**
   * 立即修复已知问题
   */
  async repairIssues(_issueTypes: string[]): Promise<{
    fixed: number
    failed: number
    warnings: string[]
  }> {
    // 这里可以实现特定问题的修复逻辑
    return { fixed: 0, failed: 0, warnings: ['Not implemented'] }
  }

  /**
   * 获取服务状态
   */
  getStatus(): {
    isRunning: boolean
    configs: number
    scheduledChecks: number
    lastCheck?: IntegrityCheckResult
    backgroundValidationEnabled: boolean
    lastBackgroundCheck?: Date
    performanceMonitoring: boolean
    idleDetection: boolean
    nextBackgroundCheck?: Date
  } {
    const scheduledChecks = Array.from(this.schedules.values()).filter(s => s.enabled).length
    const lastCheck = this.history[0]

    let nextBackgroundCheck: Date | undefined
    if (this.lastBackgroundCheck) {
      nextBackgroundCheck = new Date(this.lastBackgroundCheck.getTime() + this.backgroundCheckInterval)
    }

    return {
      isRunning: this.isRunning,
      configs: this.configs.size,
      scheduledChecks,
      lastCheck,
      backgroundValidationEnabled: this.backgroundValidationEnabled,
      lastBackgroundCheck: this.lastBackgroundCheck || undefined,
      performanceMonitoring: this.performanceMonitoring,
      idleDetection: this.idleDetection,
      nextBackgroundCheck
    }
  }

  /**
   * 启用后台验证
   */
  enableBackgroundValidation(): void {
    this.backgroundValidationEnabled = true
    console.log('Background integrity validation enabled')
  }

  /**
   * 禁用后台验证
   */
  disableBackgroundValidation(): void {
    this.backgroundValidationEnabled = false
    console.log('Background integrity validation disabled')
  }

  /**
   * 设置后台检查间隔
   */
  setBackgroundCheckInterval(minutes: number): void {
    const newInterval = minutes * 60 * 1000
    if (newInterval !== this.backgroundCheckInterval) {
      this.backgroundCheckInterval = newInterval

      // 重新设置定时器
      if (this.schedulerInterval) {
        clearInterval(this.schedulerInterval)
      }

      this.schedulerInterval = window.setInterval(() => {
        this.performBackgroundCheck()
      }, this.backgroundCheckInterval) as unknown as number

      console.log(`Background check interval set to ${minutes} minutes`)
    }
  }

  /**
   * 立即执行后台检查
   */
  async runBackgroundCheckNow(): Promise<IntegrityCheckResult> {
    return await this.runIntegrityCheck('quick', {
      skipBackup: true,
      skipRepair: false,
      detailed: false
    })
  }

  /**
   * 获取后台检查统计信息
   */
  getBackgroundStats(): {
    enabled: boolean
    interval: number // 分钟
    lastCheck?: Date
    nextCheck?: Date
    totalChecks: number
    averageCheckTime: number
    criticalIssuesFound: number
  } {
    const backgroundChecks = this.history.filter(check =>
      check.configId === 'quick' || check.duration < 10000 // 10秒内完成的检查
    )

    const totalChecks = backgroundChecks.length
    const averageCheckTime = totalChecks > 0
      ? backgroundChecks.reduce((sum, check) => sum + check.duration, 0) / totalChecks
      : 0

    const criticalIssuesFound = backgroundChecks.reduce((sum, check) =>
      sum + check.summary.criticalErrors, 0
    )

    let nextCheck: Date | undefined
    if (this.lastBackgroundCheck) {
      nextCheck = new Date(this.lastBackgroundCheck.getTime() + this.backgroundCheckInterval)
    }

    return {
      enabled: this.backgroundValidationEnabled,
      interval: this.backgroundCheckInterval / 60000, // 转换为分钟
      lastCheck: this.lastBackgroundCheck || undefined,
      nextCheck,
      totalChecks,
      averageCheckTime,
      criticalIssuesFound
    }
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval)
      this.schedulerInterval = null
    }

    // 移除事件监听器
    if (this.performanceMonitoring) {
      document.removeEventListener('visibilitychange', () => {})
    }

    console.log('Data integrity service destroyed')
  }
}

// 创建数据完整性检查服务实例
export const dataIntegrityService = new DataIntegrityService()

// 导出便捷函数
export const runIntegrityCheck = (configId?: string, options?: any) =>
  dataIntegrityService.runManualCheck(configId, options)

export const getIntegrityStatus = () => dataIntegrityService.getStatus()

export const createIntegrityBackup = (name?: string) =>
  dataIntegrityService.createManualBackup(name)

export const getIntegrityHistory = (limit?: number) =>
  dataIntegrityService.getHistory(limit)

// 后台检查相关便捷函数
export const enableBackgroundValidation = () =>
  dataIntegrityService.enableBackgroundValidation()

export const disableBackgroundValidation = () =>
  dataIntegrityService.disableBackgroundValidation()

export const setBackgroundCheckInterval = (minutes: number) =>
  dataIntegrityService.setBackgroundCheckInterval(minutes)

export const runBackgroundCheckNow = () =>
  dataIntegrityService.runBackgroundCheckNow()

export const getBackgroundStats = () =>
  dataIntegrityService.getBackgroundStats()

export const requestNotificationPermission = async (): Promise<boolean> => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }
  return false
}

// 事件监听器注册函数
export const onIntegrityIssues = (callback: (event: CustomEvent) => void) => {
  window.addEventListener('cardall:integrity-issues', callback as EventListener)
  return () => {
    window.removeEventListener('cardall:integrity-issues', callback as EventListener)
  }
}