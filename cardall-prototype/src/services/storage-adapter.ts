import { Card, CardFilter, ViewSettings } from '@/types/card'

// ============================================================================
// 存储适配器接口和类型定义
// ============================================================================

export interface StorageAdapter {
  readonly name: string
  readonly version: string

  // 基础CRUD操作
  getCards(filter?: CardFilter): Promise<Card[]>
  getCardById(id: string): Promise<Card | null>
  createCard(cardData: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>): Promise<Card>
  updateCard(id: string, updates: Partial<Card>): Promise<Card>
  deleteCard(id: string): Promise<boolean>
  saveCards(cards: Card[]): Promise<void>

  // 同步和备份功能
  backupData(): Promise<BackupResult>
  restoreData(backup: BackupResult): Promise<boolean>
  getStats(): Promise<StorageStats>
  healthCheck(): Promise<HealthCheckResult>
  getConfig(): StorageConfig

  // 事件系统
  addEventListener(event: StorageEventType, listener: StorageEventListener): void
  removeEventListener(event: StorageEventType, listener: StorageEventListener): void
}

// 存储配置
export interface StorageConfig {
  version: string
  encryption: boolean
  compression: boolean
  cacheSize: number
  syncEnabled: boolean
  backupEnabled: boolean
  performanceMode: 'balanced' | 'speed' | 'size'
}

export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  version: '1.0.0',
  encryption: true,
  compression: false,
  cacheSize: 100,
  syncEnabled: true,
  backupEnabled: true,
  performanceMode: 'balanced'
}

// 存储事件类型
export interface StorageEvent {
  type: StorageEventType
  timestamp: Date
  data?: any
  error?: Error
}

export type StorageEventType =
  | 'cardCreated'
  | 'cardUpdated'
  | 'cardDeleted'
  | 'cardsChanged'
  | 'backupCreated'
  | 'backupRestored'
  | 'migrationStarted'
  | 'migrationCompleted'
  | 'migrationFailed'
  | 'storageModeChanged'
  | 'error'

export type StorageEventListener = (event: StorageEvent) => void

// 存储统计信息
export interface StorageStats {
  totalCards: number
  totalFolders: number
  totalTags: number
  totalSize: number
  lastUpdated: Date
  storageMode?: 'localStorage' | 'indexeddb'
  indexedDBSize?: number
  localStorageSize?: number
}

// 健康检查结果
export interface HealthCheckResult {
  healthy: boolean
  score: number
  issues: HealthIssue[]
  recommendations: string[]
  timestamp: Date
}

export interface HealthIssue {
  level: 'error' | 'warning' | 'info'
  code: string
  message: string
  details?: any
}

// 存储错误
export interface StorageError extends Error {
  code: string
  details?: any
}

export const createStorageError = (
  code: string,
  message: string,
  details?: any
): StorageError => {
  const error = new Error(message) as StorageError
  error.code = code
  error.details = details
  return error
}

// 迁移结果
export interface MigrationResult {
  success: boolean
  migratedCards: number
  totalCards: number
  errors: string[]
  warnings: string[]
  duration: number
  timestamp: Date
}

// 备份结果
export interface BackupResult {
  id: string
  data: string
  timestamp: Date
  version: string
  cardCount: number
  checksum: string
}

// 存储统计信息
export interface StorageStats {
  totalCards: number
  totalFolders: number
  totalTags: number
  totalSize: number
  lastUpdated: Date
  storageMode?: 'localStorage' | 'indexeddb'
  indexedDBSize?: number
  localStorageSize?: number
}

// 健康检查结果
export interface HealthCheckResult {
  healthy: boolean
  score: number
  issues: HealthIssue[]
  recommendations: string[]
  timestamp: Date
}

export interface HealthIssue {
  level: 'error' | 'warning' | 'info'
  code: string
  message: string
  details?: any
}

// ============================================================================
// 存储适配器工厂
// ============================================================================

export class StorageAdapterFactory {
  private static instance: StorageAdapterFactory
  private adapters: Map<string, () => StorageAdapter> = new Map()

  static getInstance(): StorageAdapterFactory {
    if (!StorageAdapterFactory.instance) {
      StorageAdapterFactory.instance = new StorageAdapterFactory()
    }
    return StorageAdapterFactory.instance
  }

  registerAdapter(name: string, factory: () => StorageAdapter): void {
    this.adapters.set(name, factory)
  }

  async create(name: string = 'default'): Promise<StorageAdapter> {
    const factory = this.adapters.get(name)
    if (!factory) {
      throw createStorageError('ADAPTER_NOT_FOUND', `Storage adapter '${name}' not found`)
    }
    return factory()
  }

  getAvailableAdapters(): string[] {
    return Array.from(this.adapters.keys())
  }
}

// ============================================================================
// 工具函数
// ============================================================================

export const isValidCard = (card: any): card is Card => {
  return card &&
    typeof card.id === 'string' &&
    typeof card.frontContent === 'object' &&
    typeof card.backContent === 'object' &&
    typeof card.style === 'object' &&
    card.createdAt instanceof Date &&
    card.updatedAt instanceof Date
}

export const createDefaultCard = (): Card => ({
  id: crypto.randomUUID(),
  frontContent: {
    title: '',
    text: '',
    tags: [],
    images: []
  },
  backContent: {
    title: '',
    text: '',
    tags: [],
    images: []
  },
  style: {
    type: 'solid',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    borderColor: '#e5e7eb'
  },
  isFlipped: false,
  createdAt: new Date(),
  updatedAt: new Date()
})

export const validateCardData = (card: Partial<Card>): string[] => {
  const errors: string[] = []

  if (!card.frontContent?.title?.trim()) {
    errors.push('Front content title is required')
  }

  if (!card.backContent?.title?.trim()) {
    errors.push('Back content title is required')
  }

  if (card.style?.type && !['solid', 'gradient', 'glass'].includes(card.style.type)) {
    errors.push('Invalid card style type')
  }

  return errors
}

// ============================================================================
// 默认实例
// ============================================================================

export const storageAdapterFactory = StorageAdapterFactory.getInstance()