import { Card } from '@/types/card'
import { DbCard } from '@/services/database'
import { db } from '@/services/database'
import { secureStorage } from '@/utils/secure-storage'
import { DataConverterAdapter } from './data-converter-adapter'
import { StorageAdapterFactory } from './storage-adapter'
import {
  MigrationResult,
  BackupResult,
  createStorageError
} from './storage-adapter'

/**
 * 数据迁移服务
 * 负责从localStorage安全迁移到IndexedDB
 */
export class DataMigrationService {
  private static instance: DataMigrationService | null = null
  private readonly MIGRATION_STATUS_KEY = 'cardall_migration_status'
  private readonly BACKUP_PREFIX = 'cardall_backup_'

  public static getInstance(): DataMigrationService {
    if (!DataMigrationService.instance) {
      DataMigrationService.instance = new DataMigrationService()
    }
    return DataMigrationService.instance
  }

  /**
   * 检查是否需要迁移
   */
  async needsMigration(): Promise<boolean> {
    try {
      // 检查是否已经完成迁移
      const migrationStatus = this.getMigrationStatus()
      if (migrationStatus?.completed) {
        return false
      }

      // 检查localStorage中是否有数据
      const localStorageData = secureStorage.get('cards')
      if (!localStorageData) {
        return false
      }

      // 检查IndexedDB是否已有数据
      const indexedDBCount = await db.cards.count()
      if (indexedDBCount > 0) {
        return false
      }

      return true
    } catch (error) {
      console.warn("检查迁移状态失败:", error)
      return false
    }
  }

  /**
   * 执行完整的数据迁移
   */
  async migrate(options: {
    createBackup?: boolean
    validateData?: boolean
    cleanupAfterSuccess?: boolean
    progressCallback?: (progress: MigrationProgress) => void
  } = {}): Promise<MigrationResult> {
    const {
      createBackup = true,
      validateData = true,
      cleanupAfterSuccess = true,
      progressCallback
    } = options

    const startTime = Date.now()

    try {
      // 检查是否需要迁移
      const needsMigration = await this.needsMigration()
      if (!needsMigration) {
        const result: MigrationResult = {
          success: true,
          migratedCards: 0,
          totalCards: 0,
          errors: [],
          warnings: [],
          duration: Date.now() - startTime,
          timestamp: new Date()
        }

        this.reportProgress(progressCallback, {
          stage: 'completed',
          progress: 100,
          message: 'No migration needed'
        })
        return result
      }

      this.reportProgress(progressCallback, {
        stage: 'starting',
        progress: 0,
        message: 'Starting migration...'
      })

      // 记录迁移开始
      this.setMigrationStatus({
        started: true,
        startTime: new Date(),
        stage: 'starting'
      })

      // 加载数据
      this.reportProgress(progressCallback, {
        stage: 'loading',
        progress: 10,
        message: 'Loading data from localStorage...'
      })
      const localStorageCards = this.loadLocalStorageData()

      if (localStorageCards.length === 0) {
        const result: MigrationResult = {
          success: true,
          migratedCards: 0,
          totalCards: 0,
          errors: [],
          warnings: ['No data found in localStorage'],
          duration: Date.now() - startTime,
          timestamp: new Date()
        }

        this.reportProgress(progressCallback, {
          stage: 'completed',
          progress: 100,
          message: 'No data to migrate'
        })
        return result
      }

      // 创建备份
      let backup: BackupResult | undefined
      if (createBackup) {
        this.reportProgress(progressCallback, {
          stage: 'backup',
          progress: 20,
          message: 'Creating backup...'
        })
        backup = await this.createBackup(localStorageCards)
      }

      // 验证数据
      if (validateData) {
        this.reportProgress(progressCallback, {
          stage: 'validation',
          progress: 30,
          message: 'Validating data integrity...'
        })
        const validation = this.validateMigrationData(localStorageCards)
        if (!validation.valid) {
          throw createStorageError(
            'VALIDATION_FAILED',
            'Data validation failed',
            { errors: validation.errors }
          )
        }
      }

      // 执行迁移
      this.reportProgress(progressCallback, {
        stage: 'migration',
        progress: 50,
        message: `Migrating ${localStorageCards.length} cards...`
      })
      const migrationResult = await this.performMigration(localStorageCards, (progress, message) => {
        this.reportProgress(progressCallback, {
          stage: 'migration',
          progress: 50 + (progress * 0.4), // 50-90%
          message
        })
      })

      // 验证迁移结果
      if (validateData) {
        this.reportProgress(progressCallback, {
          stage: 'verification',
          progress: 90,
          message: 'Verifying migration results...'
        })
        const verification = await this.verifyMigrationResults(localStorageCards.length)
        if (!verification.success) {
          throw createStorageError(
            'VERIFICATION_FAILED',
            'Migration verification failed',
            { details: verification.errors }
          )
        }
      }

      // 清理原数据
      if (cleanupAfterSuccess && migrationResult.errors.length === 0) {
        this.reportProgress(progressCallback, {
          stage: 'cleanup',
          progress: 95,
          message: 'Cleaning up original data...'
        })
        this.cleanupLocalStorage()
      }

      // 记录迁移完成
      this.setMigrationStatus({
        completed: true,
        completedAt: new Date(),
        success: true,
        migratedCards: migrationResult.migratedCards,
        totalCards: localStorageCards.length
      })

      const finalResult: MigrationResult = {
        success: migrationResult.success,
        migratedCards: migrationResult.migratedCards,
        totalCards: localStorageCards.length,
        errors: migrationResult.errors,
        warnings: migrationResult.warnings,
        duration: Date.now() - startTime,
        timestamp: new Date()
      }

      this.reportProgress(progressCallback, {
        stage: 'completed',
        progress: 100,
        message: `Migration completed successfully: ${migrationResult.migratedCards}/${localStorageCards.length} cards migrated`
      })
      return finalResult

    } catch (error) {
      console.warn("迁移失败:", error)
      const failedResult: MigrationResult = {
        success: false,
        migratedCards: 0,
        totalCards: 0,
        errors: [error instanceof Error ? error.message : 'Unknown migration error'],
        warnings: [],
        duration: Date.now() - startTime,
        timestamp: new Date()
      }

      this.reportProgress(progressCallback, {
        stage: 'error',
        progress: 0,
        message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
      return failedResult
    }
  }

  /**
   * 加载localStorage数据
   */
  private loadLocalStorageData(): Card[] {
    try {
      return DataConverterAdapter.loadFromLocalStorage()
    } catch (error) {
      console.warn("加载localStorage数据失败:", error)
      return []
    }
  }

  /**
   * 创建备份
   */
  private async createBackup(cards: Card[]): Promise<BackupResult> {
    try {
      const storageAdapter = await StorageAdapterFactory.create()
      return await storageAdapter.backupData()
    } catch (error) {
      console.warn("创建备份失败:", error)
      throw error
    }
  }

  /**
   * 验证迁移数据
   */
  private validateMigrationData(cards: Card[]): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!Array.isArray(cards)) {
      errors.push('Data is not an array')
      return { valid: false, errors }
    }

    cards.forEach((card, index) => {
      const validation = DataConverterAdapter.validateCard(card)
      if (!validation.valid) {
        errors.push(`Card at index ${index}: ${validation.errors.join(', ')}`)
      }
    })

    return { valid: errors.length === 0, errors }
  }

