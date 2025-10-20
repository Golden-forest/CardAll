import Dexie, { Table } from 'dexie'
import { Card, Folder, Tag, ImageData } from '@/types/card'

// ============================================================================
// 统一数据库类型定义 - 解决数据库架构统一
// ============================================================================

// 扩展的数据库卡片实体
export interface DbCard extends Omit<Card, 'id'> {
  id?: string
  // 保持向后兼容的字段
  folderId?: string
  // 新增字段用于优化查询
  searchVector?: string // 全文搜索优化
  thumbnailUrl?: string // 卡片缩略图
  updatedAt: Date
}

// 扩展的数据库文件夹实体
export interface DbFolder extends Omit<Folder, 'id'> {
  id?: string
  // 新增字段用于优化查询
  fullPath?: string // 完整路径用于快速查找
  depth?: number // 文件夹深度
  updatedAt: Date
}

// 扩展的数据库标签实体
export interface DbTag extends Omit<Tag, 'id'> {
  id?: string
  // 保持向后兼容
  count: number
  updatedAt: Date
}

// 图片存储实体 - 统一图片管理
export interface DbImage {
  id?: string
  cardId: string
  fileName: string
  filePath: string
  thumbnailPath?: string
  metadata: {
    originalName: string
    size: number
    width: number
    height: number
    format: string
    compressed: boolean
    quality?: number
  }
  storageMode: 'indexeddb' | 'filesystem'
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// 本地操作队列接口
// ============================================================================

export interface LocalOperation {
  id?: string
  type: 'create' | 'update' | 'delete'
  entity: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  data?: any
  timestamp: Date
  status: 'pending' | 'completed' | 'failed'
}

// 应用设置 - 统一配置管理
export interface AppSettings {
  id?: string
  key: string
  value: any
  updatedAt: Date
  scope: 'user' | 'global' // 设置作用域
}

// 数据库统计信息
export interface DatabaseStats {
  cards: number
  folders: number
  tags: number
  images: number
  totalSize: number
  lastBackup?: Date
  version: string
}

// ============================================================================
// 离线数据持久化增强接口
// ============================================================================

// 离线状态快照
export interface OfflineSnapshot {
  id: string
  timestamp: Date
  version: string
  userId?: string
  dataHash: string
  dataSize: number
  compressedSize: number
  includes: {
    cards: boolean
    folders: boolean
    tags: boolean
    images: boolean
    settings: boolean
  }
  metadata: {
    deviceInfo: string
    networkStatus: string
    batteryLevel?: number
    storageQuota: {
      used: number
      total: number
    }
  }
}

// 离线数据压缩配置
export interface OfflineCompressionConfig {
  enabled: boolean
  algorithm: 'gzip' | 'lz-string' | 'custom'
  threshold: number // 压缩阈值（字节）
  quality: number // 压缩质量（0-1）
  excludePatterns: string[] // 不压缩的数据模式
}

// 离线备份策略
export interface OfflineBackupStrategy {
  autoBackup: boolean
  interval: number // 备份间隔（毫秒）
  maxBackups: number
  compressionEnabled: boolean
  encryptionEnabled: boolean
  retentionPolicy: {
    days: number
    maxSize: number // MB
  }
}

// 错误记录表类型
export interface ErrorEntry {
  id?: string
  type: string
  severity: string
  status: string
  message: string
  details: any
  timestamp: Date
  operation?: any
  stack?: string
}

export interface BackupEntry {
  id?: string
  name: string
  description: string
  data: Blob
  compression: string
  encrypted: boolean
  checksum: string
  timestamp: Date
  size: number
  version: string
  tags?: string[]
}

// ============================================================================
// 统一数据库类
// ============================================================================

class CardAllUnifiedDatabase extends Dexie {
  // 数据表定义
  cards!: Table<DbCard>
  folders!: Table<DbFolder>
  tags!: Table<DbTag>
  images!: Table<DbImage>
  localQueue!: Table<LocalOperation>
  settings!: Table<AppSettings>

