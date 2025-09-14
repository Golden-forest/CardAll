/**
 * 数据迁移测试工具函数
 */

import { DataMigrationTool, MigrationSource, MigrationPlan, MigrationResult } from '@/services/data-migration-tool'
import { Card, Folder, Tag } from '@/types/card'

// 测试数据工厂
export class TestDataFactory {
  /**
   * 创建测试卡片
   */
  static createTestCard(overrides: Partial<Card> = {}): Card {
    return {
      id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      frontContent: {
        title: '测试卡片正面',
        text: '这是卡片的正面内容',
        tags: ['测试', '示例'],
        images: []
      },
      backContent: {
        title: '测试卡片背面',
        text: '这是卡片的背面内容',
        tags: ['测试', '示例'],
        images: []
      },
      folderId: 'test-folder',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides
    }
  }

  /**
   * 创建测试文件夹
   */
  static createTestFolder(overrides: Partial<Folder> = {}): Folder {
    return {
      id: `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: '测试文件夹',
      parentId: null,
      color: '#4f46e5',
      icon: 'folder',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides
    }
  }

  /**
   * 创建测试标签
   */
  static createTestTag(overrides: Partial<Tag> = {}): Tag {
    return {
      id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: '测试标签',
      color: '#ef4444',
      count: 0,
      createdAt: new Date('2024-01-01'),
      ...overrides
    }
  }

  /**
   * 创建包含图片的卡片
   */
  static createCardWithImage(overrides: Partial<Card> = {}): Card {
    const base64Image = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='

    return {
      ...this.createTestCard(overrides),
      frontContent: {
        ...this.createTestCard(overrides).frontContent,
        images: [{
          id: 'test-image',
          url: base64Image,
          alt: '测试图片',
          width: 100,
          height: 100
        }]
      }
    }
  }

  /**
   * 创建大量测试数据
   */
  static createBulkTestData(
    cardCount: number = 100,
    folderCount: number = 10,
    tagCount: number = 20
  ) {
    const folders: Folder[] = []
    const tags: Tag[] = []
    const cards: Card[] = []

    // 创建文件夹
    for (let i = 0; i < folderCount; i++) {
      folders.push(this.createTestFolder({
        id: `folder-${i}`,
        name: `测试文件夹 ${i + 1}`,
        parentId: i > 0 ? `folder-${Math.floor((i - 1) / 5)}` : null
      }))
    }

    // 创建标签
    for (let i = 0; i < tagCount; i++) {
      tags.push(this.createTestTag({
        id: `tag-${i}`,
        name: `测试标签 ${i + 1}`,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`
      }))
    }

    // 创建卡片
    for (let i = 0; i < cardCount; i++) {
      const cardTags = tags
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 3) + 1)
        .map(tag => tag.name)

      cards.push(this.createTestCard({
        id: `card-${i}`,
        folderId: folders[Math.floor(Math.random() * folders.length)].id,
        frontContent: {
          title: `测试卡片 ${i + 1}`,
          text: `这是第 ${i + 1} 个测试卡片`,
          tags: cardTags,
          images: i % 10 === 0 ? [{
            id: `image-${i}`,
            url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
            alt: `图片 ${i + 1}`,
            width: 100,
            height: 100
          }] : []
        }
      }))
    }

    return { folders, tags, cards }
  }

  /**
   * 创建损坏的测试数据
   */
  static createCorruptedTestData() {
    return {
      invalidCard: {
        id: 'invalid-card',
        frontContent: null as any, // 缺少必需字段
        backContent: { title: '', text: '' },
        createdAt: 'invalid-date' as any,
        updatedAt: new Date()
      },
      invalidFolder: {
        id: 'invalid-folder',
        name: '', // 空名称
        parentId: 'non-existent',
        color: 'invalid-color',
        icon: 'folder',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      invalidTag: {
        id: 'invalid-tag',
        name: '', // 空名称
        color: '#invalid',
        count: -1, // 负数
        createdAt: new Date()
      }
    }
  }
}

// Mock 工具
export class MockDatabase {
  private data: {
    cards: any[]
    folders: any[]
    tags: any[]
    images: any[]
    settings: any[]
    syncQueue: any[]
  } = {
    cards: [],
    folders: [],
    tags: [],
    images: [],
    settings: [],
    syncQueue: []
  }

