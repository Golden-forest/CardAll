import { Card, CardFilter, ViewSettings } from '@/types/card'
import { db, DbCard } from '@/services/database'
import { secureStorage } from '@/utils/secure-storage'
import { unifiedSyncService } from '@/services/unified-sync-service'
import {
  StorageAdapter,
  StorageConfig,
  MigrationResult,
  BackupResult,
  StorageStats,
  HealthCheckResult,
  HealthIssue,
  StorageEvent,
  StorageEventType,
  StorageEventListener,
  DEFAULT_STORAGE_CONFIG,
  createStorageError
} from './storage-adapter'

/**
 * 存储模式切换进度
 */
export interface StorageModeSwitchProgress {
  phase: 'preparing' | 'validating' | 'backing-up' | 'migrating' | 'switching' | 'validating-after' | 'cleaning-up' | 'completed' | 'failed'
  percentage: number
  message: string
  details?: Record<string, unknown>
  timestamp: Date
}

/**
 * 存储模式切换结果
 */
export interface StorageModeSwitchResult {
  success: boolean
  message: string
  fromMode: 'localStorage' | 'indexeddb'
  toMode: 'localStorage' | 'indexeddb'
  dataMigrated: boolean
  rollbackPerformed: boolean
  duration?: number
  backup?: BackupResult
  validation: StorageValidationResult
  progress?: StorageModeSwitchProgress[]
}

/**
 * 存储验证结果
 */
export interface StorageValidationResult {
  isValid: boolean
  issues: string[]
  warnings?: string[]
  details?: Record<string, unknown>
}

export class UniversalStorageAdapter implements StorageAdapter {
  readonly name = 'UniversalStorageAdapter'
  readonly version = '1.0.0'

  private static instance: UniversalStorageAdapter
  private storageMode: 'localStorage' | 'indexeddb' = 'localStorage'
  private config: StorageConfig
  private eventListeners: Map<StorageEventType, StorageEventListener[]> = new Map()
  private readonly STORAGE_MODE_KEY = 'cardall_storage_mode'
  private readonly MIGRATION_STATUS_KEY = 'cardall_migration_status'

  // 进度回调支持
  private progressCallbacks: Set<(progress: StorageModeSwitchProgress) => void> = new Set()

  // 取消令牌支持
  private cancelToken: { cancelled: boolean; reason?: string } | null = null

  constructor(config: StorageConfig = DEFAULT_STORAGE_CONFIG) {
    this.config = config
    this.initializeStorageMode()
    this.setupEventListeners()
  }

  // 单例模式
  static getInstance(): UniversalStorageAdapter {
    if (!UniversalStorageAdapter.instance) {
      UniversalStorageAdapter.instance = new UniversalStorageAdapter()
    }
    return UniversalStorageAdapter.instance
  }

  private initializeStorageMode(): void {
    try {
      const savedMode = secureStorage.get<'localStorage' | 'indexeddb'>(this.STORAGE_MODE_KEY)
      if (savedMode) {
        this.storageMode = savedMode
      } else {
        // 默认使用localStorage，保持向后兼容
        this.storageMode = 'localStorage'
        this.saveStorageMode()
      }
    } catch (error) {
      console.warn('Failed to initialize storage mode:', error)
      this.storageMode = 'localStorage'
    }
  }

  private saveStorageMode(): void {
    try {
      secureStorage.set(this.STORAGE_MODE_KEY, this.storageMode)
      this.emitEvent({
        type: 'storageModeChanged',
        timestamp: new Date(),
        data: { mode: this.storageMode }
      })
    } catch (error) {
      console.error('Failed to save storage mode:', error)
    }
  }

  // 存储模式管理
  getStorageMode(): 'localStorage' | 'indexeddb' {
    return this.storageMode
  }