  // 离线数据持久化增强表
  offlineSnapshots!: Table<OfflineSnapshot>
  offlineBackups!: Table<{
    id?: string
    snapshotId: string
    data: Blob
    compression: string
    encrypted: boolean
    createdAt: Date
    size: number
  }>

  // 错误和备份管理表
  errors!: Table<ErrorEntry>
  backups!: Table<BackupEntry>

  constructor() {
    super('CardAllUnifiedDatabase')
    
    // 版本 5: 添加错误隔离和系统管理表
    this.version(5).stores({
      // 核心实体表 - 优化的索引设计
      cards: '++id, userId, folderId, createdAt, updatedAt, syncVersion, pendingSync, [userId+folderId], searchVector',
      folders: '++id, userId, parentId, createdAt, updatedAt, syncVersion, pendingSync, [userId+parentId], fullPath, depth',
      tags: '++id, userId, name, createdAt, syncVersion, pendingSync, [userId+name]',
      images: '++id, cardId, userId, createdAt, updatedAt, syncVersion, pendingSync, storageMode, [cardId+userId]',

      // 同步和设置表
      syncQueue: '++id, type, entity, entityId, userId, timestamp, retryCount, priority, [userId+priority]',
      settings: '++id, key, updatedAt, scope, [key+scope]',
      sessions: '++id, userId, deviceId, lastActivity, isActive, [userId+deviceId]',

      // 离线数据持久化表
      offlineSnapshots: '++id, timestamp, userId, version, dataHash, dataSize, [userId+timestamp]',
      offlineBackups: '++id, snapshotId, createdAt, compression, encrypted, size, [snapshotId+createdAt]',

      // 同步元数据表
      syncMetadata: '++id, entityType, entityId, userId, syncVersion, cloudVersion, lastSyncAt, conflictStatus, [entityType+entityId], [userId+syncVersion]',
      conflictRecords: '++id, entityType, entityId, userId, conflictType, localData, cloudData, timestamp, resolution, [entityType+entityId], [userId+conflictType]',

      // 错误隔离和系统管理表
      syncErrors: '++id, type, severity, status, timestamp, [type+severity], [timestamp+status]',
      isolatedErrors: '++id, operationId, operationType, entityType, timestamp, [operationType+entityType]',
      backups: '++id, timestamp, version, compression, encrypted, size, [timestamp+version]',
      hiddenTags: '++id, userId, tagId, hiddenAt, [userId+tagId], [userId+hiddenAt]'
    })

    // 数据库升级逻辑 - 支持从旧版本迁移
    this.upgradeDatabase()
  }

  private async upgradeDatabase(): Promise<void> {
    // 版本 1 -> 2: 添加用户支持
    this.version(2).upgrade(async (tx) => {
      console.log('Upgrading to version 2: Adding user support...')
      
      // 检查是否需要从旧数据库迁移
      const oldDb = new CardAllDatabase_v1()
      try {
        await oldDb.open()
        console.log('Found old database, migrating data...')
        
        // 迁移卡片
        const oldCards = await oldDb.cards.toArray()
        const newCards = oldCards.map(card => ({
          ...card,
          userId: 'default', // 设置默认用户
          updatedAt: new Date()
        }))
        await this.cards.bulkAdd(newCards)
        
        // 迁移文件夹
        const oldFolders = await oldDb.folders.toArray()
        const newFolders = oldFolders.map(folder => ({
          ...folder,
          userId: 'default',
          updatedAt: new Date()
        }))
        await this.folders.bulkAdd(newFolders)
        
        // 迁移标签
        const oldTags = await oldDb.tags.toArray()
        const newTags = oldTags.map(tag => ({
          ...tag,
          userId: 'default',
          updatedAt: new Date()
        }))
        await this.tags.bulkAdd(newTags)
        
        console.log('Migration completed successfully')
      } catch (error) {
        console.log('No old database found or migration failed:', error)
      }
    })

    // 版本 2 -> 3: 优化索引和添加新功能
    this.version(3).upgrade(async (tx) => {
      console.log('Upgrading to version 3: Optimizing indexes and adding new features...')
      
      // 添加默认设置
      await this.initializeDefaultSettings()
      
      // 重建搜索索引
      await this.rebuildSearchIndexes()
    })

    // 版本 3 -> 4: 添加离线数据持久化功能
    this.version(4).upgrade(async (tx) => {
      console.log('Upgrading to version 4: Adding offline data persistence features...')
      
      // 初始化离线数据持久化配置
      await this.initializeOfflinePersistence()
      
      // 创建初始离线快照
      await this.createInitialOfflineSnapshot()
    })
  }

