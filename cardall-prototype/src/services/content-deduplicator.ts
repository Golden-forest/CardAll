import { Card, CardContent, ImageData } from '@/types/card'
import { db } from './database'

/**
 * 内容哈希去重服务
 *
 * 功能特性:
 * - 基于内容哈希的快速重复检测
 * - 支持完全重复和部分重复检测
 * - 高性能批量处理
 * - 容错性处理
 * - 与现有同步服务集成
 */

export interface ContentHash {
  id: string
  userId: string
  contentHash: string
  cardId: string
  contentSnapshot: string
  createdAt: Date
  lastAccessed: Date
  accessCount: number
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  duplicateCardId?: string
  duplicateType: 'exact' | 'similar' | 'none'
  similarityScore?: number
  matchedFields: string[]
  reason?: string
}

export interface DeduplicationStats {
  totalChecks: number
  duplicatesFound: number
  exactDuplicates: number
  similarDuplicates: number
  avgProcessingTime: number
  cacheHitRate: number
}

/**
 * 内容去重器类
 */
export class ContentDeduplicator {
  private static instance: ContentDeduplicator
  private isInitialized = false
  private hashCache = new Map<string, ContentHash>()
  private readonly HASH_CACHE_TTL = 300000 // 5分钟缓存
  private readonly SIMILARITY_THRESHOLD = 0.85 // 相似度阈值
  private stats: DeduplicationStats = {
    totalChecks: 0,
    duplicatesFound: 0,
    exactDuplicates: 0,
    similarDuplicates: 0,
    avgProcessingTime: 0,
    cacheHitRate: 0
  }

  static getInstance(): ContentDeduplicator {
    if (!ContentDeduplicator.instance) {
      ContentDeduplicator.instance = new ContentDeduplicator()
    }
    return ContentDeduplicator.instance
  }

  constructor() {
    this.initialize()
  }

