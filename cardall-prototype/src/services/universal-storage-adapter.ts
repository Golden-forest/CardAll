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

export class UniversalStorageAdapter implements StorageAdapter {
  readonly name = 'UniversalStorageAdapter'
  readonly version = '1.0.0'

  private storageMode: 'localStorage' | 'indexeddb' = 'localStorage'
  private config: StorageConfig
  private eventListeners: Map<StorageEventType, StorageEventListener[]> = new Map()
  private readonly STORAGE_MODE_KEY = 'cardall_storage_mode'
  private readonly MIGRATION_STATUS_KEY = 'cardall_migration_status'

  constructor(config: StorageConfig = DEFAULT_STORAGE_CONFIG) {
    this.config = config
    this.initializeStorageMode()
    this.setupEventListeners()
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

  async setStorageMode(mode: 'localStorage' | 'indexeddb'): Promise<void> {
    if (this.storageMode === mode) {
      return
    }

    const oldMode = this.storageMode
    this.storageMode = mode
    this.saveStorageMode()

    // 如果切换到IndexedDB且有数据需要迁移，则自动迁移
    if (mode === 'indexeddb' && this.config.autoMigration) {
      try {
        const hasData = await this.hasDataToMigrate()
        if (hasData) {
          await this.migrateFromLocalStorage()
        }
      } catch (error) {
        console.error('Auto-migration failed:', error)
        // 迁移失败时回退到原模式
        this.storageMode = oldMode
        this.saveStorageMode()
        throw error
      }
    }
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
          data: result
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
          data: result
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
          data: finalResult
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
          data: failedResult,
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
        data: failedResult,
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
      data: backup
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
      isFlipped: card.isFlipped,
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

  async updateCards(updates: Array<{ id: string; updates: Partial<Card> }>): Promise<Card[]> {
    const results: Card[] = []

    try {
      if (this.storageMode === 'indexeddb') {
        for (const { id, updates } of updates) {
          const card = await this.updateCard(id, updates)
          results.push(card)
        }
      } else {
        const currentCards = await this.getCards()
        for (const { id, updates } of updates) {
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