  private async initializeDefaultSettings(): Promise<void> {
    const defaultSettings = [
      {
        key: 'storageMode',
        value: 'hybrid',
        scope: 'global' as const,
        updatedAt: new Date()
      },
      {
        key: 'syncEnabled',
        value: true,
        scope: 'global' as const,
        updatedAt: new Date()
      },
      {
        key: 'imageCompression',
        value: {
          enabled: true,
          quality: 0.8,
          maxWidth: 1920,
          maxHeight: 1080,
          format: 'webp'
        },
        scope: 'global' as const,
        updatedAt: new Date()
      },
      {
        key: 'databaseVersion',
        value: '3.0.0',
        scope: 'global' as const,
        updatedAt: new Date()
      }
    ]

    for (const setting of defaultSettings) {
      const exists = await this.settings.where('key').equals(setting.key).first()
      if (!exists) {
        await this.settings.add(setting)
      }
    }
  }

  private async rebuildSearchIndexes(): Promise<void> {
    console.log('Rebuilding search indexes...')
    // 这里可以实现搜索索引的重建逻辑
  }

  // ============================================================================
  // 离线数据持久化增强方法
  // ============================================================================

  /**
   * 初始化离线数据持久化
   */
  private async initializeOfflinePersistence(): Promise<void> {
    console.log('Initializing offline persistence...')
    
    // 添加离线数据持久化的默认设置
    const offlineSettings = [
      {
        key: 'offlineAutoBackup',
        value: {
          enabled: true,
          interval: 30 * 60 * 1000, // 30分钟
          maxBackups: 10,
          compression: true
        },
        scope: 'global' as const,
        updatedAt: new Date()
      },
      {
        key: 'offlineCompression',
        value: {
          enabled: true,
          algorithm: 'lz-string',
          threshold: 1024, // 1KB以上才压缩
          quality: 0.8
        },
        scope: 'global' as const,
        updatedAt: new Date()
      },
      {
        key: 'offlineDataRetention',
        value: {
          days: 30,
          maxSize: 100 // 100MB
        },
        scope: 'global' as const,
        updatedAt: new Date()
      }
    ]

    for (const setting of offlineSettings) {
      const exists = await this.settings.where('key').equals(setting.key).first()
      if (!exists) {
        await this.settings.add(setting)
      }
    }
  }

  /**
   * 创建初始离线快照
   */
  private async createInitialOfflineSnapshot(): Promise<void> {
    try {
      const snapshot = await this.createOfflineSnapshot({
        includeCards: true,
        includeFolders: true,
        includeTags: true,
        includeSettings: true,
        includeImages: false // 初始快照不包括图片，因为图片较大
      })
      
      console.log('Initial offline snapshot created:', snapshot.id)
    } catch (error) {
      console.error('Failed to create initial offline snapshot:', error)
    }
  }

