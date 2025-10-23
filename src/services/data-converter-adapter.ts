import { Card, CardFilter, ViewSettings } from '@/types/card'
import { DbCard } from '@/services/database'
import { secureStorage } from '@/utils/secure-storage'

/**
 * 数据转换器适配器
 * 负责localStorage和IndexedDB之间的数据格式转换
 */
export class DataConverterAdapter {
  /**
   * 转换数据库卡片到前端卡片格式
   * 处理IndexedDB特有的字段和日期格式
   */
  static dbCardToCard(dbCard: DbCard): Card {
    const { userId, syncVersion, lastSyncAt, pendingSync, ...card } = dbCard

    return {
      ...card,
      id: card.id || '',
      createdAt: this.ensureDate(card.createdAt),
      updatedAt: this.ensureDate(card.updatedAt)
    }
  }

  /**
   * 转换前端卡片到数据库格式
   * 添加IndexedDB特有的同步字段
   */
  static cardToDbCard(card: Card, userId?: string): DbCard {
    return {
      id: card.id,
      frontContent: card.frontContent,
      backContent: card.backContent,
      style: card.style,
      isFlipped: card.isFlipped,
      createdAt: this.ensureDate(card.createdAt),
      updatedAt: this.ensureDate(card.updatedAt),
      userId,
      syncVersion: 1,
      pendingSync: true,
      lastSyncAt: undefined
    }
  }

  /**
   * 批量转换数据库卡片到前端格式
   */
  static bulkDbCardsToCards(dbCards: DbCard[]): Card[] {
    return dbCards.map(dbCard => this.dbCardToCard(dbCard))
  }

  /**
   * 批量转换前端卡片到数据库格式
   */
  static bulkCardsToDbCards(cards: Card[], userId?: string): DbCard[] {
    return cards.map(card => this.cardToDbCard(card, userId))
  }

  /**
   * 确保日期对象格式正确
   */
  private static ensureDate(date: Date | string | undefined): Date {
    if (!date) {
      return new Date()
    }

    if (date instanceof Date) {
      return date
    }

    try {
      return new Date(date)
    } catch {
      return new Date()
    }
  }