  /**
   * 执行实际的迁移操作
   */
  private async performMigration(
    cards: Card[],
    progressCallback?: (progress: number, message: string) => void
  ): Promise<{ migratedCards: number; errors: string[]; warnings: string[] }> {
    const errors: string[] = []
    const warnings: string[] = []
    let migratedCount = 0

    try {
      // 批量迁移
      const dbCards = DataConverterAdapter.bulkCardsToDbCards(cards)
      if (progressCallback) {
        progressCallback(0.1, 'Starting batch migration...')
      }

      await db.cards.bulkAdd(dbCards)
      migratedCount = dbCards.length

      if (progressCallback) {
        progressCallback(1.0, 'Batch migration completed')
      }

      return {
        migratedCards: migratedCount,
        errors,
        warnings
      }
    } catch (error) {
      console.warn("迁移操作失败:", error)
      return {
        migratedCards: migratedCount,
        errors: [error instanceof Error ? error.message : 'Migration failed'],
        warnings
      }
    }
  }

  /**
   * 验证迁移结果
   */
  private async verifyMigrationResults(expectedCount: number): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = []

    try {
      // 检查记录数量
      const actualCount = await db.cards.count()
      if (actualCount !== expectedCount) {
        errors.push(`Record count mismatch: expected ${expectedCount}, got ${actualCount}`)
      }

      // 检查数据完整性
      if (actualCount > 0) {
        const sampleCards = await db.cards.limit(10).toArray()
        for (const dbCard of sampleCards) {
          const card = DataConverterAdapter.dbCardToCard(dbCard)
          const validation = DataConverterAdapter.validateCard(card)
          if (!validation.valid) {
            errors.push(`Data integrity issue with card ${card.id}: ${validation.errors.join(', ')}`)
          }
        }
      }

      return {
        success: errors.length === 0,
        errors
      }
    } catch (error) {
      console.warn("验证迁移结果失败:", error)
      return { success: false, errors: ['Verification failed'] }
    }
  }

  /**
   * 清理localStorage数据
   */
  private cleanupLocalStorage(): void {
    try {
      secureStorage.remove('cards')
    } catch (error) {
      console.warn("清理localStorage数据失败:", error)
    }
  }

  /**
   * 回滚迁移
   */
  async rollback(): Promise<boolean> {
    try {
      // 获取最新的备份
      const backups = this.getAvailableBackups()
      if (backups.length === 0) {
        throw createStorageError('NO_BACKUP', 'No backup available for rollback')
      }

      const latestBackup = backups[0]

      // 恢复数据
      const storageAdapter = await StorageAdapterFactory.create()
      const success = await storageAdapter.restoreData(latestBackup)
      if (success) {
        // 记录回滚
        this.setMigrationStatus({
          rolledBack: true,
          rolledBackAt: new Date(),
          backupId: latestBackup.id
        })

        // 清理IndexedDB
        await db.cards.clear()
        return true
      }

      return false
    } catch (error) {
      console.warn("回滚失败:", error)
      return false
    }
  }

  /**
   * 获取可用的备份列表
   */
  getAvailableBackups(): BackupResult[] {
    const backups: BackupResult[] = []

    try {
      // 获取所有localStorage键
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.BACKUP_PREFIX)) {
          try {
            const backupData = secureStorage.get(key)
            if (backupData) {
              backups.push({
                id: key,
                data: JSON.stringify(backupData),
                timestamp: new Date(backupData.timestamp),
                version: backupData.version || '1.0.0',
                cardCount: backupData.cards?.length || 0,
                checksum: ''
              })
            }
          } catch (error) {
            console.warn("读取备份数据失败:", error)
          }
        }
      }
    } catch (error) {
      console.warn("获取备份列表失败:", error)
    }

    // 按时间排序,最新的在前
    return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * 获取迁移状态
   */
  getMigrationStatus(): MigrationStatus | null {
    try {
      return secureStorage.get<MigrationStatus>(this.MIGRATION_STATUS_KEY)
    } catch {
      return null
    }
  }

  /**
   * 设置迁移状态
   */
  private setMigrationStatus(status: Partial<MigrationStatus>): void {
    try {
      const current = this.getMigrationStatus() || {}
      secureStorage.set(this.MIGRATION_STATUS_KEY, { ...current, ...status })
    } catch (error) {
      console.warn("设置迁移状态失败:", error)
    }
  }

  /**
   * 报告进度
   */
  private reportProgress(
    callback: ((progress: MigrationProgress) => void) | undefined,
    progress: MigrationProgress
  ): void {
    if (callback) {
      try {
        callback(progress)
      } catch (error) {
        console.warn("报告进度失败:", error)
      }
    }
  }

  /**
   * 获取迁移统计信息
   */
  async getMigrationStats(): Promise<MigrationStats> {
    try {
      const status = this.getMigrationStatus()
      const backups = this.getAvailableBackups()
      const needsMigration = await this.needsMigration()
      return {
        migrationNeeded: needsMigration,
        migrationCompleted: status?.completed || false,
        migrationSuccessful: status?.success || false,
        lastMigrationTime: status?.completedAt || null,
        availableBackups: backups.length,
        localStorageCardCount: await this.getLocalStorageCardCount(),
        indexedDBCardCount: await db.cards.count()
      }
    } catch (error) {
      console.warn("获取迁移统计失败:", error)
      return {
        migrationNeeded: false,
        migrationCompleted: false,
        migrationSuccessful: false,
        lastMigrationTime: null,
        availableBackups: 0,
        localStorageCardCount: 0,
        indexedDBCardCount: 0
      }
    }
  }

  /**
   * 获取localStorage卡片数量
   */
  private async getLocalStorageCardCount(): Promise<number> {
    try {
      const cards = DataConverterAdapter.loadFromLocalStorage()
      return cards.length
    } catch {
      return 0
    }
  }
}

// 类型定义
export interface MigrationProgress {
  stage: string
  progress: number
  message: string
}

export interface MigrationStatus {
  started?: boolean
  startTime?: Date
  stage?: string
  completed?: boolean
  completedAt?: Date
  success?: boolean
  migratedCards?: number
  totalCards?: number
  rolledBack?: boolean
  rolledBackAt?: Date
  backupId?: string
}

export interface MigrationStats {
  migrationNeeded: boolean
  migrationCompleted: boolean
  migrationSuccessful: boolean
  lastMigrationTime: Date | null
  availableBackups: number
  localStorageCardCount: number
  indexedDBCardCount: number
}

// 导出单例实例
export const dataMigrationService = DataMigrationService.getInstance()