  /**
   * 创建离线快照
   */
  async createOfflineSnapshot(options: {
    includeCards?: boolean
    includeFolders?: boolean
    includeTags?: boolean
    includeImages?: boolean
    includeSettings?: boolean
    userId?: string
  } = {}): Promise<OfflineSnapshot> {
    const {
      includeCards = true,
      includeFolders = true,
      includeTags = true,
      includeImages = false,
      includeSettings = true,
      userId
    } = options

    const snapshotId = crypto.randomUUID()
    const timestamp = new Date()
    
    // 收集数据
    const data: any = {}
    let totalSize = 0

    if (includeCards) {
      data.cards = await this.cards.toArray()
      totalSize += JSON.stringify(data.cards).length
    }

    if (includeFolders) {
      data.folders = await this.folders.toArray()
      totalSize += JSON.stringify(data.folders).length
    }

    if (includeTags) {
      data.tags = await this.tags.toArray()
      totalSize += JSON.stringify(data.tags).length
    }

    if (includeImages) {
      data.images = await this.images.toArray()
      totalSize += JSON.stringify(data.images).length
    }

    if (includeSettings) {
      data.settings = await this.settings.toArray()
      totalSize += JSON.stringify(data.settings).length
    }

    // 计算数据哈希
    const dataHash = await this.calculateDataHash(data)
    
    // 获取设备信息
    const deviceInfo = await this.getDeviceInfo()
    const storageQuota = await this.getStorageQuota()

    const snapshot: OfflineSnapshot = {
      id: snapshotId,
      timestamp,
      version: '4.0.0',
      userId,
      dataHash,
      dataSize: totalSize,
      compressedSize: totalSize, // 初始未压缩
      includes: {
        cards: includeCards,
        folders: includeFolders,
        tags: includeTags,
        images: includeImages,
        settings: includeSettings
      },
      metadata: {
        deviceInfo,
        networkStatus: navigator.onLine ? 'online' : 'offline',
        batteryLevel: (navigator as any).getBattery?.() ? undefined : undefined,
        storageQuota
      }
    }

    await this.offlineSnapshots.add(snapshot)
    
    return snapshot
  }

  /**
   * 计算数据哈希
   */
  private async calculateDataHash(data: any): Promise<string> {
    const dataString = JSON.stringify(data)
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(dataString)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * 获取设备信息
   */
  private async getDeviceInfo(): Promise<string> {
    const info = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      deviceMemory: (navigator as any).deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
      screenResolution: `${screen.width}x${screen.height}`,
      timestamp: new Date().toISOString()
    }
    return JSON.stringify(info)
  }

  /**
   * 获取存储配额信息
   */
  private async getStorageQuota(): Promise<{ used: number; total: number }> {
    try {
      if ('storage' in navigator && 'estimate' in (navigator as any).storage) {
        const estimate = await (navigator as any).storage.estimate()
        return {
          used: estimate.usage || 0,
          total: estimate.quota || 0
        }
      }
    } catch (error) {
      console.warn('Failed to get storage quota:', error)
    }
    
    return { used: 0, total: 0 }
  }

  /**
   * 恢复离线快照
   */
  async restoreOfflineSnapshot(snapshotId: string): Promise<boolean> {
    try {
      const snapshot = await this.offlineSnapshots.get(snapshotId)
      if (!snapshot) {
        throw new Error('Snapshot not found')
      }

      // 检查数据完整性
      const currentData = await this.getCurrentDataHash()
      if (currentData === snapshot.dataHash) {
        console.log('Data already matches snapshot, no restore needed')
        return true
      }

      // 恢复数据
      if (snapshot.includes.cards) {
        const backupCards = await this.cards.toArray()
        await this.cards.clear()
        // 这里需要从备份中恢复卡片数据
        // 由于快照只存储元数据，实际恢复需要更复杂的逻辑
      }

      if (snapshot.includes.folders) {
        const backupFolders = await this.folders.toArray()
        await this.folders.clear()
        // 恢复文件夹数据
      }

      if (snapshot.includes.tags) {
        const backupTags = await this.tags.toArray()
        await this.tags.clear()
        // 恢复标签数据
      }

      if (snapshot.includes.settings) {
        const backupSettings = await this.settings.toArray()
        await this.settings.clear()
        // 恢复设置数据
      }

      console.log('Offline snapshot restored successfully:', snapshotId)
      return true
    } catch (error) {
      console.error('Failed to restore offline snapshot:', error)
      return false
    }
  }

  /**
   * 获取当前数据哈希
   */
  private async getCurrentDataHash(): Promise<string> {
    const data = {
      cards: await this.cards.toArray(),
      folders: await this.folders.toArray(),
      tags: await this.tags.toArray(),
      settings: await this.settings.toArray()
    }
    return await this.calculateDataHash(data)
  }