  /**
   * 验证卡片数据完整性
   */
  static validateCard(card: Partial<Card>): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!card.id) {
      errors.push('Card ID is required')
    }

    if (!card.frontContent?.title) {
      errors.push('Front content title is required')
    }

    if (!card.backContent?.title) {
      errors.push('Back content title is required')
    }

    if (!card.createdAt) {
      errors.push('Created date is required')
    }

    if (!card.updatedAt) {
      errors.push('Updated date is required')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 清理和标准化卡片数据
   */
  static sanitizeCard(card: Partial<Card>): Partial<Card> {
    const sanitized: Partial<Card> = {}

    // 复制基础字段
    if (card.id) sanitized.id = card.id
    if (card.frontContent) {
      sanitized.frontContent = {
        title: String(card.frontContent.title || '').trim(),
        text: String(card.frontContent.text || '').trim(),
        images: Array.isArray(card.frontContent.images) ? card.frontContent.images : [],
        tags: Array.isArray(card.frontContent.tags)
          ? card.frontContent.tags.map(tag => String(tag).trim()).filter(tag => tag.length > 0)
          : [],
        lastModified: card.frontContent.lastModified || new Date()
      }
    }

    if (card.backContent) {
      sanitized.backContent = {
        title: String(card.backContent.title || '').trim(),
        text: String(card.backContent.text || '').trim(),
        images: Array.isArray(card.backContent.images) ? card.backContent.images : [],
        tags: Array.isArray(card.backContent.tags)
          ? card.backContent.tags.map(tag => String(tag).trim()).filter(tag => tag.length > 0)
          : [],
        lastModified: card.backContent.lastModified || new Date()
      }
    }

    if (card.style) {
      sanitized.style = {
        type: card.style.type || 'solid',
        backgroundColor: card.style.backgroundColor || '#ffffff',
        fontFamily: card.style.fontFamily || 'system-ui',
        fontSize: card.style.fontSize || 'base',
        fontWeight: card.style.fontWeight || 'normal',
        textColor: card.style.textColor || '#000000',
        borderRadius: card.style.borderRadius || 'md',
        shadow: card.style.shadow || 'none',
        borderWidth: card.style.borderWidth || 0,
        gradientColors: card.style.gradientColors || undefined,
        gradientDirection: card.style.gradientDirection || 'to-r'
      }
    }

    // 移除isFlipped的持久化，使其成为纯UI状态
    // if (typeof card.isFlipped === 'boolean') {
    //   sanitized.isFlipped = card.isFlipped
    // }

    if (card.createdAt) {
      sanitized.createdAt = this.ensureDate(card.createdAt)
    }

    if (card.updatedAt) {
      sanitized.updatedAt = this.ensureDate(card.updatedAt)
    }

    return sanitized
  }

  /**
   * 从localStorage加载和转换卡片数据
   */
  static loadFromLocalStorage(): Card[] {
    try {
      const savedCards = secureStorage.get<Card[]>('cards', {
        validate: true,
        encrypt: true
      })

      if (!savedCards) {
        return []
      }

      // 清理和验证每个卡片
      const validCards: Card[] = []
      for (const card of savedCards) {
        const sanitized = this.sanitizeCard(card)
        const validation = this.validateCard(sanitized)

        if (validation.valid) {
          validCards.push(sanitized as Card)
        } else {
          console.warn('Invalid card in localStorage:', card, validation.errors)
        }
      }

      return validCards
    } catch (error) {
      console.error('Failed to load cards from localStorage:', error)
      return []
    }
  }

  /**
   * 保存卡片数据到localStorage
   */
  static saveToLocalStorage(cards: Card[]): void {
    try {
      // 清理数据
      const cleanedCards = cards.map(card => this.sanitizeCard(card)).filter(card => {
        const validation = this.validateCard(card)
        return validation.valid
      }) as Card[]

      secureStorage.set('cards', cleanedCards)
    } catch (error) {
      console.error('Failed to save cards to localStorage:', error)
      throw new Error(`Failed to save to localStorage: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 比较两个卡片数据是否相同
   */
  static areCardsEqual(card1: Card, card2: Card): boolean {
    const card1Str = JSON.stringify(this.sanitizeCard(card1))
    const card2Str = JSON.stringify(this.sanitizeCard(card2))
    return card1Str === card2Str
  }

  /**
   * 检测卡片数据的变更
   */
  static detectCardChanges(oldCards: Card[], newCards: Card[]): {
    added: Card[]
    updated: Card[]
    deleted: Card[]
  } {
    const oldMap = new Map(oldCards.map(c => [c.id, c]))
    const newMap = new Map(newCards.map(c => [c.id, c]))

    const added: Card[] = []
    const updated: Card[] = []
    const deleted: Card[] = []

    // 检测新增和更新的卡片
    for (const [id, newCard] of newMap) {
      const oldCard = oldMap.get(id)
      if (!oldCard) {
        added.push(newCard)
      } else if (!this.areCardsEqual(oldCard, newCard)) {
        updated.push(newCard)
      }
    }

    // 检测删除的卡片
    for (const [id, oldCard] of oldMap) {
      if (!newMap.has(id)) {
        deleted.push(oldCard)
      }
    }

    return { added, updated, deleted }
  }

  /**
   * 迁移数据格式
   * 处理旧版本的数据格式到新版本的转换
   */
  static migrateLegacyData(legacyData: any): Card[] {
    try {
      // 如果已经是标准格式，直接返回
      if (this.isStandardCardFormat(legacyData)) {
        return Array.isArray(legacyData) ? legacyData : [legacyData]
      }

      // 处理各种旧格式
      const migratedCards: Card[] = []

      if (Array.isArray(legacyData)) {
        for (const item of legacyData) {
          const migrated = this.migrateLegacyCard(item)
          if (migrated) {
            migratedCards.push(migrated)
          }
        }
      } else {
        const migrated = this.migrateLegacyCard(legacyData)
        if (migrated) {
          migratedCards.push(migrated)
        }
      }

      return migratedCards
    } catch (error) {
      console.error('Failed to migrate legacy data:', error)
      return []
    }
  }

  /**
   * 迁移单个旧格式卡片
   */
  private static migrateLegacyCard(legacyCard: any): Card | null {
    try {
      // 基础字段映射
      const card: Partial<Card> = {
        id: legacyCard.id || crypto.randomUUID(),
        frontContent: {
          title: legacyCard.frontTitle || legacyCard.title || '',
          text: legacyCard.frontText || legacyCard.text || '',
          images: legacyCard.frontImages || legacyCard.images || [],
          tags: legacyCard.frontTags || legacyCard.tags || [],
          lastModified: legacyCard.lastModified || new Date()
        },
        backContent: {
          title: legacyCard.backTitle || legacyCard.backTitle || '',
          text: legacyCard.backText || legacyCard.backText || '',
          images: legacyCard.backImages || [],
          tags: legacyCard.backTags || [],
          lastModified: legacyCard.lastModified || new Date()
        },
        style: legacyCard.style || {
          type: 'solid',
          backgroundColor: '#ffffff',
          fontFamily: 'system-ui',
          fontSize: 'base',
          fontWeight: 'normal',
          textColor: '#000000',
          borderRadius: 'md',
          shadow: 'none',
          borderWidth: 0
        },
        isFlipped: legacyCard.isFlipped || false,
        createdAt: this.ensureDate(legacyCard.createdAt || legacyCard.created || new Date()),
        updatedAt: this.ensureDate(legacyCard.updatedAt || legacyCard.updated || new Date())
      }

      const sanitized = this.sanitizeCard(card)
      const validation = this.validateCard(sanitized)

      return validation.valid ? (sanitized as Card) : null
    } catch (error) {
      console.error('Failed to migrate legacy card:', error)
      return null
    }
  }

  /**
   * 检查是否为标准卡片格式
   */
  private static isStandardCardFormat(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false
    }

    const requiredFields = ['id', 'frontContent', 'backContent', 'createdAt', 'updatedAt']
    return requiredFields.every(field => field in data)
  }

  /**
   * 生成卡片数据的校验和
   */
  static generateCardChecksum(card: Card): string {
    const cleanCard = this.sanitizeCard(card)
    const cardString = JSON.stringify(cleanCard)

    // 简单的校验和算法
    let hash = 0
    for (let i = 0; i < cardString.length; i++) {
      const char = cardString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }

    return Math.abs(hash).toString(16)
  }

  /**
   * 压缩卡片数据用于存储
   */
  static compressCardData(cards: Card[]): string {
    const compressed = cards.map(card => {
      const clean = this.sanitizeCard(card)
      return {
        i: clean.id, // id
        ft: clean.frontContent.title, // front title
        ftx: clean.frontContent.text, // front text
        ftg: clean.frontContent.tags, // front tags
        bt: clean.backContent.title, // back title
        btx: clean.backContent.text, // back text
        btg: clean.backContent.tags, // back tags
        s: clean.style, // style
        f: clean.isFlipped, // flipped
        ca: clean.createdAt.getTime(), // created at
        ua: clean.updatedAt.getTime() // updated at
      }
    })

    return JSON.stringify(compressed)
  }

  /**
   * 解压缩卡片数据
   */
  static decompressCardData(compressed: string): Card[] {
    try {
      const compressedData = JSON.parse(compressed)

      return compressedData.map((item: any) => ({
        id: item.i,
        frontContent: {
          title: item.ft || '',
          text: item.ftx || '',
          images: [],
          tags: item.ftg || [],
          lastModified: new Date()
        },
        backContent: {
          title: item.bt || '',
          text: item.btx || '',
          images: [],
          tags: item.btg || [],
          lastModified: new Date()
        },
        style: item.s || {
          type: 'solid',
          backgroundColor: '#ffffff',
          fontFamily: 'system-ui',
          fontSize: 'base',
          fontWeight: 'normal',
          textColor: '#000000',
          borderRadius: 'md',
          shadow: 'none',
          borderWidth: 0
        },
        isFlipped: item.f || false,
        createdAt: new Date(item.ca),
        updatedAt: new Date(item.ua)
      }))
    } catch (error) {
      console.error('Failed to decompress card data:', error)
      return []
    }
  }
}