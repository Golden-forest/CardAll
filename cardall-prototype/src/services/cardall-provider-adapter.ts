import { CardAllProvider } from '@/contexts/cardall-provider'
import { UniversalStorageAdapter } from './universal-storage-adapter'
import { DataMigrationService } from './data-migration.service'
import { MigrationValidator } from './migration-validator'
import { unifiedErrorHandler, handleStorageError } from './unified-error-handler'
import { performanceMonitor, startOperation, endOperation, getPerformanceMetrics } from './performance-monitor'
import { StorageError, createStorageError } from './storage-adapter'
import { Card, CardAction } from '@/types/card'

/**
 * CardAllProvider适配器状态
 */
export interface ProviderAdapterState {
  isInitialized: boolean
  storageMode: 'localStorage' | 'indexeddb' | 'hybrid'
  migrationStatus: 'not_started' | 'in_progress' | 'completed' | 'failed' | 'rolled_back'
  healthStatus: 'healthy' | 'warning' | 'degraded' | 'critical'
  lastError: StorageError | null
  performanceMetrics: any
}

/**
 * Provider适配器配置选项
 */
export interface ProviderAdapterOptions {
  enableMigration?: boolean
  enablePerformanceMonitoring?: boolean
  enableErrorHandling?: boolean
  migrationTimeout?: number
  autoMigrateOnFirstRun?: boolean
  fallbackToLocalStorage?: boolean
}

/**
 * CardAllProvider适配器
 *
 * 这个适配器包装了原始的CardAllProvider，并添加了以下功能：
 * - 自动数据迁移
 * - 性能监控
 * - 错误处理
 * - 健康检查
 * - 状态管理
 */
export class CardAllProviderAdapter {
  private static instance: CardAllProviderAdapter | null = null
  private originalProvider: typeof CardAllProvider
  private storageAdapter: UniversalStorageAdapter
  private migrationService: DataMigrationService
  private migrationValidator: MigrationValidator
  private options: ProviderAdapterOptions
  private state: ProviderAdapterState

  public static getInstance(
    originalProvider: typeof CardAllProvider,
    options?: ProviderAdapterOptions
  ): CardAllProviderAdapter {
    if (!CardAllProviderAdapter.instance) {
      CardAllProviderAdapter.instance = new CardAllProviderAdapter(originalProvider, options || {})
    }
    return CardAllProviderAdapter.instance
  }

  constructor(
    originalProvider: typeof CardAllProvider,
    options: ProviderAdapterOptions = {}
  ) {
    this.originalProvider = originalProvider
    this.options = {
      enableMigration: true,
      enablePerformanceMonitoring: true,
      enableErrorHandling: true,
      migrationTimeout: 30000, // 30秒
      autoMigrateOnFirstRun: true,
      fallbackToLocalStorage: true,
      ...options
    }

    this.storageAdapter = new UniversalStorageAdapter()
    this.migrationService = DataMigrationService.getInstance()
    this.migrationValidator = new MigrationValidator()

    this.state = {
      isInitialized: false,
      storageMode: 'localStorage',
      migrationStatus: 'not_started',
      healthStatus: 'healthy',
      lastError: null,
      performanceMetrics: null
    }
  }

  /**
   * 初始化适配器
   */
  async initialize(): Promise<void> {
    if (this.state.isInitialized) {
      return
    }

    const initOperationId = startOperation('provider_adapter_init')

    try {
      console.log('Initializing CardAllProvider adapter...')

      // 检查是否需要迁移
      if (this.options.enableMigration && this.options.autoMigrateOnFirstRun) {
        await this.checkAndPerformMigration()
      }

      // 初始化存储适配器
      await this.storageAdapter.initialize()

      // 确定存储模式
      this.state.storageMode = await this.determineStorageMode()

      // 执行健康检查
      await this.performHealthCheck()

      this.state.isInitialized = true
      console.log('CardAllProvider adapter initialized successfully')

      endOperation(initOperationId, true)
    } catch (error) {
      endOperation(initOperationId, false, error instanceof Error ? error.message : String(error))

      const storageError = error instanceof StorageError
        ? error
        : createStorageError('INIT_FAILED', 'Failed to initialize provider adapter', { error })

      this.state.lastError = storageError
      this.state.healthStatus = 'degraded'

      if (this.options.enableErrorHandling) {
        await handleStorageError(storageError, { component: 'CardAllProviderAdapter' })
      }

      throw storageError
    }
  }