  /**
   * 安全的存储模式切换
   * 增强的切换功能，包含数据验证、回滚机制和用户反馈
   */
  async switchStorageMode(
    mode: 'localStorage' | 'indexeddb',
    options?: {
      onProgress?: (progress: StorageModeSwitchProgress) => void
      onCancel?: () => void
      skipBackup?: boolean
      forceMigration?: boolean
    }
  ): Promise<StorageModeSwitchResult> {
    if (this.storageMode === mode) {
      this.notifyProgress({
        phase: 'completed',
        percentage: 100,
        message: `Already in ${mode} mode`,
        timestamp: new Date()
      })
      return {
        success: true,
        message: 'Already in requested mode',
        fromMode: this.storageMode,
        toMode: mode,
        dataMigrated: false,
        rollbackPerformed: false,
        validation: { isValid: true, issues: [] }
      }
    }

    const oldMode = this.storageMode
    const startTime = Date.now()
    let backup: BackupResult | undefined
    let dataMigrated = false
    let rollbackPerformed = false
    const progressHistory: StorageModeSwitchProgress[] = []

    // 设置进度回调
    if (options?.onProgress) {
      this.progressCallbacks.add(options.onProgress)
    }

    // 设置取消令牌
    this.cancelToken = { cancelled: false }

    try {
      this.notifyProgress({
        phase: 'preparing',
        percentage: 5,
        message: `准备从 ${oldMode} 切换到 ${mode}...`,
        timestamp: new Date()
      })

      // 阶段1: 切换前验证
      this.notifyProgress({
        phase: 'validating',
        percentage: 15,
        message: '验证切换条件...',
        timestamp: new Date()
      })

      const preSwitchValidation = await this.validatePreSwitchConditions(mode)
      if (!preSwitchValidation.isValid) {
        this.notifyProgress({
          phase: 'failed',
          percentage: 20,
          message: `切换前验证失败: ${preSwitchValidation.issues.join(', ')}`,
          details: { issues: preSwitchValidation.issues },
          timestamp: new Date()
        })
        throw new Error(`Pre-switch validation failed: ${preSwitchValidation.issues.join(', ')}`)
      }

      // 检查取消状态
      if (this.checkCancellation()) {
        throw new Error('Switch cancelled by user')
      }

      // 阶段2: 创建备份
      if (this.config.backupOnMigration && !options?.skipBackup) {
        this.notifyProgress({
          phase: 'backing-up',
          percentage: 30,
          message: '创建数据备份...',
          timestamp: new Date()
        })

        backup = await this.backupData()
        this.notifyProgress({
          phase: 'backing-up',
          percentage: 45,
          message: `备份创建成功: ${backup.id}`,
          details: { backupId: backup.id },
          timestamp: new Date()
        })
      }

      // 阶段3: 检查是否需要数据迁移
      const needsMigration = mode === 'indexeddb' && (await this.hasDataToMigrate() || options?.forceMigration)

      if (needsMigration) {
        this.notifyProgress({
          phase: 'migrating',
          percentage: 50,
          message: '开始数据迁移...',
          timestamp: new Date()
        })

        const migrationResult = await this.migrateFromLocalStorage()

        if (!migrationResult.success) {
          this.notifyProgress({
            phase: 'failed',
            percentage: 60,
            message: `数据迁移失败: ${migrationResult.errors.join(', ')}`,
            details: { errors: migrationResult.errors },
            timestamp: new Date()
          })
          throw new Error(`Migration failed: ${migrationResult.errors.join(', ')}`)
        }

        dataMigrated = true
        this.notifyProgress({
          phase: 'migrating',
          percentage: 70,
          message: `数据迁移完成: ${migrationResult.migratedCards} 张卡片`,
          details: {
            migratedCards: migrationResult.migratedCards,
            totalCards: migrationResult.totalCards
          },
          timestamp: new Date()
        })
      }

      // 检查取消状态
      if (this.checkCancellation()) {
        throw new Error('Switch cancelled by user')
      }

      // 阶段4: 执行切换
      this.notifyProgress({
        phase: 'switching',
        percentage: 80,
        message: `切换存储模式到 ${mode}...`,
        timestamp: new Date()
      })

      this.storageMode = mode
      this.saveStorageMode()

      // 阶段5: 切换后验证
      this.notifyProgress({
        phase: 'validating-after',
        percentage: 85,
        message: '验证切换后数据完整性...',
        timestamp: new Date()
      })

      const postSwitchValidation = await this.validatePostSwitchConditions(mode, oldMode)
      if (!postSwitchValidation.isValid) {
        this.notifyProgress({
          phase: 'failed',
          percentage: 90,
          message: `切换后验证失败: ${postSwitchValidation.issues.join(', ')}`,
          details: { issues: postSwitchValidation.issues },
          timestamp: new Date()
        })
        throw new Error(`Post-switch validation failed: ${postSwitchValidation.issues.join(', ')}`)
      }

      // 阶段6: 清理原数据（可选）
      if (needsMigration && dataMigrated) {
        this.notifyProgress({
          phase: 'cleaning-up',
          percentage: 95,
          message: '清理旧数据...',
          timestamp: new Date()
        })

        await this.cleanupOldData(oldMode)
      }

      const duration = Date.now() - startTime

      this.notifyProgress({
        phase: 'completed',
        percentage: 100,
        message: `存储模式切换成功完成，耗时 ${duration}ms`,
        details: { duration, dataMigrated, fromMode: oldMode, toMode: mode },
        timestamp: new Date()
      })

      this.emitEvent({
        type: 'storageModeChanged',
        timestamp: new Date(),
        data: {
          fromMode: oldMode,
          toMode: mode,
          dataMigrated,
          duration
        }
      })

      const result: StorageModeSwitchResult = {
        success: true,
        message: `Successfully switched from ${oldMode} to ${mode}`,
        fromMode: oldMode,
        toMode: mode,
        dataMigrated,
        rollbackPerformed,
        duration,
        backup,
        validation: postSwitchValidation,
        progress: progressHistory
      }

      // 记录切换历史
      this.recordSwitchHistory(result)

      return result

    } catch (error) {
      console.error('Storage mode switch failed:', error)

      this.notifyProgress({
        phase: 'failed',
        percentage: 0,
        message: `存储模式切换失败: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      })

      // 阶段7: 回滚机制
      if (backup) {
        this.notifyProgress({
          phase: 'rolling-back',
          percentage: 50,
          message: '正在回滚到原始状态...',
          timestamp: new Date()
        })

        console.log('Attempting rollback...')
        const rollbackSuccess = await this.performRollback(oldMode, backup)
        rollbackPerformed = rollbackSuccess

        if (rollbackSuccess) {
          this.notifyProgress({
            phase: 'rolled-back',
            percentage: 100,
            message: '回滚成功',
            timestamp: new Date()
          })
          console.log('Rollback completed successfully')
        } else {
          this.notifyProgress({
            phase: 'rollback-failed',
            percentage: 100,
            message: '回滚失败 - 可能需要手动干预',
            timestamp: new Date()
          })
          console.error('Rollback failed - manual intervention may be required')
        }
      } else {
        // 如果没有备份，直接恢复原模式
        console.log('No backup available, reverting to original mode...')
        this.storageMode = oldMode
        this.saveStorageMode()
      }

      const errorMessage = error instanceof Error ? error.message : String(error)

      this.emitEvent({
        type: 'error',
        timestamp: new Date(),
        data: {
          error: 'StorageModeSwitchFailed',
          details: {
            fromMode: oldMode,
            toMode: mode,
            error: errorMessage,
            rollbackPerformed
          }
        },
        error: error instanceof Error ? error : new Error(errorMessage)
      })

      const result: StorageModeSwitchResult = {
        success: false,
        message: `Failed to switch storage mode: ${errorMessage}`,
        fromMode: oldMode,
        toMode: mode,
        dataMigrated,
        rollbackPerformed,
        validation: { isValid: false, issues: [errorMessage] },
        progress: progressHistory
      }

      // 记录失败历史
      this.recordSwitchHistory(result)

      throw createStorageError(
        'STORAGE_MODE_SWITCH_FAILED',
        `Failed to switch storage mode: ${errorMessage}`,
        {
          fromMode: oldMode,
          toMode: mode,
          error: errorMessage,
          rollbackPerformed
        }
      )
    } finally {
      // 清理进度回调
      if (options?.onProgress) {
        this.progressCallbacks.delete(options.onProgress)
      }

      // 清理取消令牌
      this.cancelToken = null
    }
  }

  /**
   * 向后兼容的存储模式设置方法
   * @deprecated 使用 switchStorageMode 方法以获得更好的错误处理和验证
   */
  async setStorageMode(mode: 'localStorage' | 'indexeddb'): Promise<void> {
    try {
      const result = await this.switchStorageMode(mode)
      if (!result.success) {
        throw new Error(result.message)
      }
    } catch (error) {
      // 保持原有的错误处理行为
      if (this.storageMode !== mode) {
        // 如果切换失败，恢复原模式
        this.storageMode = mode === 'indexeddb' ? 'localStorage' : 'indexeddb'
        this.saveStorageMode()
      }
      throw error
    }
  }

  // === 存储模式切换增强方法 ===

  /**
   * 取消当前的存储模式切换操作
   */
  cancelStorageModeSwitch(reason: string = '用户取消'): void {
    if (this.cancelToken) {
      this.cancelToken.cancelled = true
      this.cancelToken.reason = reason
      this.notifyProgress({
        phase: 'cancelled',
        percentage: 0,
        message: `操作已取消: ${reason}`,
        timestamp: new Date()
      })
    }
  }

  /**
   * 检查是否已取消
   */
  private checkCancellation(): boolean {
    return this.cancelToken?.cancelled || false
  }

  /**
   * 通知进度更新
   */
  private notifyProgress(progress: StorageModeSwitchProgress): void {
    // 通知所有进度回调
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress)
      } catch (error) {
        console.warn('Progress callback error:', error)
      }
    })

    // 发出进度事件
    this.emitEvent({
      type: 'storageModeSwitchProgress',
      timestamp: new Date(),
      data: progress as unknown as Record<string, unknown>
    })
  }

  /**
   * 获取当前存储模式切换状态
   */
  isSwitchInProgress(): boolean {
    return this.cancelToken !== null
  }

  /**
   * 获取存储模式切换统计信息
   */
  async getStorageModeStats(): Promise<{
    currentMode: 'localStorage' | 'indexeddb'
    switchCount: number
    lastSwitchTime?: Date
    lastSwitchDuration?: number
    failedSwitches: number
    availableStorage: {
      localStorage: boolean
      indexedDB: boolean
    }
    dataDistribution: {
      localStorageCards: number
      indexedDBCards: number
      localStorageSize: number
      indexedDBSize: number
    }
  }> {
    try {
      // 获取切换历史
      const switchHistory = secureStorage.get<any[]>('storage_switch_history', []) || []
      const switchCount = switchHistory.length
      const lastSwitch = switchHistory[switchHistory.length - 1]

      // 统计失败次数
      const failedSwitches = switchHistory.filter(item => item.success === false).length

      // 检查存储可用性
      const localStorageAvailable = typeof localStorage !== 'undefined'
      const indexedDBAvailable = await this.isIndexedDBAvailable()

      // 统计数据分布
      let localStorageCards = 0
      let indexedDBCards = 0
      let localStorageSize = 0
      let indexedDBSize = 0

      // 检查localStorage数据
      try {
        const localCards = secureStorage.get<Card[]>('cards', {
          validate: true,
          encrypt: true
        })
        if (localCards) {
          localStorageCards = localCards.length
          localStorageSize = JSON.stringify(localCards).length
        }
      } catch (error) {
        console.warn('Failed to check localStorage data:', error)
      }

      // 检查IndexedDB数据
      try {
        if (indexedDBAvailable) {
          indexedDBCards = await db.cards.count()
          const dbCards = await db.cards.toArray()
          indexedDBSize = JSON.stringify(dbCards).length
        }
      } catch (error) {
        console.warn('Failed to check IndexedDB data:', error)
      }

      return {
        currentMode: this.storageMode,
        switchCount,
        lastSwitchTime: lastSwitch?.timestamp ? new Date(lastSwitch.timestamp) : undefined,
        lastSwitchDuration: lastSwitch?.duration,
        failedSwitches,
        availableStorage: {
          localStorage: localStorageAvailable,
          indexedDB: indexedDBAvailable
        },
        dataDistribution: {
          localStorageCards,
          indexedDBCards,
          localStorageSize,
          indexedDBSize
        }
      }
    } catch (error) {
      console.error('Failed to get storage mode stats:', error)
      throw createStorageError(
        'GET_STORAGE_STATS_FAILED',
        'Failed to get storage mode statistics',
        { error: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  /**
   * 记录切换历史
   */
  private recordSwitchHistory(result: StorageModeSwitchResult): void {
    try {
      const history = secureStorage.get<any[]>('storage_switch_history', []) || []

      // 添加新记录
      history.push({
        timestamp: new Date().toISOString(),
        fromMode: result.fromMode,
        toMode: result.toMode,
        success: result.success,
        duration: result.duration,
        dataMigrated: result.dataMigrated,
        rollbackPerformed: result.rollbackPerformed,
        message: result.message
      })

      // 限制历史记录数量（最多保留50条）
      if (history.length > 50) {
        history.splice(0, history.length - 50)
      }

      secureStorage.set('storage_switch_history', history)
    } catch (error) {
      console.warn('Failed to record switch history:', error)
    }
  }

  /**
   * 清理切换历史
   */
  clearSwitchHistory(): void {
    try {
      secureStorage.remove('storage_switch_history')
      console.log('Storage switch history cleared')
    } catch (error) {
      console.warn('Failed to clear switch history:', error)
    }
  }

  /**
   * 获取推荐的存储模式
   */
  async getRecommendedStorageMode(): Promise<{
    recommendedMode: 'localStorage' | 'indexeddb'
    reason: string
    confidence: 'high' | 'medium' | 'low'
    issues: string[]
  }> {
    const issues: string[] = []

    try {
      const stats = await this.getStorageModeStats()
      const indexedDBAvailable = stats.availableStorage.indexedDB
      const localStorageAvailable = stats.availableStorage.localStorage

      // 1. 如果IndexedDB不可用，推荐localStorage
      if (!indexedDBAvailable) {
        return {
          recommendedMode: 'localStorage',
          reason: 'IndexedDB is not available in this browser',
          confidence: 'high',
          issues: ['IndexedDB not supported']
        }
      }

      // 2. 如果数据量很大，推荐IndexedDB
      const totalSize = stats.dataDistribution.localStorageSize + stats.dataDistribution.indexedDBSize
      if (totalSize > 5 * 1024 * 1024) { // 5MB
        return {
          recommendedMode: 'indexeddb',
          reason: 'Large data volume detected, IndexedDB is more suitable',
          confidence: 'high',
          issues: []
        }
      }

      // 3. 如果当前模式工作正常，保持现状
      if (stats.failedSwitches === 0 || stats.failedSwitches / stats.switchCount < 0.2) {
        return {
          recommendedMode: stats.currentMode,
          reason: 'Current storage mode is working well',
          confidence: 'medium',
          issues: []
        }
      }

      // 4. 默认推荐IndexedDB（如果可用）
      return {
        recommendedMode: 'indexeddb',
        reason: 'IndexedDB offers better performance and reliability',
        confidence: 'medium',
        issues: []
      }

    } catch (error) {
      issues.push(`Failed to analyze storage recommendations: ${error instanceof Error ? error.message : String(error)}`)

      // 出错时推荐localStorage作为安全选项
      return {
        recommendedMode: 'localStorage',
        reason: 'Failed to analyze, using safe option',
        confidence: 'low',
        issues
      }
    }
  }

  /**
   * 切换前条件验证
   */
  private async validatePreSwitchConditions(targetMode: 'localStorage' | 'indexeddb'): Promise<StorageValidationResult> {
    const issues: string[] = []
    const warnings: string[] = []
    const details: Record<string, unknown> = {}

    try {
      // 1. 检查目标存储模式的可用性
      if (targetMode === 'indexeddb') {
        const indexedDBAvailable = await this.isIndexedDBAvailable()
        if (!indexedDBAvailable) {
          issues.push('IndexedDB is not available in this environment')
        }
        details.indexedDBAvailable = indexedDBAvailable
      }

      // 2. 检查当前数据完整性
      const currentDataValidation = await this.validateDataIntegrity()
      if (!currentDataValidation.isValid) {
        issues.push('Current data integrity check failed')
        issues.push(...currentDataValidation.issues)
      }
      details.currentDataValidation = currentDataValidation as unknown as Record<string, unknown>

      // 3. 检查存储空间（如果需要迁移）
      if (targetMode === 'indexeddb' && await this.hasDataToMigrate()) {
        const currentCards = await this.getCards()
        const estimatedSize = JSON.stringify(currentCards).length

        // 简单的存储空间检查
        if (navigator.storage && navigator.storage.estimate) {
          try {
            const estimate = await navigator.storage.estimate()
            const availableSpace = (estimate.quota || 0) - (estimate.usage || 0)

            if (availableSpace < estimatedSize * 2) { // 需要至少2倍空间
              warnings.push('Available storage space may be insufficient')
            }

            details.storageQuota = {
              total: estimate.quota,
              used: estimate.usage,
              available: availableSpace,
              required: estimatedSize
            }
          } catch (error) {
            warnings.push('Unable to estimate storage space')
          }
        }
      }

      // 4. 检查浏览器兼容性
      const browserCheck = this.checkBrowserCompatibility(targetMode)
      if (!browserCheck.compatible) {
        issues.push(...browserCheck.issues)
      }
      details.browserCompatibility = browserCheck as unknown as Record<string, unknown>

      return {
        isValid: issues.length === 0,
        issues,
        warnings: warnings.length > 0 ? warnings : undefined,
        details
      }

    } catch (error) {
      return {
        isValid: false,
        issues: [`Pre-switch validation error: ${error instanceof Error ? error.message : String(error)}`],
        warnings: warnings.length > 0 ? warnings : undefined,
        details
      }
    }
  }

  /**
   * 切换后条件验证
   */
  private async validatePostSwitchConditions(
    newMode: 'localStorage' | 'indexeddb',
    oldMode: 'localStorage' | 'indexeddb'
  ): Promise<StorageValidationResult> {
    const issues: string[] = []
    const warnings: string[] = []
    const details: Record<string, unknown> = {}

    try {
      // 1. 验证新模式下的数据访问
      const startTime = Date.now()
      await this.getCards() // 测试数据访问
      details.dataAccessTime = Date.now() - startTime

      // 2. 验证数据完整性
      const newDataValidation = await this.validateDataIntegrity(newMode)
      if (!newDataValidation.isValid) {
        issues.push('New mode data integrity check failed')
        issues.push(...newDataValidation.issues)
      }
      details.newDataValidation = newDataValidation as unknown as Record<string, unknown>

      // 3. 验证数据一致性（如果是从localStorage迁移到IndexedDB）
      if (oldMode === 'localStorage' && newMode === 'indexeddb') {
        const consistencyCheck = await this.validateMigrationConsistency()
        if (!consistencyCheck.isValid) {
          issues.push('Data consistency check failed')
          issues.push(...consistencyCheck.issues)
        }
        details.consistencyCheck = consistencyCheck as unknown as Record<string, unknown>
      }

      // 4. 验证性能指标
      const performanceCheck = await this.validateStoragePerformance(newMode)
      if (performanceCheck.warnings.length > 0) {
        warnings.push(...performanceCheck.warnings)
      }
      details.performanceCheck = performanceCheck as unknown as Record<string, unknown>

      return {
        isValid: issues.length === 0,
        issues,
        warnings: warnings.length > 0 ? warnings : undefined,
        details
      }

    } catch (error) {
      return {
        isValid: false,
        issues: [`Post-switch validation error: ${error instanceof Error ? error.message : String(error)}`],
        warnings: warnings.length > 0 ? warnings : undefined,
        details
      }
    }
  }

  /**
   * 执行回滚 - 增强版
   */
  private async performRollback(
    targetMode: 'localStorage' | 'indexeddb',
    backup: BackupResult
  ): Promise<boolean> {
    const rollbackStartTime = Date.now()
    console.log(`Starting enhanced rollback to ${targetMode}...`)

    try {
      // 阶段1: 回滚前状态检查
      console.log('Phase 1: Pre-rollback state check...')
      const currentMode = this.storageMode
      const originalStats = await this.getStats()
      console.log(`Current state: ${currentMode}, ${originalStats.totalCards} cards`)

      // 阶段2: 创建回滚前备份（以防回滚失败）
      console.log('Phase 2: Creating pre-rollback safety backup...')
      const safetyBackup = await this.createSafetyBackup()
      console.log(`Safety backup created: ${safetyBackup?.id || 'N/A'}`)

      // 阶段3: 临时存储模式设置
      console.log('Phase 3: Setting temporary storage mode...')
      const tempMode = currentMode
      this.storageMode = 'rollback_temp'
      this.saveStorageMode()

      // 阶段4: 验证备份完整性
      console.log('Phase 4: Validating backup integrity...')
      const backupValidation = await this.validateBackupIntegrity(backup)
      if (!backupValidation.isValid) {
        throw new Error(`Backup integrity validation failed: ${backupValidation.issues.join(', ')}`)
      }

      // 阶段5: 恢复存储模式
      console.log('Phase 5: Restoring storage mode...')
      this.storageMode = targetMode
      this.saveStorageMode()

      // 阶段6: 数据恢复
      console.log('Phase 6: Restoring data...')
      const restoreResult = await this.enhancedRestoreData(backup)

      if (!restoreResult.success) {
        throw new Error(`Data restoration failed: ${restoreResult.issues.join(', ')}`)
      }

      console.log(`Restored ${restoreResult.restoredCards} cards`)

      // 阶段7: 恢复后验证
      console.log('Phase 7: Post-rollback validation...')
      const validation = await this.validateDataIntegrity(targetMode)
      if (!validation.isValid) {
        console.warn(`Post-rollback validation issues: ${validation.issues.join(', ')}`)

        // 尝试数据修复
        if (validation.corruptedCards.length > 0) {
          console.log('Attempting data repair...')
          const repairResult = await this.repairDataIntegrity()
          console.log(`Repair result: ${repairResult.repaired ? 'SUCCESS' : 'FAILED'}`)

          if (!repairResult.repaired) {
            throw new Error(`Post-rollback data repair failed: ${repairResult.issues.join(', ')}`)
          }
        }
      }

      // 阶段8: 清理安全备份
      if (safetyBackup) {
        console.log('Phase 8: Cleaning up safety backup...')
        await this.cleanupSafetyBackup(safetyBackup.id)
      }

      const rollbackDuration = Date.now() - rollbackStartTime
      console.log(`Enhanced rollback completed successfully in ${rollbackDuration}ms`)

      this.emitEvent({
        type: 'backupRestored',
        timestamp: new Date(),
        data: {
          backupId: backup.id,
          rollback: true,
          duration: rollbackDuration,
          restoredCards: restoreResult.restoredCards,
          targetMode
        }
      })

      return true

    } catch (error) {
      const errorMessage = `Rollback failed: ${error instanceof Error ? error.message : String(error)}`
      console.error(errorMessage)

      // 回滚失败后的恢复策略
      try {
        console.log('Attempting emergency recovery...')

        // 尝试恢复到最后已知良好状态
        this.storageMode = targetMode
        this.saveStorageMode()

        // 发出紧急恢复事件
        this.emitEvent({
          type: 'error',
          timestamp: new Date(),
          data: {
            error: 'RollbackFailed',
            details: {
              targetMode,
              error: errorMessage,
              emergencyRecovery: true
            }
          },
          error: error instanceof Error ? error : new Error(errorMessage)
        })

      } catch (recoveryError) {
        console.error('Emergency recovery also failed:', recoveryError)
      }

      return false
    }
  }

  /**
   * 创建安全备份（用于回滚前的额外保护）
   */
  private async createSafetyBackup(): Promise<BackupResult | null> {
    try {
      const cards = await this.getCards()
      const backupData = {
        timestamp: new Date().toISOString(),
        version: this.version,
        purpose: 'rollback_safety',
        cards: cards
      }

      const backupJson = JSON.stringify(backupData)
      const backupId = `safety_backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // 存储安全备份
      secureStorage.set(backupId, backupData)

      const checksum = await this.calculateChecksum(backupJson)

      return {
        id: backupId,
        data: backupJson,
        timestamp: new Date(),
        version: this.version,
        cardCount: cards.length,
        checksum
      }
    } catch (error) {
      console.warn('Failed to create safety backup:', error)
      return null
    }
  }

  /**
   * 验证备份完整性
   */
  private async validateBackupIntegrity(backup: BackupResult): Promise<{
    isValid: boolean
    issues: string[]
    details?: Record<string, unknown>
  }> {
    const issues: string[] = []
    const details: Record<string, unknown> = {}

    try {
      // 1. 验证校验和
      const currentChecksum = await this.calculateChecksum(backup.data)
      details.checksumMatch = currentChecksum === backup.checksum
      details.backupChecksum = backup.checksum
      details.currentChecksum = currentChecksum

      if (currentChecksum !== backup.checksum) {
        issues.push('Backup checksum mismatch - data may be corrupted')
      }

      // 2. 验证数据格式
      try {
        const backupData = JSON.parse(backup.data)
        details.dataFormatValid = true

        if (!backupData.cards || !Array.isArray(backupData.cards)) {
          issues.push('Invalid backup data format - missing or invalid cards array')
          details.cardsValid = false
        } else {
          details.cardsValid = true
          details.cardCount = backupData.cards.length

          // 3. 验证卡片结构
          const sampleSize = Math.min(5, backupData.cards.length)
          const sampleCards = backupData.cards.slice(0, sampleSize)
          const structureIssues: string[] = []

          for (let i = 0; i < sampleCards.length; i++) {
            const card = sampleCards[i]
            const cardIssues = this.validateCardStructure(card)
            if (cardIssues.length > 0) {
              structureIssues.push(`Card at index ${i}: ${cardIssues.join(', ')}`)
            }
          }

          if (structureIssues.length > 0) {
            issues.push(`Card structure issues found: ${structureIssues.join('; ')}`)
            details.structureIssues = structureIssues
          } else {
            details.structureValid = true
          }
        }

      } catch (parseError) {
        issues.push(`Backup data parsing failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
        details.dataFormatValid = false
      }

      // 4. 验证备份时间戳
      const backupAge = Date.now() - backup.timestamp.getTime()
      details.backupAgeMs = backupAge
      details.backupAgeHours = backupAge / (1000 * 60 * 60)

      if (backupAge > 24 * 60 * 60 * 1000) { // 24小时
        issues.push('Backup is more than 24 hours old')
      }

      return {
        isValid: issues.length === 0,
        issues,
        details
      }

    } catch (error) {
      issues.push(`Backup validation failed: ${error instanceof Error ? error.message : String(error)}`)
      return {
        isValid: false,
        issues,
        details
      }
    }
  }

  /**
   * 增强的数据恢复
   */
  private async enhancedRestoreData(backup: BackupResult): Promise<{
    success: boolean
    restoredCards: number
    issues: string[]
  }> {
    const issues: string[] = []
    let restoredCards = 0

    try {
      // 1. 解析备份数据
      const backupData = JSON.parse(backup.data)

      if (!backupData.cards || !Array.isArray(backupData.cards)) {
        throw new Error('Invalid backup data format')
      }

      // 2. 清理当前数据
      console.log('Clearing current data...')
      if (this.storageMode === 'indexeddb') {
        await db.cards.clear()
      }
      // 清理localStorage数据（如果存在）
      secureStorage.remove('cards')

      // 3. 恢复数据
      console.log(`Restoring ${backupData.cards.length} cards...`)
      if (this.storageMode === 'indexeddb') {
        const dbCards = backupData.cards.map((card: Card) => this.convertToDbCard(card))

        try {
          // 尝试批量恢复
          await db.cards.bulkAdd(dbCards)
          restoredCards = dbCards.length
        } catch (bulkError) {
          console.warn('Bulk restore failed, trying individual restore...')
          issues.push(`Bulk restore failed: ${bulkError instanceof Error ? bulkError.message : String(bulkError)}`)

          // 逐个恢复失败的卡片
          restoredCards = 0
          for (const card of backupData.cards) {
            try {
              const dbCard = this.convertToDbCard(card)
              await db.cards.add(dbCard)
              restoredCards++
            } catch (cardError) {
              issues.push(`Failed to restore card ${card.id}: ${cardError instanceof Error ? cardError.message : String(cardError)}`)
            }
          }
        }
      } else {
        // localStorage模式恢复
        secureStorage.set('cards', backupData.cards)
        restoredCards = backupData.cards.length
      }

      // 4. 验证恢复结果
      const validation = await this.validateDataIntegrity(this.storageMode)
      if (!validation.isValid) {
        issues.push(...validation.issues.map(issue => `Validation: ${issue}`))
      } else {
        console.log(`Data integrity check passed for ${validation.cardCount} cards`)
      }

      return {
        success: issues.length === 0 || (restoredCards > 0 && issues.length < restoredCards * 0.1),
        restoredCards,
        issues
      }

    } catch (error) {
      issues.push(`Enhanced restore failed: ${error instanceof Error ? error.message : String(error)}`)
      return {
        success: false,
        restoredCards,
        issues
      }
    }
  }

  /**
   * 清理安全备份
   */
  private async cleanupSafetyBackup(backupId: string): Promise<void> {
    try {
      secureStorage.remove(backupId)
      console.log(`Safety backup ${backupId} cleaned up`)
    } catch (error) {
      console.warn(`Failed to cleanup safety backup ${backupId}:`, error)
    }
  }

  /**
   * 清理旧数据
   */
  private async cleanupOldData(oldMode: 'localStorage' | 'indexeddb'): Promise<void> {
    try {
      if (oldMode === 'localStorage') {
        // 清理localStorage数据（已迁移到IndexedDB）
        const localStorageCards = secureStorage.get<Card[]>('cards', {
          validate: true,
          encrypt: true
        })

        if (localStorageCards && localStorageCards.length > 0) {
          console.log('Cleaning up localStorage data...')
          secureStorage.remove('cards')
          console.log('localStorage data cleaned up')
        }
      } else if (oldMode === 'indexeddb') {
        // 如果从IndexedDB切换回localStorage，清理IndexedDB数据
        const hasIndexedDBData = await this.hasIndexedDBData()
        if (hasIndexedDBData) {
          console.log('Cleaning up IndexedDB data...')
          await db.cards.clear()
          console.log('IndexedDB data cleaned up')
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old data:', error)
      // 清理失败不应影响切换操作，仅记录警告
    }
  }

  /**
   * 验证迁移一致性 - 增强版
   */
  private async validateMigrationConsistency(): Promise<StorageValidationResult> {
    const issues: string[] = []
    const warnings: string[] = []
    const details: Record<string, unknown> = {}

    try {
      console.log('Starting migration consistency validation...')

      // 获取IndexedDB中的卡片数量
      const indexedDBCount = await db.cards.count()
      details.indexedDBCount = indexedDBCount

      // 获取原始localStorage数据（如果还存在）
      const localStorageCards = secureStorage.get<Card[]>('cards', {
        validate: true,
        encrypt: true
      })
      details.localStorageCards = localStorageCards?.length || 0

      if (localStorageCards && localStorageCards.length > 0) {
        // 1. 检查数量是否一致
        if (indexedDBCount !== localStorageCards.length) {
          issues.push(`Card count mismatch: IndexedDB has ${indexedDBCount}, localStorage had ${localStorageCards.length}`)
        }

        // 2. 验证关键卡片的一致性
        const sampleSize = Math.min(10, localStorageCards.length)
        const sampleCards = localStorageCards.slice(0, sampleSize)
        const sampleResults: Record<string, any> = {}

        for (const originalCard of sampleCards) {
          const cardResult: Record<string, any> = {
            id: originalCard.id,
            title: originalCard.frontContent.title,
            found: false,
            contentMatch: false,
            tagsMatch: false,
            timestampMatch: false
          }

          try {
            const dbCard = await db.cards.get(originalCard.id)
            if (!dbCard) {
              issues.push(`Card ${originalCard.id} not found in IndexedDB`)
              cardResult.found = false
              sampleResults[originalCard.id] = cardResult
              continue
            }

            cardResult.found = true

            // 验证关键字段
            const convertedCard = this.convertFromDbCard(dbCard)

            // 标题验证
            const titleMatch = convertedCard.frontContent.title === originalCard.frontContent.title
            const backTitleMatch = convertedCard.backContent.title === originalCard.backContent.title
            cardResult.contentMatch = titleMatch && backTitleMatch

            // 内容验证
            const contentMatch = convertedCard.frontContent.text === originalCard.frontContent.text &&
                               convertedCard.backContent.text === originalCard.backContent.text
            cardResult.contentMatch = cardResult.contentMatch && contentMatch

            // 标签验证
            const frontTagsMatch = JSON.stringify(convertedCard.frontContent.tags.sort()) ===
                                 JSON.stringify(originalCard.frontContent.tags.sort())
            const backTagsMatch = JSON.stringify(convertedCard.backContent.tags.sort()) ===
                                JSON.stringify(originalCard.backContent.tags.sort())
            cardResult.tagsMatch = frontTagsMatch && backTagsMatch

            // 时间戳验证
            const timestampMatch = convertedCard.createdAt.getTime() === originalCard.createdAt.getTime() &&
                                 convertedCard.updatedAt.getTime() === originalCard.updatedAt.getTime()
            cardResult.timestampMatch = timestampMatch

            sampleResults[originalCard.id] = cardResult

            if (!cardResult.found) {
              issues.push(`Card ${originalCard.id} missing in IndexedDB`)
            }
            if (!cardResult.contentMatch) {
              issues.push(`Content mismatch for card ${originalCard.id}`)
            }
            if (!cardResult.tagsMatch) {
              warnings.push(`Tags mismatch for card ${originalCard.id}`)
            }
            if (!cardResult.timestampMatch) {
              warnings.push(`Timestamp mismatch for card ${originalCard.id}`)
            }

          } catch (cardError) {
            console.warn(`Error validating card ${originalCard.id}:`, cardError)
            issues.push(`Validation error for card ${originalCard.id}: ${cardError instanceof Error ? cardError.message : String(cardError)}`)
          }
        }

        details.sampleValidation = sampleResults

        // 3. 计算整体一致性分数
        const totalChecks = Object.keys(sampleResults).length * 4 // found, content, tags, timestamp
        const passedChecks = Object.values(sampleResults).reduce((acc, result: any) => {
          return acc +
            (result.found ? 1 : 0) +
            (result.contentMatch ? 1 : 0) +
            (result.tagsMatch ? 1 : 0) +
            (result.timestampMatch ? 1 : 0)
        }, 0)

        const consistencyScore = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0
        details.consistencyScore = consistencyScore

        if (consistencyScore < 95) {
          warnings.push(`Migration consistency score is ${consistencyScore.toFixed(1)}%`)
        }

        // 4. 验证所有卡片ID的唯一性
        try {
          const allDbCards = await db.cards.toArray()
          const idSet = new Set<string>()
          const duplicateIds = new Set<string>()

          allDbCards.forEach(card => {
            if (idSet.has(card.id)) {
              duplicateIds.add(card.id)
            } else {
              idSet.add(card.id)
            }
          })

          if (duplicateIds.size > 0) {
            issues.push(`Found duplicate card IDs: ${Array.from(duplicateIds).join(', ')}`)
          }
        } catch (idError) {
          warnings.push(`Could not validate ID uniqueness: ${idError instanceof Error ? idError.message : String(idError)}`)
        }

        // 5. 验证数据结构完整性
        try {
          const allDbCards = await db.cards.toArray()
          const structureIssues = await this.validateDatabaseStructure(allDbCards)
          if (structureIssues.length > 0) {
            issues.push(...structureIssues)
          }
        } catch (structureError) {
          warnings.push(`Structure validation failed: ${structureError instanceof Error ? structureError.message : String(structureError)}`)
        }

      } else if (localStorageCards === null) {
        warnings.push('Original localStorage data not available for comparison')
      }

      const isValid = issues.length === 0
      console.log(`Migration consistency validation completed: ${isValid ? 'PASS' : 'FAIL'}`)
      if (!isValid) {
        console.warn(`Found ${issues.length} issues and ${warnings.length} warnings`)
      }

      return {
        isValid,
        issues,
        warnings: warnings.length > 0 ? warnings : undefined,
        details
      }

    } catch (error) {
      const errorMessage = `Migration consistency check failed: ${error instanceof Error ? error.message : String(error)}`
      console.error(errorMessage)
      return {
        isValid: false,
        issues: [errorMessage],
        warnings: warnings.length > 0 ? warnings : undefined,
        details
      }
    }
  }

  /**
   * 验证数据库结构完整性
   */
  private async validateDatabaseStructure(dbCards: any[]): Promise<string[]> {
    const issues: string[] = []

    try {
      for (let i = 0; i < dbCards.length; i++) {
        const dbCard = dbCards[i]

        // 检查必需字段
        const requiredFields = ['id', 'frontContent', 'backContent', 'createdAt', 'updatedAt']
        for (const field of requiredFields) {
          if (!(field in dbCard)) {
            issues.push(`Card at index ${i} missing required field: ${field}`)
          }
        }

        // 检查数据类型
        if (typeof dbCard.id !== 'string') {
          issues.push(`Card ${dbCard.id} has invalid ID type`)
        }

        if (dbCard.frontContent && typeof dbCard.frontContent !== 'object') {
          issues.push(`Card ${dbCard.id} has invalid frontContent type`)
        }

        if (dbCard.backContent && typeof dbCard.backContent !== 'object') {
          issues.push(`Card ${dbCard.id} has invalid backContent type`)
        }

        // 检查日期格式
        if (dbCard.createdAt) {
          try {
            new Date(dbCard.createdAt)
          } catch {
            issues.push(`Card ${dbCard.id} has invalid createdAt format`)
          }
        }

        if (dbCard.updatedAt) {
          try {
            new Date(dbCard.updatedAt)
          } catch {
            issues.push(`Card ${dbCard.id} has invalid updatedAt format`)
          }
        }
      }
    } catch (error) {
      issues.push(`Structure validation error: ${error instanceof Error ? error.message : String(error)}`)
    }

    return issues
  }

  /**
   * 验证存储性能
   */
  private async validateStoragePerformance(mode: 'localStorage' | 'indexeddb'): Promise<{
    warnings: string[]
    metrics: Record<string, number>
  }> {
    const warnings: string[] = []
    const metrics: Record<string, number> = {}

    try {
      // 测试读取性能
      const readStartTime = Date.now()
      await this.getCards()
      metrics.readTime = Date.now() - readStartTime

      // 测试写入性能
      const testCard = await this.createCard({
        frontContent: { title: 'Performance Test', text: 'Test content', tags: [] },
        backContent: { title: 'Performance Test Back', text: 'Test back content', tags: [] },
        style: { type: 'solid' },
        isFlipped: false
      })

      const writeStartTime = Date.now()
      await this.updateCard(testCard.id, {
        frontContent: { ...testCard.frontContent, text: 'Updated test content' }
      })
      metrics.writeTime = Date.now() - writeStartTime

      // 清理测试数据
      await this.deleteCard(testCard.id)

      // 性能阈值检查
      if (mode === 'indexeddb' && metrics.readTime > 1000) {
        warnings.push('IndexedDB read performance is slow')
      }
      if (mode === 'localStorage' && metrics.readTime > 500) {
        warnings.push('LocalStorage read performance is slow')
      }

      return { warnings, metrics }

    } catch (error) {
      warnings.push(`Performance validation failed: ${error instanceof Error ? error.message : String(error)}`)
      return { warnings, metrics }
    }
  }

  /**
   * 检查浏览器兼容性
   */
  private checkBrowserCompatibility(mode: 'localStorage' | 'indexeddb'): {
    compatible: boolean
    issues: string[]
    details: Record<string, boolean>
  } {
    const issues: string[] = []
    const details: Record<string, boolean> = {}

    try {
      // 检查localStorage支持
      details.localStorageSupported = typeof localStorage !== 'undefined'

      // 检查IndexedDB支持
      details.indexedDBSupported = typeof indexedDB !== 'undefined'

      // 检查Service Worker支持（影响离线功能）
      details.serviceWorkerSupported = 'serviceWorker' in navigator

      // 特定模式的兼容性检查
      if (mode === 'indexeddb') {
        if (!details.indexedDBSupported) {
          issues.push('IndexedDB is not supported in this browser')
        }

        // 检查特定IndexedDB功能
        try {
          const testDB = indexedDB.open('test_db', 1)
          details.indexedDBOpenable = true
          testDB.onsuccess = () => {
            const db = testDB.result
            db.close()
            indexedDB.deleteDatabase('test_db')
          }
        } catch (error) {
          details.indexedDBOpenable = false
          issues.push('IndexedDB cannot be opened in this browser')
        }
      }

      if (mode === 'localStorage' && !details.localStorageSupported) {
        issues.push('LocalStorage is not supported in this browser')
      }

      return {
        compatible: issues.length === 0,
        issues,
        details
      }

    } catch (error) {
      return {
        compatible: false,
        issues: [`Browser compatibility check failed: ${error instanceof Error ? error.message : String(error)}`],
        details
      }
    }
  }

  // === 原有方法 ===

  // 数据迁移检查
  private async hasDataToMigrate(): Promise<boolean> {
    if (this.storageMode === 'indexeddb') {
      return false
    }

    const localStorageCards = secureStorage.get<Card[]>('cards', {
      validate: true,
      encrypt: true
    })

    return localStorageCards ? localStorageCards.length > 0 : false
  }

  // 从localStorage迁移到IndexedDB
  async migrateFromLocalStorage(): Promise<MigrationResult> {
    const startTime = Date.now()
    this.emitEvent({
      type: 'migrationStarted',
      timestamp: new Date()
    })

    try {
      // 检查是否需要迁移
      const hasData = await this.hasDataToMigrate()
      if (!hasData) {
        const result: MigrationResult = {
          success: true,
          migratedCards: 0,
          totalCards: 0,
          errors: [],
          warnings: [],
          duration: Date.now() - startTime,
          timestamp: new Date()
        }
        this.emitEvent({
          type: 'migrationCompleted',
          timestamp: new Date(),
          data: result as unknown as Record<string, unknown>
        })
        return result
      }

      // 获取localStorage数据
      const localStorageCards = secureStorage.get<Card[]>('cards', {
        validate: true,
        encrypt: true
      })

      if (!localStorageCards || localStorageCards.length === 0) {
        const result: MigrationResult = {
          success: true,
          migratedCards: 0,
          totalCards: 0,
          errors: [],
          warnings: [],
          duration: Date.now() - startTime,
          timestamp: new Date()
        }
        this.emitEvent({
          type: 'migrationCompleted',
          timestamp: new Date(),
          data: result as unknown as Record<string, unknown>
        })
        return result
      }

      // 备份原数据
      let backup: BackupResult | undefined
      if (this.config.backupOnMigration) {
        backup = await this.backupData()
      }

      // 执行迁移
      const migrationResult = await this.performMigration(localStorageCards)

      // 验证迁移结果
      const validationSuccess = await this.validateMigration(localStorageCards.length)

      if (validationSuccess && migrationResult.success) {
        // 切换到IndexedDB模式
        await this.setStorageMode('indexeddb')

        // 清理localStorage数据（可选）
        if (migrationResult.errors.length === 0) {
          this.cleanupLocalStorage()
        }

        const finalResult: MigrationResult = {
          ...migrationResult,
          totalCards: localStorageCards.length,
          duration: Date.now() - startTime,
          timestamp: new Date()
        }

        this.emitEvent({
          type: 'migrationCompleted',
          timestamp: new Date(),
          data: finalResult as unknown as Record<string, unknown>
        })

        return finalResult
      } else {
        // 迁移失败，尝试回滚
        if (backup) {
          await this.restoreData(backup)
        }

        const failedResult: MigrationResult = {
          success: false,
          migratedCards: 0,
          totalCards: localStorageCards.length,
          errors: ['Migration validation failed'],
          warnings: migrationResult.warnings,
          duration: Date.now() - startTime,
          timestamp: new Date()
        }

        this.emitEvent({
          type: 'migrationFailed',
          timestamp: new Date(),
          data: failedResult as unknown as Record<string, unknown>,
          error: new Error('Migration validation failed')
        })

        return failedResult
      }
    } catch (error) {
      const failedResult: MigrationResult = {
        success: false,
        migratedCards: 0,
        totalCards: 0,
        errors: [error instanceof Error ? error.message : 'Unknown migration error'],
        warnings: [],
        duration: Date.now() - startTime,
        timestamp: new Date()
      }

      this.emitEvent({
        type: 'migrationFailed',
        timestamp: new Date(),
        data: failedResult as unknown as Record<string, unknown>,
        error: error instanceof Error ? error : new Error(String(error))
      })

      return failedResult
    }
  }

  private async performMigration(cards: Card[]): Promise<MigrationResult> {
    const failedItems: string[] = []
    const warnings: string[] = []
    let migratedCount = 0

    try {
      // 批量写入IndexedDB
      const dbCards: DbCard[] = cards.map(card => this.convertToDbCard(card))

      await db.cards.bulkAdd(dbCards)
      migratedCount = dbCards.length

      return {
        success: true,
        migratedCards: migratedCount,
        totalCards: cards.length,
        errors: [],
        warnings,
        duration: 0,
        timestamp: new Date()
      }
    } catch (error) {
      console.error('Bulk migration failed:', error)

      // 逐个重试失败的迁移
      for (const card of cards) {
        try {
          const dbCard = this.convertToDbCard(card)
          await db.cards.add(dbCard)
          migratedCount++
        } catch (cardError) {
          console.error(`Failed to migrate card ${card.id}:`, cardError)
          failedItems.push(card.id)
        }
      }

      const success = failedItems.length === 0
      if (!success) {
        warnings.push(`Some cards failed to migrate: ${failedItems.length} out of ${cards.length}`)
      }

      return {
        success,
        migratedCards: migratedCount,
        totalCards: cards.length,
        errors: failedItems,
        warnings,
        duration: 0,
        timestamp: new Date()
      }
    }
  }

  private async validateMigration(expectedCount: number): Promise<boolean> {
    try {
      const dbCount = await db.cards.count()
      return dbCount === expectedCount
    } catch (error) {
      console.error('Migration validation failed:', error)
      return false
    }
  }

  private cleanupLocalStorage(): void {
    try {
      secureStorage.remove('cards')
    } catch (error) {
      console.warn('Failed to cleanup localStorage:', error)
    }
  }

  // 备份和恢复
  async backupData(): Promise<BackupResult> {
    const cards = await this.getCards()
    const backupData = {
      timestamp: new Date().toISOString(),
      version: this.version,
      cards: cards
    }

    const backupJson = JSON.stringify(backupData)
    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 存储备份
    secureStorage.set(backupId, backupData)

    // 计算校验和
    const checksum = await this.calculateChecksum(backupJson)

    const backup: BackupResult = {
      id: backupId,
      data: backupJson,
      timestamp: new Date(),
      version: this.version,
      cardCount: cards.length,
      checksum
    }

    this.emitEvent({
      type: 'backupCreated',
      timestamp: new Date(),
      data: backup as unknown as Record<string, unknown>
    })

    return backup
  }

  async restoreData(backup: BackupResult): Promise<boolean> {
    try {
      // 验证校验和
      const currentChecksum = await this.calculateChecksum(backup.data)
      if (currentChecksum !== backup.checksum) {
        throw new Error('Backup data integrity check failed')
      }

      // 解析备份数据
      const backupData = JSON.parse(backup.data)

      // 验证数据格式
      if (!backupData.cards || !Array.isArray(backupData.cards)) {
        throw new Error('Invalid backup data format')
      }

      // 根据当前存储模式恢复数据
      if (this.storageMode === 'indexeddb') {
        const dbCards = backupData.cards.map((card: Card) => this.convertToDbCard(card))
        await db.cards.clear()
        await db.cards.bulkAdd(dbCards)
      } else {
        secureStorage.set('cards', backupData.cards)
      }

      this.emitEvent({
        type: 'backupRestored',
        timestamp: new Date(),
        data: { backupId: backup.id, cardCount: backup.cardCount }
      })

      return true
    } catch (error) {
      console.error('Restore failed:', error)
      return false
    }
  }

  private async calculateChecksum(data: string): Promise<string> {
    // 简单的校验和算法
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash).toString(16)
  }

  // 数据转换方法
  private convertToDbCard(card: Card): DbCard {
    return {
      id: card.id,
      frontContent: card.frontContent,
      backContent: card.backContent,
      style: card.style,
      // 移除isFlipped的持久化，使其成为纯UI状态
      // isFlipped: card.isFlipped,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      userId: undefined, // 将在同步时设置
      syncVersion: 1,
      pendingSync: true,
      lastSyncAt: undefined
    }
  }

  private convertFromDbCard(dbCard: DbCard): Card {
    const { userId, syncVersion, lastSyncAt, pendingSync, ...card } = dbCard
    return {
      ...card,
      id: card.id || '',
      // 确保从数据库加载时isFlipped为false，使其成为纯UI状态
      isFlipped: false,
      createdAt: new Date(card.createdAt),
      updatedAt: new Date(card.updatedAt)
    }
  }

  // 卡片操作实现
  async getCards(filter?: CardFilter): Promise<Card[]> {
    try {
      if (this.storageMode === 'indexeddb') {
        const dbCards = await db.cards.toArray()
        const cards = dbCards.map(card => this.convertFromDbCard(card))

        if (filter) {
          return this.applyFilter(cards, filter)
        }
        return cards
      } else {
        const cards = secureStorage.get<Card[]>('cards', {
          validate: true,
          encrypt: true
        }) || []

        if (filter) {
          return this.applyFilter(cards, filter)
        }
        return cards
      }
    } catch (error) {
      throw createStorageError(
        'GET_CARDS_FAILED',
        'Failed to get cards',
        { error: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  private applyFilter(cards: Card[], filter: CardFilter): Card[] {
    return cards.filter(card => {
      // 搜索词过滤
      if (filter.searchTerm) {
        const searchLower = filter.searchTerm.toLowerCase()
        const matchesTitle = card.frontContent.title.toLowerCase().includes(searchLower) ||
                           card.backContent.title.toLowerCase().includes(searchLower)
        const matchesContent = card.frontContent.text.toLowerCase().includes(searchLower) ||
                             card.backContent.text.toLowerCase().includes(searchLower)
        if (!matchesTitle && !matchesContent) return false
      }

      // 标签过滤
      if (filter.tags && filter.tags.length > 0) {
        const allCardTags = [...card.frontContent.tags, ...card.backContent.tags]
        const hasMatchingTag = filter.tags.some(tag => allCardTags.includes(tag))
        if (!hasMatchingTag) return false
      }

      return true
    })
  }

  async getCardById(id: string): Promise<Card | null> {
    try {
      if (this.storageMode === 'indexeddb') {
        const dbCard = await db.cards.get(id)
        return dbCard ? this.convertFromDbCard(dbCard) : null
      } else {
        const cards = await this.getCards()
        return cards.find(card => card.id === id) || null
      }
    } catch (error) {
      throw createStorageError(
        'GET_CARD_FAILED',
        `Failed to get card ${id}`,
        { error: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  async createCard(cardData: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>): Promise<Card> {
    const now = new Date()
    const card: Card = {
      ...cardData,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now
    }

    try {
      if (this.storageMode === 'indexeddb') {
        const dbCard = this.convertToDbCard(card)
        await db.cards.add(dbCard)
      } else {
        const currentCards = await this.getCards()
        currentCards.push(card)
        await this.saveCards(currentCards)
      }

      this.emitEvent({
        type: 'cardCreated',
        timestamp: new Date(),
        data: { card }
      })

      return card
    } catch (error) {
      throw createStorageError(
        'CREATE_CARD_FAILED',
        'Failed to create card',
        { error: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  async updateCard(id: string, updates: Partial<Card>): Promise<Card> {
    try {
      if (this.storageMode === 'indexeddb') {
        const existingCard = await db.cards.get(id)
        if (!existingCard) {
          throw createStorageError('CARD_NOT_FOUND', `Card ${id} not found`)
        }

        const updatedCard = { ...existingCard, ...updates, updatedAt: new Date() }
        await db.cards.put(updatedCard)
        return this.convertFromDbCard(updatedCard)
      } else {
        const currentCards = await this.getCards()
        const index = currentCards.findIndex(c => c.id === id)
        if (index === -1) {
          throw createStorageError('CARD_NOT_FOUND', `Card ${id} not found`)
        }

        currentCards[index] = { ...currentCards[index], ...updates, updatedAt: new Date() }
        await this.saveCards(currentCards)
        return currentCards[index]
      }
    } catch (error) {
      throw createStorageError(
        'UPDATE_CARD_FAILED',
        `Failed to update card ${id}`,
        { error: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  async deleteCard(id: string): Promise<boolean> {
    try {
      if (this.storageMode === 'indexeddb') {
        await db.cards.delete(id)
      } else {
        const currentCards = await this.getCards()
        const filteredCards = currentCards.filter(c => c.id !== id)
        await this.saveCards(filteredCards)
      }

      this.emitEvent({
        type: 'cardDeleted',
        timestamp: new Date(),
        data: { cardId: id }
      })

      return true
    } catch (error) {
      throw createStorageError(
        'DELETE_CARD_FAILED',
        `Failed to delete card ${id}`,
        { error: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  async saveCards(cards: Card[]): Promise<void> {
    try {
      if (this.storageMode === 'indexeddb') {
        const dbCards = cards.map(card => this.convertToDbCard(card))
        await db.cards.clear()
        await db.cards.bulkAdd(dbCards)
      } else {
        secureStorage.set('cards', cards)
      }

      this.emitEvent({
        type: 'cardsChanged',
        timestamp: new Date(),
        data: { cardCount: cards.length }
      })
    } catch (error) {
      throw createStorageError(
        'SAVE_CARDS_FAILED',
        'Failed to save cards',
        { error: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  // 批量操作
  async createCards(cardsData: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Card[]> {
    const now = new Date()
    const cards = cardsData.map(cardData => ({
      ...cardData,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now
    }))

    try {
      if (this.storageMode === 'indexeddb') {
        const dbCards = cards.map(card => this.convertToDbCard(card))
        await db.cards.bulkAdd(dbCards)
      } else {
        const currentCards = await this.getCards()
        currentCards.push(...cards)
        await this.saveCards(currentCards)
      }

      return cards
    } catch (error) {
      throw createStorageError(
        'CREATE_CARDS_FAILED',
        'Failed to create cards',
        { error: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  async updateCards(updateItems: Array<{ id: string; updates: Partial<Card> }>): Promise<Card[]> {
    const results: Card[] = []

    try {
      if (this.storageMode === 'indexeddb') {
        for (const { id, updates } of updateItems) {
          const card = await this.updateCard(id, updates)
          results.push(card)
        }
      } else {
        const currentCards = await this.getCards()
        for (const { id, updates } of updateItems) {
          const index = currentCards.findIndex(c => c.id === id)
          if (index !== -1) {
            currentCards[index] = { ...currentCards[index], ...updates, updatedAt: new Date() }
            results.push(currentCards[index])
          }
        }
        await this.saveCards(currentCards)
      }

      return results
    } catch (error) {
      throw createStorageError(
        'UPDATE_CARDS_FAILED',
        'Failed to update cards',
        { error: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  async deleteCards(ids: string[]): Promise<boolean> {
    try {
      if (this.storageMode === 'indexeddb') {
        await db.cards.bulkDelete(ids)
      } else {
        const currentCards = await this.getCards()
        const filteredCards = currentCards.filter(c => !ids.includes(c.id))
        await this.saveCards(filteredCards)
      }

      return true
    } catch (error) {
      throw createStorageError(
        'DELETE_CARDS_FAILED',
        'Failed to delete cards',
        { error: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  // 搜索和过滤
  async searchCards(query: string, filter?: CardFilter): Promise<Card[]> {
    const searchFilter: CardFilter = {
      ...filter,
      searchTerm: query
    }
    return this.getCards(searchFilter)
  }

  async getCardsByTag(tagName: string): Promise<Card[]> {
    const filter: CardFilter = {
      searchTerm: '',
      tags: [tagName]
    }
    return this.getCards(filter)
  }

  async getCardsByFolder(folderId: string): Promise<Card[]> {
    // 这里需要根据实际的文件夹逻辑实现
    const cards = await this.getCards()
    return cards.filter(card => {
      // 假设卡片有folderId字段
      return (card as any).folderId === folderId
    })
  }

  // 统计信息
  async getStats(): Promise<StorageStats> {
    try {
      let totalCards = 0
      let localStorageSize = 0
      let indexedDBSize = 0

      if (this.storageMode === 'indexeddb') {
        totalCards = await db.cards.count()
        // 估算IndexedDB大小
        const cards = await db.cards.toArray()
        indexedDBSize = JSON.stringify(cards).length
      } else {
        const cards = await this.getCards()
        totalCards = cards.length
        localStorageSize = JSON.stringify(cards).length
      }

      const totalSize = Math.max(localStorageSize, indexedDBSize)
      const lastUpdated = new Date()

      return {
        totalCards,
        totalFolders: 0, // 需要实现文件夹统计
        totalTags: 0,   // 需要实现标签统计
        totalSize,
        lastUpdated,
        storageMode: this.storageMode,
        indexedDBSize: indexedDBSize > 0 ? indexedDBSize : undefined,
        localStorageSize: localStorageSize > 0 ? localStorageSize : undefined
      }
    } catch (error) {
      throw createStorageError(
        'GET_STATS_FAILED',
        'Failed to get storage stats',
        { error: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  // 健康检查
  async healthCheck(): Promise<HealthCheckResult> {
    const issues: HealthIssue[] = []
    const recommendations: string[] = []
    let score = 100

    try {
      // 检查存储访问
      await this.getCards()

      // 检查IndexedDB健康状态
      if (this.storageMode === 'indexeddb') {
        try {
          await db.cards.count()
        } catch (error) {
          issues.push({
            level: 'error',
            code: 'INDEXEDDB_ACCESS_FAILED',
            message: 'Cannot access IndexedDB',
            details: { error: error instanceof Error ? error.message : String(error) }
          })
          score -= 40
        }
      }

      // 检查localStorage健康状态
      try {
        secureStorage.get('test')
      } catch (error) {
        issues.push({
          level: 'warning',
          code: 'LOCALSTORAGE_ACCESS_FAILED',
          message: 'Cannot access localStorage',
          details: { error: error instanceof Error ? error.message : String(error) }
        })
        score -= 20
      }

      // 检查存储空间
      if (this.storageMode === 'indexeddb') {
        const stats = await this.getStats()
        if (stats.totalSize > 50 * 1024 * 1024) { // 50MB
          issues.push({
            level: 'warning',
            code: 'LARGE_STORAGE_SIZE',
            message: 'Storage size is large',
            details: { size: stats.totalSize }
          })
          score -= 10
          recommendations.push('Consider archiving old cards')
        }
      }

      return {
        healthy: score >= 70,
        score: Math.max(0, score),
        issues,
        recommendations,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        healthy: false,
        score: 0,
        issues: [{
          level: 'error',
          code: 'HEALTH_CHECK_FAILED',
          message: 'Health check failed',
          details: { error: error instanceof Error ? error.message : String(error) }
        }],
        recommendations: ['Check storage permissions and browser compatibility'],
        timestamp: new Date()
      }
    }
  }

  // 配置管理
  getConfig(): StorageConfig {
    return { ...this.config }
  }

  // IndexedDB可用性检查
  async isIndexedDBAvailable(): Promise<boolean> {
    try {
      // 检查浏览器环境
      if (typeof window === 'undefined') {
        console.warn('IndexedDB not available: not in browser environment')
        return false
      }

      // 检查浏览器是否支持IndexedDB
      if (!('indexedDB' in window)) {
        console.warn('IndexedDB not available: indexedDB not supported in this browser')
        return false
      }

      // 检查IDBFactory接口是否可用
      if (!window.indexedDB || typeof window.indexedDB.open !== 'function') {
        console.warn('IndexedDB not available: IDBFactory interface not available')
        return false
      }

      // 检查私有浏览模式限制
      try {
        // 尝试创建测试数据库来验证功能
        const testDBName = 'cardall_availability_test'
        const testDB = window.indexedDB.open(testDBName, 1)

        return new Promise<boolean>((resolve) => {
          let timeoutId: number

          const cleanup = () => {
            if (timeoutId) {
              clearTimeout(timeoutId)
            }
            try {
              window.indexedDB.deleteDatabase(testDBName)
            } catch (cleanupError) {
              console.debug('Failed to cleanup test database:', cleanupError)
            }
          }

          timeoutId = window.setTimeout(() => {
            console.warn('IndexedDB availability test timed out')
            cleanup()
            resolve(false)
          }, 5000) // 5秒超时

          testDB.onerror = (event) => {
            console.warn('IndexedDB availability test failed:', event)
            cleanup()
            resolve(false)
          }

          testDB.onblocked = () => {
            console.warn('IndexedDB availability test blocked')
            cleanup()
            resolve(false)
          }

          testDB.onsuccess = () => {
            const db = testDB.result
            try {
              db.close()
              cleanup()
              console.debug('IndexedDB availability test passed')
              resolve(true)
            } catch (closeError) {
              console.warn('Failed to close test database:', closeError)
              cleanup()
              resolve(false)
            }
          }

          testDB.onupgradeneeded = (event) => {
            console.debug('IndexedDB upgrade needed during availability test')
          }
        })

      } catch (testError) {
        console.warn('IndexedDB availability test error:', testError)
        return false
      }

    } catch (error) {
      console.warn('IndexedDB not available:', error)
      return false
    }
  }

  // 检查IndexedDB中是否有数据
  async hasIndexedDBData(): Promise<boolean> {
    try {
      // 首先检查IndexedDB是否可用
      const indexedDBAvailable = await this.isIndexedDBAvailable()
      if (!indexedDBAvailable) {
        console.debug('IndexedDB data check: IndexedDB not available')
        return false
      }

      // 尝试获取数据库连接状态
      try {
        // 检查数据库是否已打开
        if (!db.isOpen()) {
          try {
            await db.open()
          } catch (openError) {
            console.warn('Failed to open database for data check:', openError)
            return false
          }
        }

        // 尝试获取卡片数量
        let cardCount: number
        try {
          cardCount = await db.cards.count()
          console.debug(`IndexedDB card count: ${cardCount}`)
        } catch (countError) {
          console.warn('Failed to get card count:', countError)
          return false
        }

        // 如果有卡片，返回true
        if (cardCount > 0) {
          return true
        }

        // 检查其他可能的数据表
        const hasOtherData = await this.checkOtherDataTables()
        if (hasOtherData) {
          return true
        }

        console.debug('IndexedDB data check: no data found')
        return false

      } catch (dbError) {
        console.warn('Database operation failed during data check:', dbError)
        return false
      }

    } catch (error) {
      console.warn('Failed to check IndexedDB data:', error)
      return false
    }
  }

  // 检查其他数据表是否有数据
  private async checkOtherDataTables(): Promise<boolean> {
    try {
      // 检查文件夹数据
      try {
        const folderCount = await db.folders.count()
        if (folderCount > 0) {
          console.debug(`Found ${folderCount} folders in IndexedDB`)
          return true
        }
      } catch (folderError) {
        console.debug('Failed to check folders:', folderError)
      }

      // 检查标签数据
      try {
        const tagCount = await db.tags.count()
        if (tagCount > 0) {
          console.debug(`Found ${tagCount} tags in IndexedDB`)
          return true
        }
      } catch (tagError) {
        console.debug('Failed to check tags:', tagError)
      }

      // 检查图片数据
      try {
        const imageCount = await db.images.count()
        if (imageCount > 0) {
          console.debug(`Found ${imageCount} images in IndexedDB`)
          return true
        }
      } catch (imageError) {
        console.debug('Failed to check images:', imageError)
      }

      // 检查设置数据
      try {
        const settingsCount = await db.settings.count()
        if (settingsCount > 0) {
          console.debug(`Found ${settingsCount} settings in IndexedDB`)
          return true
        }
      } catch (settingsError) {
        console.debug('Failed to check settings:', settingsError)
      }

      return false
    } catch (error) {
      console.debug('Error checking other data tables:', error)
      return false
    }
  }

  // 数据完整性验证
  async validateDataIntegrity(storageMode?: 'localStorage' | 'indexeddb'): Promise<{
    isValid: boolean
    issues: string[]
    cardCount: number
    corruptedCards: string[]
  }> {
    const mode = storageMode || this.storageMode
    const issues: string[] = []
    const corruptedCards: string[] = []

    try {
      console.log(`Validating data integrity for ${mode}...`)

      // 获取所有卡片
      const cards = await this.getCards()

      if (!Array.isArray(cards)) {
        issues.push('Cards data is not an array')
        return {
          isValid: false,
          issues,
          cardCount: 0,
          corruptedCards
        }
      }

      // 验证每张卡片的结构
      for (const card of cards) {
        const cardIssues = this.validateCardStructure(card)
        if (cardIssues.length > 0) {
          corruptedCards.push(card.id || 'unknown')
          issues.push(`Card ${card.id || 'unknown'} has issues: ${cardIssues.join(', ')}`)
        }
      }

      // 验证数据一致性
      if (mode === 'indexeddb') {
        const dbCards = await db.cards.toArray()
        if (dbCards.length !== cards.length) {
          issues.push(`Card count mismatch: IndexedDB has ${dbCards.length}, adapter returned ${cards.length}`)
        }
      }

      // 验证时间戳一致性
      const timestampIssues = this.validateTimestamps(cards)
      issues.push(...timestampIssues)

      const isValid = issues.length === 0

      console.log(`Data integrity validation completed: ${isValid ? 'PASS' : 'FAIL'}`)
      if (!isValid) {
        console.warn(`Found ${issues.length} issues`)
      }

      return {
        isValid,
        issues,
        cardCount: cards.length,
        corruptedCards
      }

    } catch (error) {
      const errorMessage = `Data integrity validation failed: ${error instanceof Error ? error.message : String(error)}`
      issues.push(errorMessage)
      console.error(errorMessage)

      return {
        isValid: false,
        issues,
        cardCount: 0,
        corruptedCards
      }
    }
  }

  // 验证单个卡片结构
  private validateCardStructure(card: any): string[] {
    const issues: string[] = []

    // 必需字段验证
    if (!card.id || typeof card.id !== 'string') {
      issues.push('Missing or invalid id')
    }

    if (!card.frontContent || typeof card.frontContent !== 'object') {
      issues.push('Missing or invalid frontContent')
    } else {
      if (!card.frontContent.title || typeof card.frontContent.title !== 'string') {
        issues.push('Missing or invalid frontContent.title')
      }
      if (typeof card.frontContent.text !== 'string') {
        issues.push('Invalid frontContent.text type')
      }
    }

    if (!card.backContent || typeof card.backContent !== 'object') {
      issues.push('Missing or invalid backContent')
    } else {
      if (!card.backContent.title || typeof card.backContent.title !== 'string') {
        issues.push('Missing or invalid backContent.title')
      }
      if (typeof card.backContent.text !== 'string') {
        issues.push('Invalid backContent.text type')
      }
    }

    // 时间戳验证
    if (!card.createdAt || !(card.createdAt instanceof Date)) {
      issues.push('Missing or invalid createdAt')
    }

    if (!card.updatedAt || !(card.updatedAt instanceof Date)) {
      issues.push('Missing or invalid updatedAt')
    }

    // 样式验证
    if (card.style && typeof card.style !== 'object') {
      issues.push('Invalid style type')
    }

    // 标签验证
    if (card.frontContent.tags && !Array.isArray(card.frontContent.tags)) {
      issues.push('Invalid frontContent.tags type')
    }

    if (card.backContent.tags && !Array.isArray(card.backContent.tags)) {
      issues.push('Invalid backContent.tags type')
    }

    return issues
  }

  // 验证时间戳一致性
  private validateTimestamps(cards: Card[]): string[] {
    const issues: string[] = []

    for (const card of cards) {
      // 检查创建时间是否在未来
      if (card.createdAt > new Date()) {
        issues.push(`Card ${card.id} has creation date in the future`)
      }

      // 检查更新时间是否在未来
      if (card.updatedAt > new Date()) {
        issues.push(`Card ${card.id} has update date in the future`)
      }

      // 检查更新时间是否早于创建时间
      if (card.updatedAt < card.createdAt) {
        issues.push(`Card ${card.id} has update date before creation date`)
      }

      // 检查是否是非常久远的数据（可能损坏）
      const minDate = new Date('2000-01-01')
      if (card.createdAt < minDate || card.updatedAt < minDate) {
        issues.push(`Card ${card.id} has suspiciously old timestamps`)
      }
    }

    return issues
  }

  // 修复数据完整性问题
  async repairDataIntegrity(): Promise<{
    repaired: boolean
    repairedCards: number
    issues: string[]
    failedRepairs: string[]
  }> {
    console.log('Starting data integrity repair...')

    const repairedCards: string[] = []
    const failedRepairs: string[] = []
    const issues: string[] = []

    try {
      // 获取完整性验证结果
      const validation = await this.validateDataIntegrity()

      if (validation.isValid) {
        console.log('No integrity issues found')
        return {
          repaired: true,
          repairedCards: 0,
          issues: [],
          failedRepairs: []
        }
      }

      console.log(`Found ${validation.issues.length} issues to repair`)

      // 获取所有卡片
      const cards = await this.getCards()
      const repairedCardsData: Card[] = []

      // 尝试修复每张有问题的卡片
      for (const card of cards) {
        const cardIssues = this.validateCardStructure(card)

        if (cardIssues.length > 0) {
          const repairedCard = this.repairCard(card)

          if (this.validateCardStructure(repairedCard).length === 0) {
            repairedCardsData.push(repairedCard)
            repairedCards.push(card.id || 'unknown')
            console.log(`Successfully repaired card ${card.id}`)
          } else {
            failedRepairs.push(card.id || 'unknown')
            issues.push(`Failed to repair card ${card.id}: ${cardIssues.join(', ')}`)
          }
        } else {
          repairedCardsData.push(card)
        }
      }

      // 保存修复后的数据
      if (repairedCardsData.length !== cards.length) {
        await this.saveCards(repairedCardsData)
        console.log(`Repaired ${repairedCards.length} cards`)
      }

      return {
        repaired: failedRepairs.length === 0,
        repairedCards: repairedCards.length,
        issues,
        failedRepairs
      }

    } catch (error) {
      const errorMessage = `Data repair failed: ${error instanceof Error ? error.message : String(error)}`
      console.error(errorMessage)

      return {
        repaired: false,
        repairedCards: 0,
        issues: [errorMessage],
        failedRepairs: repairedCards
      }
    }
  }

  // 修复单个卡片
  private repairCard(card: any): Card {
    const repaired: Card = {
      id: card.id || crypto.randomUUID(),
      frontContent: {
        title: card.frontContent?.title || 'Untitled',
        text: card.frontContent?.text || '',
        tags: Array.isArray(card.frontContent?.tags) ? card.frontContent.tags : []
      },
      backContent: {
        title: card.backContent?.title || 'Untitled',
        text: card.backContent?.text || '',
        tags: Array.isArray(card.backContent?.tags) ? card.backContent.tags : []
      },
      style: typeof card.style === 'object' ? card.style : { type: 'solid' },
      isFlipped: typeof card.isFlipped === 'boolean' ? card.isFlipped : false,
      createdAt: card.createdAt instanceof Date ? card.createdAt : new Date(),
      updatedAt: new Date()
    }

    // 确保时间戳逻辑正确
    if (repaired.createdAt > new Date()) {
      repaired.createdAt = new Date()
    }

    if (repaired.updatedAt < repaired.createdAt) {
      repaired.updatedAt = repaired.createdAt
    }

    return repaired
  }

  async updateConfig(config: Partial<StorageConfig>): Promise<void> {
    const { validateStorageConfig } = await import('./storage-adapter')
    const validation = validateStorageConfig({ ...this.config, ...config })

    if (!validation.valid) {
      throw createStorageError(
        'INVALID_CONFIG',
        'Invalid storage configuration',
        { errors: validation.errors }
      )
    }

    this.config = validation.config
  }

  // 事件系统
  private setupEventListeners(): void {
    // 设置IndexedDB变化监听
    if (this.storageMode === 'indexeddb') {
      try {
        db.cards.hook('creating', (primKey, obj, trans) => {
          this.emitEvent({
            type: 'cardCreated',
            timestamp: new Date(),
            data: { cardId: primKey }
          })
        })

        db.cards.hook('updating', (modifications, primKey, obj, trans) => {
          this.emitEvent({
            type: 'cardUpdated',
            timestamp: new Date(),
            data: { cardId: primKey }
          })
        })

        db.cards.hook('deleting', (primKey, obj, trans) => {
          this.emitEvent({
            type: 'cardDeleted',
            timestamp: new Date(),
            data: { cardId: primKey }
          })
        })
      } catch (error) {
        console.warn('Failed to setup IndexedDB event listeners:', error)
      }
    }
  }

  addEventListener(event: StorageEventType, listener: StorageEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(listener)
  }

  removeEventListener(event: StorageEventType, listener: StorageEventListener): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private emitEvent(event: StorageEvent): void {
    const listeners = this.eventListeners.get(event.type)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event)
        } catch (error) {
          console.error(`Event listener error for ${event.type}:`, error)
        }
      })
    }
  }
}