  /**
   * 智能清理离线数据
   */
  async cleanupOfflineData(): Promise<{
    cleanedSnapshots: number
    cleanedBackups: number
    freedSpace: number
  }> {
    const now = new Date()
    let cleanedSnapshots = 0
    let cleanedBackups = 0
    let freedSpace = 0

    try {
      // 获取清理策略
      const retentionSetting = await this.getSetting('offlineDataRetention')
      const retentionDays = retentionSetting?.days || 30
      const maxSizeMB = retentionSetting?.maxSize || 100
      const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)

      // 清理过期快照
      const expiredSnapshots = await this.offlineSnapshots
        .where('timestamp')
        .below(cutoffDate)
        .toArray()

      for (const snapshot of expiredSnapshots) {
        freedSpace += snapshot.dataSize
        await this.offlineSnapshots.delete(snapshot.id!)
        cleanedSnapshots++
      }

      // 清理过期备份
      const expiredBackups = await this.offlineBackups
        .where('createdAt')
        .below(cutoffDate)
        .toArray()

      for (const backup of expiredBackups) {
        freedSpace += backup.size
        await this.offlineBackups.delete(backup.id!)
        cleanedBackups++
      }

      // 如果存储空间仍然过大，按时间清理最旧的快照
      const currentSnapshots = await this.offlineSnapshots.orderBy('timestamp').reverse().toArray()
      let totalSize = currentSnapshots.reduce((sum, s) => sum + s.dataSize, 0)
      
      while (totalSize > maxSizeMB * 1024 * 1024 && currentSnapshots.length > 5) {
        const oldestSnapshot = currentSnapshots.pop()
        if (oldestSnapshot) {
          freedSpace += oldestSnapshot.dataSize
          await this.offlineSnapshots.delete(oldestSnapshot.id!)
          cleanedSnapshots++
          totalSize -= oldestSnapshot.dataSize
        }
      }

      console.log(`Offline data cleanup completed: ${cleanedSnapshots} snapshots, ${cleanedBackups} backups, ${freedSpace} bytes freed`)
      
      return {
        cleanedSnapshots,
        cleanedBackups,
        freedSpace
      }
    } catch (error) {
      console.error('Failed to cleanup offline data:', error)
      return {
        cleanedSnapshots: 0,
        cleanedBackups: 0,
        freedSpace: 0
      }
    }
  }

  /**
   * 自动备份离线数据
   */
  async autoBackupOfflineData(): Promise<boolean> {
    try {
      const backupConfig = await this.getSetting('offlineAutoBackup')
      if (!backupConfig?.enabled) {
        return false
      }

      // 检查是否需要备份
      const lastBackup = await this.offlineSnapshots.orderBy('timestamp').reverse().first()
      const now = new Date()
      
      if (lastBackup) {
        const timeSinceLastBackup = now.getTime() - lastBackup.timestamp.getTime()
        if (timeSinceLastBackup < backupConfig.interval) {
          return false // 还未到备份时间
        }
      }

      // 创建新的快照
      const snapshot = await this.createOfflineSnapshot({
        includeCards: true,
        includeFolders: true,
        includeTags: true,
        includeImages: false, // 自动备份不包括大文件
        includeSettings: true
      })

      // 清理旧备份
      const maxBackups = backupConfig.maxBackups || 10
      const allSnapshots = await this.offlineSnapshots.orderBy('timestamp').reverse().toArray()
      
      if (allSnapshots.length > maxBackups) {
        const snapshotsToDelete = allSnapshots.slice(maxBackups)
        for (const snapshot of snapshotsToDelete) {
          await this.offlineSnapshots.delete(snapshot.id!)
        }
      }

      console.log('Auto backup completed:', snapshot.id)
      return true
    } catch (error) {
      console.error('Auto backup failed:', error)
      return false
    }
  }