  /**
   * 检查并执行数据迁移
   */
  private async checkAndPerformMigration(): Promise<void> {
    const needsMigration = await this.migrationService.needsMigration()

    if (needsMigration) {
      console.log('Data migration needed, starting migration...')
      this.state.migrationStatus = 'in_progress'

      const migrationOperationId = startOperation('data_migration')

      try {
        // 执行迁移
        const result = await this.migrationService.migrate({
          createBackup: true,
          validateData: true,
          cleanupAfterSuccess: true,
          progressCallback: (progress) => {
            console.log(`Migration progress: ${progress.progress}% - ${progress.message}`)
          }
        })

        if (result.success) {
          this.state.migrationStatus = 'completed'
          console.log(`Migration completed successfully: ${result.migratedCards}/${result.totalCards} cards migrated`)
        } else {
          this.state.migrationStatus = 'failed'
          throw createStorageError('MIGRATION_FAILED', 'Migration completed with errors', { result })
        }

        endOperation(migrationOperationId, true)
      } catch (error) {
        this.state.migrationStatus = 'failed'
        endOperation(migrationOperationId, false, error instanceof Error ? error.message : String(error))

        // 尝试回滚
        if (this.options.fallbackToLocalStorage) {
          console.log('Migration failed, attempting rollback...')
          await this.attemptRollback()
        }

        throw error
      }
    } else {
      console.log('No migration needed')
      this.state.migrationStatus = 'completed'
    }
  }

  /**
   * 尝试回滚迁移
   */
  private async attemptRollback(): Promise<void> {
    const rollbackOperationId = startOperation('migration_rollback')

    try {
      const success = await this.migrationService.rollback()

      if (success) {
        this.state.migrationStatus = 'rolled_back'
        console.log('Migration rollback completed successfully')
      } else {
        console.error('Migration rollback failed')
      }

      endOperation(rollbackOperationId, success)
    } catch (error) {
      endOperation(rollbackOperationId, false, error instanceof Error ? error.message : String(error))
      console.error('Migration rollback failed:', error)
    }
  }

  /**
   * 确定存储模式
   */
  private async determineStorageMode(): Promise<'localStorage' | 'indexeddb' | 'hybrid'> {
    try {
      // 检查IndexedDB是否可用
      const indexedDBAvailable = await this.isIndexedDBAvailable()

      if (!indexedDBAvailable) {
        return 'localStorage'
      }

      // 检查是否有数据在IndexedDB中
      const hasIndexedDBData = await this.hasIndexedDBData()

      if (hasIndexedDBData) {
        return 'indexeddb'
      }

      // 检查是否有数据在localStorage中
      const hasLocalStorageData = await this.hasLocalStorageData()

      if (hasLocalStorageData) {
        return 'localStorage'
      }

      // 默认使用localStorage
      return 'localStorage'
    } catch (error) {
      console.warn('Failed to determine storage mode, defaulting to localStorage:', error)
      return 'localStorage'
    }
  }

  /**
   * 检查IndexedDB是否可用
   */
  private async isIndexedDBAvailable(): Promise<boolean> {
    try {
      return 'indexedDB' in window
    } catch {
      return false
    }
  }

  /**
   * 检查IndexedDB中是否有数据
   */
  private async hasIndexedDBData(): Promise<boolean> {
    try {
      // 这里可以添加检查IndexedDB数据的逻辑
      return false
    } catch {
      return false
    }
  }