  async clear() {
    Object.keys(this.data).forEach(key => {
      this.data[key as keyof typeof this.data] = []
    })
  }

  // 卡片操作
  async addCard(card: any) {
    this.data.cards.push({ ...card, id: card.id || `card-${Date.now()}` })
    return this.data.cards[this.data.cards.length - 1]
  }

  async getCards() {
    return this.data.cards
  }

  // 文件夹操作
  async addFolder(folder: any) {
    this.data.folders.push({ ...folder, id: folder.id || `folder-${Date.now()}` })
    return this.data.folders[this.data.folders.length - 1]
  }

  async getFolders() {
    return this.data.folders
  }

  // 标签操作
  async addTag(tag: any) {
    this.data.tags.push({ ...tag, id: tag.id || `tag-${Date.now()}` })
    return this.data.tags[this.data.tags.length - 1]
  }

  async getTags() {
    return this.data.tags
  }

  // 设置操作
  async addSetting(key: string, value: any) {
    const setting = {
      key,
      value,
      updatedAt: new Date(),
      scope: 'global'
    }
    this.data.settings.push(setting)
    return setting
  }

  async getSetting(key: string) {
    return this.data.settings.find(s => s.key === key)?.value
  }

  // 统计信息
  async getStats() {
    return {
      cards: this.data.cards.length,
      folders: this.data.folders.length,
      tags: this.data.tags.length,
      images: this.data.images.length,
      pendingSync: this.data.syncQueue.length,
      totalSize: JSON.stringify(this.data).length,
      version: '4.0.0'
    }
  }

  // 模拟数据库健康检查
  async healthCheck() {
    return {
      isHealthy: true,
      issues: []
    }
  }

  // 清空所有数据
  async clearAll() {
    await this.clear()
  }
}

// 测试辅助函数
export class MigrationTestHelpers {
  /**
   * 设置localStorage测试数据
   */
  static setupLocalStorageData(data: { cards?: Card[]; folders?: Folder[]; tags?: Tag[] }) {
    if (data.cards) {
      localStorage.setItem('cardall-cards', JSON.stringify(data.cards))
    }
    if (data.folders) {
      localStorage.setItem('cardall-folders', JSON.stringify(data.folders))
    }
    if (data.tags) {
      localStorage.setItem('cardall-tags', JSON.stringify(data.tags))
    }
    if (data.cards?.some(card => card.frontContent?.images?.length > 0)) {
      localStorage.setItem('cardall-hidden-tags', JSON.stringify(['image-test']))
    }
  }

  /**
   * 清理localStorage
   */
  static cleanupLocalStorage() {
    localStorage.removeItem('cardall-cards')
    localStorage.removeItem('cardall-folders')
    localStorage.removeItem('cardall-tags')
    localStorage.removeItem('cardall-hidden-tags')
  }

  /**
   * 模拟IndexedDB数据库
   */
  static mockIndexedDB(data: any = {}) {
    const mockDb = {
      open: jest.fn().mockResolvedValue({}),
      close: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
      cards: {
        count: jest.fn().mockResolvedValue(data.cards?.length || 0),
        toArray: jest.fn().mockResolvedValue(data.cards || []),
        bulkAdd: jest.fn().mockResolvedValue(undefined)
      },
      folders: {
        count: jest.fn().mockResolvedValue(data.folders?.length || 0),
        toArray: jest.fn().mockResolvedValue(data.folders || []),
        bulkAdd: jest.fn().mockResolvedValue(undefined)
      },
      tags: {
        count: jest.fn().mockResolvedValue(data.tags?.length || 0),
        toArray: jest.fn().mockResolvedValue(data.tags || []),
        bulkAdd: jest.fn().mockResolvedValue(undefined)
      },
      images: {
        count: jest.fn().mockResolvedValue(data.images?.length || 0),
        toArray: jest.fn().mockResolvedValue(data.images || []),
        bulkAdd: jest.fn().mockResolvedValue(undefined)
      },
      syncQueue: {
        count: jest.fn().mockResolvedValue(data.syncQueue?.length || 0),
        toArray: jest.fn().mockResolvedValue(data.syncQueue || []),
        bulkAdd: jest.fn().mockResolvedValue(undefined)
      }
    }

    // 模拟Dexie构造函数
    const OriginalDexie = (global as any).Dexie
    ;(global as any).Dexie = jest.fn().mockImplementation(() => mockDb)

    return mockDb
  }