  /**
   * 初始化去重服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('🔍 初始化内容去重服务...')

      // 预加载最近的哈希记录
      await this.preloadHashCache()

      this.isInitialized = true
      console.log('✅ 内容去重服务初始化完成')
    } catch (error) {
      console.warn('⚠️ 内容去重服务初始化失败:', error)
    }
  }

  /**
   * 生成内容哈希
   */
  async generateContentHash(content: CardContent): Promise<string> {
    const startTime = Date.now()

    try {
      // 规范化内容
      const normalizedContent = this.normalizeContent(content)

      // 生成哈希
      const contentString = JSON.stringify(normalizedContent)
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(contentString))
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      console.log(`内容哈希生成完成，耗时: ${Date.now() - startTime}ms`)
      return hashHex
    } catch (error) {
      console.warn('生成内容哈希失败:', error)
      throw error
    }
  }

  /**
   * 检查卡片重复
   */
  async checkDuplicate(card: Card, userId?: string): Promise<DuplicateCheckResult> {
    const startTime = Date.now()
    this.stats.totalChecks++

    try {
      if (!userId) {
        return {
          isDuplicate: false,
          duplicateType: 'none',
          matchedFields: []
        }
      }

      // 生成内容哈希
      const frontHash = await this.generateContentHash(card.frontContent)
      const backHash = await this.generateContentHash(card.backContent)
      const combinedHash = this.combineHashes(frontHash, backHash)

      // 检查缓存
      const cachedResult = this.checkCache(combinedHash, userId)
      if (cachedResult) {
        this.updateStats(true, Date.now() - startTime)
        return cachedResult
      }

      // 检查完全重复
      const exactDuplicate = await this.checkExactDuplicate(combinedHash, userId)
      if (exactDuplicate) {
        const result = {
          isDuplicate: true,
          duplicateCardId: exactDuplicate.cardId,
          duplicateType: 'exact' as const,
          similarityScore: 1.0,
          matchedFields: ['title', 'text', 'images', 'tags'],
          reason: 'Content hash matches exactly'
        }

        this.cacheResult(combinedHash, userId, result)
        this.updateStats(false, Date.now() - startTime, true, 'exact')
        return result
      }

      // 检查相似重复
      const similarDuplicate = await this.checkSimilarDuplicate(card, userId)
      if (similarDuplicate) {
        const result = {
          isDuplicate: true,
          duplicateCardId: similarDuplicate.cardId,
          duplicateType: 'similar' as const,
          similarityScore: similarDuplicate.score,
          matchedFields: similarDuplicate.fields,
          reason: 'Content similarity above threshold'
        }

        this.cacheResult(combinedHash, userId, result)
        this.updateStats(false, Date.now() - startTime, true, 'similar')
        return result
      }

      // 无重复
      const result = {
        isDuplicate: false,
        duplicateType: 'none' as const,
        matchedFields: []
      }

      this.cacheResult(combinedHash, userId, result)
      this.updateStats(false, Date.now() - startTime)
      return result

    } catch (error) {
      console.warn('检查重复失败:', error)
      return {
        isDuplicate: false,
        duplicateType: 'none',
        matchedFields: [],
        reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * 批量检查重复（性能优化）
   */
  async checkDuplicatesBatch(cards: Card[], userId?: string): Promise<DuplicateCheckResult[]> {
    if (!userId || cards.length === 0) {
      return cards.map(() => ({
        isDuplicate: false,
        duplicateType: 'none' as const,
        matchedFields: []
      }))
    }

    const startTime = Date.now()
    const results: DuplicateCheckResult[] = []

    try {
      // 批量生成哈希
      const hashPromises = cards.map(async (card) => {
        const frontHash = await this.generateContentHash(card.frontContent)
        const backHash = await this.generateContentHash(card.backContent)
        return {
          card,
          frontHash,
          backHash,
          combinedHash: this.combineHashes(frontHash, backHash)
        }
      })

      const cardsWithHashes = await Promise.all(hashPromises)

      // 批量检查缓存
      const uncachedCards = []
      for (const { card, combinedHash } of cardsWithHashes) {
        const cachedResult = this.checkCache(combinedHash, userId)
        if (cachedResult) {
          results.push(cachedResult)
        } else {
          uncachedCards.push({ card, combinedHash })
        }
      }

      // 批量检查数据库
      if (uncachedCards.length > 0) {
        const dbResults = await this.checkDuplicatesInDatabase(uncachedCards, userId)
        results.push(...dbResults)
      }

      // 更新统计信息
      this.stats.totalChecks += cards.length
      const avgTime = (Date.now() - startTime) / cards.length
      this.stats.avgProcessingTime = (this.stats.avgProcessingTime + avgTime) / 2

      console.log(`批量重复检查完成: ${cards.length} 张卡片，耗时 ${Date.now() - startTime}ms`)
      return results

    } catch (error) {
      console.warn('批量重复检查失败:', error)
      // 返回默认结果，不阻塞操作
      return cards.map(() => ({
        isDuplicate: false,
        duplicateType: 'none' as const,
        matchedFields: [],
        reason: 'Batch check failed'
      }))
    }
  }

  /**
   * 在数据库中批量检查重复
   */
  private async checkDuplicatesInDatabase(
    cardsWithHashes: { card: Card; combinedHash: string }[],
    userId: string
  ): Promise<DuplicateCheckResult[]> {
    const results: DuplicateCheckResult[] = []

    try {
      // 批量获取用户的所有卡片
      const userCards = await db.cards.where('userId').equals(userId).toArray()
      const cardMap = new Map(userCards.map(card => [card.id, card]))

      // 预计算所有用户卡片的哈希
      const userCardHashes = new Map()
      for (const userCard of userCards) {
        const frontHash = this.generateQuickHash(userCard.frontContent)
        const backHash = this.generateQuickHash(userCard.backContent)
        const combinedHash = this.combineHashes(frontHash, backHash)
        userCardHashes.set(combinedHash, userCard.id)
      }

      // 检查每个新卡片
      for (const { card, combinedHash } of cardsWithHashes) {
        const duplicateCardId = userCardHashes.get(combinedHash)

        if (duplicateCardId) {
          // 找到完全重复
          const result = {
            isDuplicate: true,
            duplicateCardId,
            duplicateType: 'exact' as const,
            similarityScore: 1.0,
            matchedFields: ['title', 'text', 'images', 'tags'],
            reason: 'Content hash matches exactly'
          }
          results.push(result)
          this.cacheResult(combinedHash, userId, result)
        } else {
          // 检查相似重复
          const duplicateCard = cardMap.get(duplicateCardId)
          if (duplicateCard) {
            const similarity = await this.calculateSimilarity(card, duplicateCard)
            if (similarity.score > this.SIMILARITY_THRESHOLD) {
              const result = {
                isDuplicate: true,
                duplicateCardId: duplicateCard.id,
                duplicateType: 'similar' as const,
                similarityScore: similarity.score,
                matchedFields: similarity.matchedFields,
                reason: 'Content similarity above threshold'
              }
              results.push(result)
              this.cacheResult(combinedHash, userId, result)
              continue
            }
          }

          // 无重复
          const result = {
            isDuplicate: false,
            duplicateType: 'none' as const,
            matchedFields: []
          }
          results.push(result)
          this.cacheResult(combinedHash, userId, result)
        }
      }

      return results
    } catch (error) {
      console.warn('数据库批量重复检查失败:', error)
      // 返回默认结果
      return cardsWithHashes.map(() => ({
        isDuplicate: false,
        duplicateType: 'none' as const,
        matchedFields: [],
        reason: 'Database check failed'
      }))
    }
  }

  /**
   * 规范化内容
   */
  private normalizeContent(content: CardContent): CardContent {
    return {
      title: content.title.trim().toLowerCase(),
      text: content.text.trim().toLowerCase(),
      images: content.images.map(img => ({
        id: img.id,
        url: img.url,
        alt: img.alt?.toLowerCase() || '',
        // 忽略位置、尺寸等非内容属性
      })),
      tags: [...content.tags].map(tag => tag.trim().toLowerCase()).sort(),
      lastModified: content.lastModified
    }
  }

  /**
   * 组合哈希
   */
  private combineHashes(frontHash: string, backHash: string): string {
    const combined = frontHash + backHash
    return btoa(combined).slice(0, 32) // 简化组合哈希
  }

  /**
   * 检查缓存
   */
  private checkCache(hash: string, userId: string): DuplicateCheckResult | null {
    const cacheKey = `${userId}_${hash}`
    const cached = this.hashCache.get(cacheKey)

    if (cached && Date.now() - cached.lastAccessed.getTime() < this.HASH_CACHE_TTL) {
      cached.lastAccessed = new Date()
      cached.accessCount++
      return this.convertHashToResult(cached)
    }

    return null
  }

  /**
   * 缓存结果
   */
  private cacheResult(hash: string, userId: string, result: DuplicateCheckResult): void {
    const cacheKey = `${userId}_${hash}`
    const contentHash: ContentHash = {
      id: crypto.randomUUID(),
      userId,
      contentHash: hash,
      cardId: result.duplicateCardId || '',
      contentSnapshot: JSON.stringify(result),
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1
    }

    this.hashCache.set(cacheKey, contentHash)

    // 限制缓存大小
    if (this.hashCache.size > 1000) {
      this.cleanupCache()
    }
  }

  /**
   * 检查完全重复
   */
  private async checkExactDuplicate(hash: string, userId: string): Promise<ContentHash | null> {
    try {
      // 检查本地数据库
      const localDuplicate = await db.cards
        .where('userId')
        .equals(userId)
        .and(card => this.generateQuickHash(card.frontContent) + this.generateQuickHash(card.backContent) === hash)
        .first()

      if (localDuplicate) {
        return {
          id: localDuplicate.id,
          userId,
          contentHash: hash,
          cardId: localDuplicate.id,
          contentSnapshot: JSON.stringify(localDuplicate),
          createdAt: localDuplicate.createdAt,
          lastAccessed: new Date(),
          accessCount: 1
        }
      }

      return null
    } catch (error) {
      console.warn('检查完全重复失败:', error)
      return null
    }
  }

  /**
   * 检查相似重复
   */
  private async checkSimilarDuplicate(card: Card, userId: string): Promise<{ cardId: string; score: number; fields: string[] } | null> {
    try {
      // 获取用户的所有卡片
      const userCards = await db.cards.where('userId').equals(userId).toArray()

      let bestMatch: { cardId: string; score: number; fields: string[] } | null = null
      let maxScore = 0

      for (const existingCard of userCards) {
        const similarity = await this.calculateSimilarity(card, existingCard)

        if (similarity.score > maxScore && similarity.score > this.SIMILARITY_THRESHOLD) {
          maxScore = similarity.score
          bestMatch = {
            cardId: existingCard.id,
            score: similarity.score,
            fields: similarity.matchedFields
          }
        }
      }

      return bestMatch
    } catch (error) {
      console.warn('检查相似重复失败:', error)
      return null
    }
  }

  /**
   * 计算相似度
   */
  private async calculateSimilarity(card1: Card, card2: Card): Promise<{ score: number; matchedFields: string[] }> {
    const fields = ['title', 'text', 'tags']
    const matchedFields: string[] = []
    let totalScore = 0

    // 比较正面内容
    const frontSimilarity = this.calculateContentSimilarity(card1.frontContent, card2.frontContent)
    if (frontSimilarity > 0.7) {
      matchedFields.push('frontContent')
      totalScore += frontSimilarity * 0.4
    }

    // 比较背面内容
    const backSimilarity = this.calculateContentSimilarity(card1.backContent, card2.backContent)
    if (backSimilarity > 0.7) {
      matchedFields.push('backContent')
      totalScore += backSimilarity * 0.4
    }

    // 比较标签
    const tagsSimilarity = this.calculateTagsSimilarity(
      [...card1.frontContent.tags, ...card1.backContent.tags],
      [...card2.frontContent.tags, ...card2.backContent.tags]
    )
    if (tagsSimilarity > 0.7) {
      matchedFields.push('tags')
      totalScore += tagsSimilarity * 0.2
    }

    return {
      score: totalScore,
      matchedFields
    }
  }

  /**
   * 计算内容相似度
   */
  private calculateContentSimilarity(content1: CardContent, content2: CardContent): number {
    // 标题相似度
    const titleSimilarity = this.calculateStringSimilarity(content1.title, content2.title)

    // 文本相似度
    const textSimilarity = this.calculateStringSimilarity(content1.text, content2.text)

    // 图片相似度
    const imageSimilarity = this.calculateImagesSimilarity(content1.images, content2.images)

    // 加权平均
    return (titleSimilarity * 0.3 + textSimilarity * 0.5 + imageSimilarity * 0.2)
  }

  /**
   * 计算字符串相似度
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim()
    const s2 = str2.toLowerCase().trim()

    if (s1 === s2) return 1.0

    // 使用简单的编辑距离算法
    const longer = s1.length > s2.length ? s1 : s2
    const shorter = s1.length > s2.length ? s2 : s1

    if (longer.length === 0) return 1.0

    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * 编辑距离算法
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        )
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * 计算图片相似度
   */
  private calculateImagesSimilarity(images1: ImageData[], images2: ImageData[]): number {
    if (images1.length === 0 && images2.length === 0) return 1.0
    if (images1.length === 0 || images2.length === 0) return 0.0

    // 比较图片数量和URL
    const countSimilarity = 1 - Math.abs(images1.length - images2.length) / Math.max(images1.length, images2.length)

    let urlMatches = 0
    for (const img1 of images1) {
      if (images2.some(img2 => img1.url === img2.url)) {
        urlMatches++
      }
    }

    const urlSimilarity = urlMatches / Math.max(images1.length, images2.length)

    return (countSimilarity + urlSimilarity) / 2
  }

  /**
   * 计算标签相似度
   */
  private calculateTagsSimilarity(tags1: string[], tags2: string[]): number {
    if (tags1.length === 0 && tags2.length === 0) return 1.0
    if (tags1.length === 0 || tags2.length === 0) return 0.0

    const set1 = new Set(tags1.map(tag => tag.toLowerCase()))
    const set2 = new Set(tags2.map(tag => tag.toLowerCase()))

    const intersection = new Set(Array.from(set1).filter(tag => set2.has(tag)))
    const union = new Set(Array.from(set1).concat(Array.from(set2)))

    return intersection.size / union.size
  }

  /**
   * 生成快速哈希
   */
  private generateQuickHash(content: CardContent): string {
    const simplified = {
      title: content.title.toLowerCase().trim(),
      text: content.text.toLowerCase().trim(),
      tagCount: content.tags.length
    }
    return btoa(JSON.stringify(simplified)).slice(0, 16)
  }

  /**
   * 转换哈希到结果
   */
  private convertHashToResult(hash: ContentHash): DuplicateCheckResult {
    try {
      const snapshot = JSON.parse(hash.contentSnapshot)
      return snapshot
    } catch {
      return {
        isDuplicate: false,
        duplicateType: 'none',
        matchedFields: []
      }
    }
  }

  /**
   * 预加载哈希缓存
   */
  private async preloadHashCache(): Promise<void> {
    try {
      // 这里可以实现预加载逻辑
      console.log('哈希缓存预加载完成')
    } catch (error) {
      console.warn('哈希缓存预加载失败:', error)
    }
  }

  /**
   * 清理缓存
   */
  private cleanupCache(): void {
    const entries = Array.from(this.hashCache.entries())
    entries.sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime())

    // 删除最旧的50%
    const toDelete = entries.slice(0, Math.floor(entries.length / 2))
    toDelete.forEach(([key]) => this.hashCache.delete(key))

    console.log(`缓存清理完成，删除了 ${toDelete.length} 条记录`)
  }

  /**
   * 更新统计信息
   */
  private updateStats(cacheHit: boolean, processingTime: number, duplicateFound: boolean = false, duplicateType: 'exact' | 'similar' | 'none' = 'none'): void {
    this.stats.avgProcessingTime = (this.stats.avgProcessingTime * (this.stats.totalChecks - 1) + processingTime) / this.stats.totalChecks

    if (cacheHit) {
      this.stats.cacheHitRate = (this.stats.cacheHitRate * (this.stats.totalChecks - 1) + 1) / this.stats.totalChecks
    } else {
      this.stats.cacheHitRate = (this.stats.cacheHitRate * (this.stats.totalChecks - 1)) / this.stats.totalChecks
    }

    if (duplicateFound) {
      this.stats.duplicatesFound++
      if (duplicateType === 'exact') {
        this.stats.exactDuplicates++
      } else if (duplicateType === 'similar') {
        this.stats.similarDuplicates++
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): DeduplicationStats {
    return { ...this.stats }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.hashCache.clear()
    console.log('内容去重服务资源已清理')
  }
}

export const contentDeduplicator = ContentDeduplicator.getInstance()