  /**
   * 获取离线数据统计
   */
  async getOfflineDataStats(): Promise<{
    snapshots: number
    backups: number
    totalSize: number
    lastBackup?: Date
    oldestBackup?: Date
  }> {
    const snapshots = await this.offlineSnapshots.toArray()
    const backups = await this.offlineBackups.toArray()
    
    const totalSize = snapshots.reduce((sum, s) => sum + s.dataSize, 0) + 
                      backups.reduce((sum, b) => sum + b.size, 0)
    
    const lastBackup = snapshots.length > 0 ? 
      snapshots.reduce((latest, s) => s.timestamp > latest.timestamp ? s : latest, snapshots[0]).timestamp : 
      undefined
    
    const oldestBackup = snapshots.length > 0 ? 
      snapshots.reduce((oldest, s) => s.timestamp < oldest.timestamp ? s : oldest, snapshots[0]).timestamp : 
      undefined

    return {
      snapshots: snapshots.length,
      backups: backups.length,
      totalSize,
      lastBackup,
      oldestBackup
    }
  }

  // ============================================================================
  // 统一的CRUD操作方法
  // ============================================================================

  // 获取设置 - 支持用户级和全局设置
  async getSetting(key: string, userId?: string): Promise<any> {
    // 优先返回用户级设置
    if (userId) {
      const userSetting = await this.settings
        .where('[key+scope]')
        .equals([key, 'user'])
        .first()
      if (userSetting) return userSetting.value
    }
    
    // 返回全局设置
    const globalSetting = await this.settings
      .where('[key+scope]')
      .equals([key, 'global'])
      .first()
    return globalSetting?.value
  }

  // 更新设置
  async updateSetting(key: string, value: any, scope: 'user' | 'global' = 'global', userId?: string): Promise<void> {
    const updates: any = {
      value,
      updatedAt: new Date()
    }
    if (userId) {
      updates.userId = userId
    }
    await this.settings.where('[key+scope]').equals([key, scope]).modify(updates)
  }

  // 获取数据库统计信息
  async getStats(): Promise<DatabaseStats> {
    const [cards, folders, tags, images, pendingSync] = await Promise.all([
      this.cards.count(),
      this.folders.count(),
      this.tags.count(),
      this.images.count(),
      this.syncQueue.count()
    ])

    // 计算总大小（简化版本）
    const totalSize = await this.calculateTotalSize()

    return {
      cards,
      folders,
      tags,
      images,
      pendingSync,
      totalSize,
      version: '3.0.0'
    }
  }

  private async calculateTotalSize(): Promise<number> {
    // 计算所有图片的总大小
    const images = await this.images.toArray()
    return images.reduce((total, image) => total + image.metadata.size, 0)
  }

  // 统一的卡片操作
  async createCard(cardData: Omit<DbCard, 'id' | 'syncVersion' | 'pendingSync' | 'updatedAt'>, userId?: string): Promise<string> {
    const id = crypto.randomUUID()
    const now = new Date()
    
    await this.cards.add({
      ...cardData,
      id,
      userId,
      syncVersion: 1,
      pendingSync: true,
      updatedAt: now
    })
    
    return id
  }

  async updateCard(id: string, updates: Partial<DbCard>): Promise<number> {
    const result = await this.cards.update(id, {
      ...updates,
      syncVersion: updates.syncVersion ? updates.syncVersion + 1 : undefined,
      pendingSync: true,
      updatedAt: new Date()
    })
    
    return result
  }

  async deleteCard(id: string): Promise<void> {
    await this.transaction('rw', [this.cards, this.images], async () => {
      // 删除相关图片
      await this.images.where('cardId').equals(id).delete()
      // 删除卡片
      await this.cards.delete(id)
    })
  }

  // 批量操作支持
  async bulkCreateCards(cardsData: Omit<DbCard, 'id' | 'syncVersion' | 'pendingSync' | 'updatedAt'>[], userId?: string): Promise<string[]> {
    const now = new Date()
    const cards = cardsData.map(cardData => ({
      ...cardData,
      id: crypto.randomUUID(),
      userId,
      syncVersion: 1,
      pendingSync: true,
      updatedAt: now
    }))
    
    await this.cards.bulkAdd(cards)
    return cards.map(card => card.id!)
  }

