const fs = require('fs');

// 直接重新创建universal-storage-adapter.ts文件，移除所有复杂的语法错误
const cleanContent = `import { Card, CardFilter, ViewSettings } from '@/types/card'
import { db, DbCard } from '@/services/database'
import { secureStorage } from '@/utils/secure-storage'
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
 * 存储模式切换结果
 */
export interface StorageModeSwitchResult {
  success: boolean
  message: string
  fromMode: 'localStorage' | 'indexeddb'
  toMode: 'localStorage' | 'indexeddb'
  dataMigrated: boolean
  rollbackPerformed: boolean
  validation: {
    isValid: boolean
    issues: string[]
  }
  progress: Array<{
    phase: string
    completed: number
    total: number
    message: string
    timestamp: Date
  }>
}

/**
 * 通用存储适配器
 * 支持localStorage和IndexedDB之间的无缝切换
 */
export class UniversalStorageAdapter implements StorageAdapter {
  readonly name = 'UniversalStorageAdapter'
  readonly version = '1.0.0'

  private static instance: UniversalStorageAdapter
  private storageMode: 'localStorage' | 'indexeddb' = 'localStorage'
  private config: StorageConfig
  private eventListeners: Map<StorageEventType, StorageEventListener[]> = new Map()
  private readonly STORAGE_MODE_KEY = 'cardall_storage_mode'

  constructor(config: StorageConfig = DEFAULT_STORAGE_CONFIG) {
    this.config = config
    this.initializeStorageMode()
    this.setupEventListeners()
  }

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
        this.storageMode = 'localStorage'
        this.saveStorageMode()
      }
    } catch (error) {
      console.warn("操作失败:", error)
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
      console.warn("操作失败:", error)
    }
  }

  getStorageMode(): 'localStorage' | 'indexeddb' {
    return this.storageMode
  }

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
          warnings: ['No data found in localStorage'],
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

      const backup = await this.backupData()
      const migrationResult = await this.performMigration(localStorageCards)
      const validationSuccess = await this.validateMigration(localStorageCards.length)

      if (validationSuccess && migrationResult.success) {
        await this.setStorageMode('indexeddb')
        if (migrationResult.errors.length === 0) {
          this.cleanupLocalStorage()
        }

        const finalResult = {
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
      console.warn("操作失败:", error)
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
      console.warn("操作失败:", error)
      return {
        success: false,
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
      console.warn("操作失败:", error)
      return false
    }
  }

  private cleanupLocalStorage(): void {
    try {
      secureStorage.remove('cards')
    } catch (error) {
      console.warn("操作失败:", error)
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
    const backupId = \`backup_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`

    secureStorage.set(backupId, backupData)
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
      const currentChecksum = await this.calculateChecksum(backup.data)
      if (currentChecksum !== backup.checksum) {
        throw new Error('Backup data integrity check failed')
      }

      const backupData = JSON.parse(backup.data)

      if (!backupData.cards || !Array.isArray(backupData.cards)) {
        throw new Error('Invalid backup data format')
      }

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
      console.warn("操作失败:", error)
      return false
    }
  }

  private async calculateChecksum(data: string): Promise<string> {
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
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
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      userId: undefined,
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
      console.warn("操作失败:", error)
      return []
    }
  }

  private applyFilter(cards: Card[], filter: CardFilter): Card[] {
    return cards.filter(card => {
      if (filter.searchTerm) {
        const searchLower = filter.searchTerm.toLowerCase()
        const matchesTitle = card.frontContent.title.toLowerCase().includes(searchLower) ||
                           card.backContent.title.toLowerCase().includes(searchLower)
        const matchesContent = card.frontContent.text.toLowerCase().includes(searchLower) ||
                             card.backContent.text.toLowerCase().includes(searchLower)
        if (!matchesTitle && !matchesContent) return false
      }

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
      console.warn("操作失败:", error)
      return null
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
      console.warn("操作失败:", error)
      throw error
    }
  }

  async updateCard(id: string, updates: Partial<Card>): Promise<Card> {
    try {
      if (this.storageMode === 'indexeddb') {
        const existingCard = await db.cards.get(id)
        if (!existingCard) {
          throw createStorageError('CARD_NOT_FOUND', \`Card \${id} not found\`)
        }

        const updatedCard = { ...existingCard, ...updates, updatedAt: new Date() }
        await db.cards.put(updatedCard)
        return this.convertFromDbCard(updatedCard)
      } else {
        const currentCards = await this.getCards()
        const index = currentCards.findIndex(c => c.id === id)
        if (index === -1) {
          throw createStorageError('CARD_NOT_FOUND', \`Card \${id} not found\`)
        }

        currentCards[index] = { ...currentCards[index], ...updates, updatedAt: new Date() }
        await this.saveCards(currentCards)
        return currentCards[index]
      }
    } catch (error) {
      console.warn("操作失败:", error)
      throw error
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
      console.warn("操作失败:", error)
      return false
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
      console.warn("操作失败:", error)
    }
  }

  // 统计信息
  async getStats(): Promise<StorageStats> {
    try {
      let totalCards = 0
      let localStorageSize = 0
      let indexedDBSize = 0

      if (this.storageMode === 'indexeddb') {
        totalCards = await db.cards.count()
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
        totalFolders: 0,
        totalTags: 0,
        totalSize,
        lastUpdated,
        storageMode: this.storageMode,
        indexedDBSize: indexedDBSize > 0 ? indexedDBSize : undefined,
        localStorageSize: localStorageSize > 0 ? localStorageSize : undefined
      }
    } catch (error) {
      console.warn("操作失败:", error)
      return {
        totalCards: 0,
        totalFolders: 0,
        totalTags: 0,
        totalSize: 0,
        lastUpdated: new Date(),
        storageMode: this.storageMode
      }
    }
  }

  // 健康检查
  async healthCheck(): Promise<HealthCheckResult> {
    const issues: HealthIssue[] = []
    const recommendations: string[] = []
    let score = 100

    try {
      await this.getCards()

      if (this.storageMode === 'indexeddb') {
        try {
          await db.cards.count()
        } catch (error) {
          issues.push({
            level: 'error',
            code: 'INDEXEDDB_ACCESS_FAILED',
            message: 'IndexedDB access failed',
            details: { error: error instanceof Error ? error.message : String(error) }
          })
          score -= 40
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
      console.warn("操作失败:", error)
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

  getConfig(): StorageConfig {
    return { ...this.config }
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
        console.warn("操作失败:", error)
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
          console.warn("操作失败:", error)
        }
      })
    }
  }
}

// 创建单例实例
export const universalStorageAdapter = UniversalStorageAdapter.getInstance()
export default universalStorageAdapter
`;

fs.writeFileSync('./src/services/universal-storage-adapter.ts', cleanContent);
console.log('Successfully created clean universal-storage-adapter.ts');