  /**
   * 恢复原始Dexie
   */
  static restoreIndexedDB() {
    const OriginalDexie = (global as any).OriginalDexie
    if (OriginalDexie) {
      ;(global as any).Dexie = OriginalDexie
    }
  }

  /**
   * 创建迁移进度监听器
   */
  static createProgressListener() {
    const progressEvents: any[] = []
    const callback = jest.fn((progress) => {
      progressEvents.push(progress)
    })

    return {
      callback,
      getEvents: () => progressEvents,
      clearEvents: () => {
        progressEvents.length = 0
      },
      getLastEvent: () => progressEvents[progressEvents.length - 1]
    }
  }

  /**
   * 验证迁移结果
   */
  static validateMigrationResult(
    result: MigrationResult,
    expectations: {
      success?: boolean
      migratedCards?: number
      migratedFolders?: number
      migratedTags?: number
      migratedImages?: number
      hasErrors?: boolean
      hasWarnings?: boolean
    }
  ) {
    if (expectations.success !== undefined) {
      expect(result.success).toBe(expectations.success)
    }

    if (expectations.migratedCards !== undefined) {
      expect(result.migratedCards).toBe(expectations.migratedCards)
    }

    if (expectations.migratedFolders !== undefined) {
      expect(result.migratedFolders).toBe(expectations.migratedFolders)
    }

    if (expectations.migratedTags !== undefined) {
      expect(result.migratedTags).toBe(expectations.migratedTags)
    }

    if (expectations.migratedImages !== undefined) {
      expect(result.migratedImages).toBe(expectations.migratedImages)
    }

    if (expectations.hasErrors !== undefined) {
      expect(result.errors.length > 0).toBe(expectations.hasErrors)
    }

    if (expectations.hasWarnings !== undefined) {
      expect(result.warnings.length > 0).toBe(expectations.hasWarnings)
    }

    // 基本验证
    expect(result.planId).toBeDefined()
    expect(result.executedAt).toBeInstanceOf(Date)
    expect(result.duration).toBeGreaterThan(0)
    expect(result.stepsCompleted).toBeGreaterThanOrEqual(0)
    expect(result.totalSteps).toBeGreaterThan(0)
  }

  /**
   * 验证迁移计划
   */
  static validateMigrationPlan(
    plan: MigrationPlan,
    expectations: {
      sourceType?: string
      backupRequired?: boolean
      rollbackEnabled?: boolean
      minSteps?: number
      validationLevel?: string
    }
  ) {
    if (expectations.sourceType !== undefined) {
      expect(plan.source.type).toBe(expectations.sourceType)
    }

    if (expectations.backupRequired !== undefined) {
      expect(plan.backupRequired).toBe(expectations.backupRequired)
    }

    if (expectations.rollbackEnabled !== undefined) {
      expect(plan.rollbackEnabled).toBe(expectations.rollbackEnabled)
    }

    if (expectations.minSteps !== undefined) {
      expect(plan.steps.length).toBeGreaterThanOrEqual(expectations.minSteps)
    }

    if (expectations.validationLevel !== undefined) {
      expect(plan.validationLevel).toBe(expectations.validationLevel)
    }

    // 基本验证
    expect(plan.id).toBeDefined()
    expect(plan.target.version).toBe('4.0.0')
    expect(plan.target.database).toBe('CardAllUnifiedDatabase')
    expect(plan.estimatedTime).toBeGreaterThan(0)
    expect(plan.steps.length).toBeGreaterThan(0)
  }

  /**
   * 等待异步操作完成
   */
  static async waitFor(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 重试函数直到成功
   */
  static async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delay: number = 100
  ): Promise<T> {
    let lastError: Error

    for (let i = 0; i < maxAttempts; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        if (i < maxAttempts - 1) {
          await this.waitFor(delay)
        }
      }
    }

    throw lastError!
  }
}

export {
  TestDataFactory,
  MockDatabase,
  MigrationTestHelpers
}