  /**
   * 检查localStorage中是否有数据
   */
  private async hasLocalStorageData(): Promise<boolean> {
    try {
      const data = localStorage.getItem('cards')
      return data !== null && data.length > 0
    } catch {
      return false
    }
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.options.enablePerformanceMonitoring) {
      return
    }

    try {
      const healthCheck = await performanceMonitor.performHealthCheck()
      this.state.healthStatus = healthCheck.status as any
      this.state.performanceMetrics = await getPerformanceMetrics()
    } catch (error) {
      console.warn('Health check failed:', error)
      this.state.healthStatus = 'warning'
    }
  }

  /**
   * 获取当前状态
   */
  getState(): ProviderAdapterState {
    return { ...this.state }
  }

  /**
   * 获取适配器统计信息
   */
  async getStats(): Promise<{
    migrationStats: any
    performanceStats: any
    errorStats: any
    healthStatus: string
  }> {
    const migrationStats = await this.migrationService.getMigrationStats()
    const performanceStats = this.options.enablePerformanceMonitoring
      ? await getPerformanceMetrics()
      : null
    const errorStats = this.options.enableErrorHandling
      ? unifiedErrorHandler.getErrorStats()
      : null

    return {
      migrationStats,
      performanceStats,
      errorStats,
      healthStatus: this.state.healthStatus
    }
  }

  /**
   * 包装CardAllProvider的卡片操作
   */
  async wrapCardOperation(operation: string, action: () => Promise<Card[]> | Card[]): Promise<Card[]> {
    const operationId = startOperation(`card_${operation}`)

    try {
      const result = await action()
      endOperation(operationId, true)
      return result
    } catch (error) {
      endOperation(operationId, false, error instanceof Error ? error.message : String(error))

      if (this.options.enableErrorHandling) {
        const storageError = error instanceof StorageError
          ? error
          : createStorageError('CARD_OPERATION_FAILED', `Card operation ${operation} failed`, { error })

        await handleStorageError(storageError, {
          component: 'CardAllProviderAdapter',
          operation
        })
      }

      throw error
    }
  }

  /**
   * 包装CardAllProvider的dispatch操作
   */
  async wrapDispatchAction(action: CardAction): Promise<void> {
    const operationId = startOperation('dispatch_action')

    try {
      // 这里可以添加对dispatch操作的监控和错误处理
      endOperation(operationId, true)
    } catch (error) {
      endOperation(operationId, false, error instanceof Error ? error.message : String(error))

      if (this.options.enableErrorHandling) {
        const storageError = error instanceof StorageError
          ? error
          : createStorageError('DISPATCH_FAILED', 'Dispatch action failed', { error, action })

        await handleStorageError(storageError, {
          component: 'CardAllProviderAdapter',
          operation: 'dispatch'
        })
      }

      throw error
    }
  }

  /**
   * 销毁适配器
   */
  destroy(): void {
    this.state.isInitialized = false
    performanceMonitor.destroy()
  }
}

/**
 * 创建适配器的便捷函数
 */
export function createCardAllProviderAdapter(
  originalProvider: typeof CardAllProvider,
  options?: ProviderAdapterOptions
): CardAllProviderAdapter {
  return CardAllProviderAdapter.getInstance(originalProvider, options)
}

/**
 * 检查适配器是否已初始化
 */
export function isProviderAdapterInitialized(adapter: CardAllProviderAdapter): boolean {
  return adapter.getState().isInitialized
}

/**
 * 获取适配器状态
 */
export function getProviderAdapterState(adapter: CardAllProviderAdapter): ProviderAdapterState {
  return adapter.getState()
}

/**
 * 获取适配器统计信息
 */
export async function getProviderAdapterStats(adapter: CardAllProviderAdapter) {
  return adapter.getStats()
}