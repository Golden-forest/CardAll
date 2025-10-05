import { Card, CardAction, CardFilter, ViewSettings } from '@/types/card'

/**
 * 存储适配器接口
 * 统一localStorage和IndexedDB的访问接口,支持渐进式迁移
 */
export interface StorageAdapter {
  // 基础信息
  readonly name: string
  readonly version: string

  // 存储模式管理
  getStorageMode(): 'localStorage' | 'indexeddb'
  setStorageMode(mode: 'localStorage' | 'indexeddb'): Promise<void>

  // 增强的存储模式切换
  switchStorageMode(mode: 'localStorage' | 'indexeddb'): Promise<StorageModeSwitchResult>

  // 数据迁移
  migrateFromLocalStorage(): Promise<MigrationResult>
  backupData(): Promise<BackupResult>
  restoreData(backup: BackupResult): Promise<boolean>

  // 卡片操作
  getCards(filter?: CardFilter): Promise<Card[]>
  getCardById(id: string): Promise<Card | null>
  createCard(card: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>): Promise<Card>
  updateCard(id: string, updates: Partial<Card>): Promise<Card>
  deleteCard(id: string): Promise<boolean>

  // 批量操作
  createCards(cards: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Card[]>
  updateCards(updates: Array<{ id: string; updates: Partial<Card> }>): Promise<Card[]>
  deleteCards(ids: string[]): Promise<boolean>

  // 搜索和过滤
  searchCards(query: string, filter?: CardFilter): Promise<Card[]>
  getCardsByTag(tagName: string): Promise<Card[]>
  getCardsByFolder(folderId: string): Promise<Card[]>

  // 统计信息
  getStats(): Promise<StorageStats>

  // 健康检查
  healthCheck(): Promise<HealthCheckResult>

  // 配置管理
  getConfig(): StorageConfig
  updateConfig(config: Partial<StorageConfig>): Promise<void>

  // 事件监听
  addEventListener(event: StorageEventType, listener: StorageEventListener): void
  removeEventListener(event: StorageEventType, listener: StorageEventListener): void
}

/**
 * 存储错误接口
 */
/**
 * 迁移结果
 */
export interface MigrationResult {
  success: boolean
  migratedCards: number
  totalCards: number
  errors: string[]
  warnings: string[]
  duration: number
  timestamp: Date
}

/**
 * 备份结果
 */
export /**
 * 存储统计信息
 */
export /**
 * 健康检查结果
 */
export /**
 * 健康问题
 */
export /**
 * 存储配置
 */
export /**
 * 配置验证结果
 */
export /**
 * 存储模式切换结果
 */
export /**
 * 存储验证结果
 */
export /**
 * 存储事件类型
 */
export type StorageEventType =
  | 'cardsChanged'
  | 'cardCreated'
  | 'cardUpdated'
  | 'cardDeleted'
  | 'migrationStarted'
  | 'migrationCompleted'
  | 'migrationFailed'
  | 'backupCreated'
  | 'backupRestored'
  | 'storageModeChanged'
  | 'storageModeSwitchProgress'
  | 'storageModeSwitchCancelled'
  | 'storageModeSwitchFailed'
  | 'error'

/**
 * 存储事件
 */
export /**
 * 事件监听器
 */
export type StorageEventListener = (event: StorageEvent) => void

/**
 * 默认配置
 */
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  autoMigration: true,
  backupOnMigration: true,
  compressionEnabled: true,
  cacheEnabled: true,
  cacheSize: 1000,
  syncEnabled: true,
  debugMode: false,
  performanceMonitoring: true,
  maxRetries: 3,
  timeout: 30000
}

/**
 * 配置验证函数
 */
export function validateStorageConfig(config: Partial<StorageConfig>): ConfigValidationResult {
  const merged = { ...DEFAULT_STORAGE_CONFIG, ...config }
  const errors: string[] = []
  const warnings: string[] = []

  // 验证缓存大小
  if (merged.cacheSize < 0 || merged.cacheSize > 10000) {
    errors.push('cacheSize must be between 0 and 10000')
  }

  // 验证超时时间
  if (merged.timeout < 1000 || merged.timeout > 300000) {
    warnings.push('timeout should be between 1000ms and 300000ms')
  }

  // 验证重试次数
  if (merged.maxRetries < 0 || merged.maxRetries > 10) {
    errors.push('maxRetries must be between 0 and 10')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    config: merged
  }
}

/**
 * 创建存储错误的工具函数
 */
export function createStorageError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): StorageError {
  return {
    code,
    message,
    details,
    timestamp: new Date(),
    stack: new Error().stack
  }
}

/**
 * 存储适配器工厂
 */
export class StorageAdapterFactory {
  private static instance: StorageAdapter | null = null

  /**
   * 创建存储适配器实例
   */
  static async create(config?: Partial<StorageConfig>): Promise<StorageAdapter> {
    if (this.instance) {
      return this.instance
    }

    // 验证配置
    const validation = validateStorageConfig(config || {})
    if (!validation.valid) {
      throw createStorageError(
        'INVALID_CONFIG',
        'Invalid storage configuration',
        { errors: validation.errors }
      )
    }

    try {
      // 动态导入实现类,避免循环依赖
      const { UniversalStorageAdapter } = await import('./universal-storage-adapter')
      this.instance = new UniversalStorageAdapter(validation.config)
    } catch (error) {
          console.warn("操作失败:", error)
        }
      )
    }

    return this.instance
  }

  /**
   * 获取当前实例
   */
  static getInstance(): StorageAdapter | null {
    return this.instance
  }

  /**
   * 重置实例（主要用于测试）
   */
  static resetInstance(): void {
    this.instance = null
  }
}