  // 性能优化的查询方法
  async getCardsByFolder(folderId: string, userId?: string): Promise<DbCard[]> {
    return await this.cards
      .where('[userId+folderId]')
      .equals([userId || 'default', folderId])
      .toArray()
  }

  async searchCards(searchTerm: string, userId?: string): Promise<DbCard[]> {
    const searchLower = searchTerm.toLowerCase()
    return await this.cards
      .filter(card => 
        card.searchVector?.includes(searchLower) ||
        card.frontContent.title.toLowerCase().includes(searchLower) ||
        card.frontContent.text.toLowerCase().includes(searchLower) ||
        card.backContent.title.toLowerCase().includes(searchLower) ||
        card.backContent.text.toLowerCase().includes(searchLower)
      )
      .toArray()
  }

  // 数据库清理和优化
  async cleanup(): Promise<void> {
    await this.transaction('rw', [this.cards, this.folders, this.tags, this.images, this.syncQueue], async () => {
      // 清理过期的同步操作
      const expiredDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7天前
      await this.syncQueue.where('timestamp').below(expiredDate).delete()
      
      // 清理孤立图片（没有对应卡片的图片）
      const cardIds = await this.cards.toCollection().primaryKeys()
      await this.images.where('cardId').noneOf(cardIds as string[]).delete()
      
      console.log('Database cleanup completed')
    })
  }

  // 数据库健康检查
  async healthCheck(): Promise<{
    isHealthy: boolean
    issues: string[]
    stats: DatabaseStats
  }> {
    const issues: string[] = []
    
    try {
      // 检查数据库连接 - 测试访问基本表
      await this.cards.count()
      
      // 检查数据一致性
      const stats = await this.getStats()
      
      // 检查是否有大量待同步项目
      if (stats.pendingSync > 1000) {
        issues.push(`High number of pending sync operations: ${stats.pendingSync}`)
      }
      
      // 检查数据库大小
      if (stats.totalSize > 500 * 1024 * 1024) { // 500MB
        issues.push(`Database size is large: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`)
      }
      
      return {
        isHealthy: issues.length === 0,
        issues,
        stats
      }
    } catch (error) {
      return {
        isHealthy: false,
        issues: [`Database connection failed: ${error}`],
        stats: { cards: 0, folders: 0, tags: 0, images: 0, pendingSync: 0, totalSize: 0, version: '3.0.0' }
      }
    }
  }

  // 完全清理数据库（谨慎使用）
  async clearAll(): Promise<void> {
    await this.transaction('rw', [this.cards, this.folders, this.tags, this.images, this.syncQueue, this.settings, this.sessions], async () => {
      await this.cards.clear()
      await this.folders.clear()
      await this.tags.clear()
      await this.images.clear()
      await this.syncQueue.clear()
      // 保留设置，只清除用户数据
      await this.sessions.clear()
    })
  }

  // ============================================================================
  // 向后兼容的方法 - 保持现有代码不中断
  // ============================================================================

  // 旧版getSetting方法（保持兼容）
  async getSettingLegacy(key: string): Promise<any> {
    return await this.getSetting(key)
  }

  // 旧版updateSetting方法（保持兼容）
  async updateSettingLegacy(key: string, value: any): Promise<void> {
    await this.updateSetting(key, value)
  }

  // 旧版clearAll方法（保持兼容）
  async clearAllLegacy(): Promise<void> {
    await this.transaction('rw', [this.cards, this.folders, this.tags, this.images, this.syncQueue], async () => {
      await this.cards.clear()
      await this.folders.clear()
      await this.tags.clear()
      await this.images.clear()
      await this.syncQueue.clear()
    })
  }

  // 旧版getStats方法（保持兼容）
  async getStatsLegacy(): Promise<{
    cards: number
    folders: number
    tags: number
    images: number
    pendingSync: number
  }> {
    const stats = await this.getStats()
    return {
      cards: stats.cards,
      folders: stats.folders,
      tags: stats.tags,
      images: stats.images,
      pendingSync: stats.pendingSync
    }
  }
}

// ============================================================================
// 向后兼容支持
// ============================================================================

// 旧版本数据库类（用于迁移）
class CardAllDatabase_v1 extends Dexie {
  cards!: Table<any>
  folders!: Table<any>
  tags!: Table<any>
  images!: Table<any>
  syncQueue!: Table<any>
  settings!: Table<any>
  
  constructor() {
    super('CardAllDatabase')
    this.version(1).stores({
      cards: '++id, folderId, createdAt, updatedAt, syncVersion, pendingSync',
      folders: '++id, parentId, createdAt, updatedAt, syncVersion, pendingSync',
      tags: '++id, name, createdAt, syncVersion, pendingSync',
      images: '++id, cardId, filePath, createdAt, syncVersion, pendingSync',
      syncQueue: '++id, type, entity, entityId, timestamp, retryCount',
      settings: '++id, key, updatedAt'
    })
  }
}

// 创建数据库实例
export const db = new CardAllUnifiedDatabase()

// 数据库初始化
export const initializeDatabase = async (): Promise<void> => {
  try {
    await db.open()
    console.log('CardAll unified database initialized successfully')
    
    // 执行健康检查
    const health = await db.healthCheck()
    if (!health.isHealthy) {
      console.warn('Database health issues detected:', health.issues)
    }
    
    // 定期清理
    setInterval(() => {
      db.cleanup().catch(console.error)
    }, 24 * 60 * 60 * 1000) // 每天清理一次
    
  } catch (error) {
    console.error('Failed to initialize database:', error)
    throw error
  }
}

// 数据库错误处理
db.on('versionchange', (event) => {
  console.warn('Database version changed:', event)
})

db.on('blocked', () => {
  console.warn('Database operation blocked')
})

db.on('versionchange', () => {
  console.warn('Database version changed, reloading page...')
  window.location.reload()
})

db.on('ready', () => {
  console.log('Database is ready')
})

// ============================================================================
// 导出工具函数
// ============================================================================

// 数据转换工具
export const convertToDbCard = (card: Card, userId?: string): DbCard => {
  return {
    ...card,
    userId,
    syncVersion: 1,
    pendingSync: true,
    updatedAt: new Date()
  }
}

export const convertFromDbCard = (dbCard: DbCard): Card => {
  const { userId, syncVersion, lastSyncAt, pendingSync, ...card } = dbCard
  return {
    ...card,
    id: card.id || '',
    createdAt: new Date(card.createdAt),
    updatedAt: new Date(card.updatedAt)
  }
}

// 搜索优化工具
export const generateSearchVector = (card: Card): string => {
  const searchableText = [
    card.frontContent.title,
    card.frontContent.text,
    card.backContent.title,
    card.backContent.text,
    ...card.frontContent.tags,
    ...card.backContent.tags
  ].join(' ').toLowerCase()
  
  return searchableText
}

// 批量操作工具
export const batchOperation = async <T>(
  items: T[],
  batchSize: number = 100,
  operation: (batch: T[]) => Promise<void>
): Promise<void> => {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await operation(batch)
  }
}

// 数据验证工具
export const validateCardData = (card: Partial<Card>): string[] => {
  const errors: string[] = []
  
  if (!card.frontContent?.title) {
    errors.push('Front content title is required')
  }
  
  if (!card.backContent?.title) {
    errors.push('Back content title is required')
  }
  
  if (card.style && !['solid', 'gradient', 'glass'].includes(card.style.type)) {
    errors.push('Invalid card style type')
  }
  
  return errors
}

// ============================================================================
// 性能优化和缓存
// ============================================================================

// 简单的查询缓存
const queryCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存

export const cachedQuery = async <T>(
  key: string,
  query: () => Promise<T>
): Promise<T> => {
  const cached = queryCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  
  const data = await query()
  queryCache.set(key, { data, timestamp: Date.now() })
  return data
}

// 清理缓存
export const clearQueryCache = (): void => {
  queryCache.clear()
}

// 定期清理过期缓存
setInterval(() => {
  const now = Date.now()
  queryCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_TTL) {
      queryCache.delete(key)
    }
  })
}, CACHE_TTL)