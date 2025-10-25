/**
 * 备份核心服务
 * 提供核心备份、恢复和配置管理功能
 */

import { db, DbCard, DbFolder, DbTag, DbImage, AppSettings } from '../../database-unified'
import { fileSystemService } from '../../file-system'
import { DataValidatorService, BackupMetadata } from '../../data-validator'
import { SecureStorage } from '../../utils/secure-storage'

// ============================================================================
// 核心类型定义
// ============================================================================

export interface BackupConfig {
  id: string
  name: string
  description?: string
  autoBackup: boolean
  interval: number
  maxBackups: number
  compression: boolean
  encryption: boolean
  retention: {
    days: number
    maxSize: number
  }
  include: {
    cards: boolean
    folders: boolean
    tags: boolean
    images: boolean
    settings: boolean
    syncQueue: boolean
  }
  storage: {
    primary: 'indexeddb' | 'filesystem' | 'cloud'
    secondary?: 'indexeddb' | 'filesystem' | 'cloud'
  }
  incremental?: {
    enabled: boolean
    maxChainLength: number
    threshold: number
    algorithm: 'checksum' | 'timestamp'
  }
  differential?: {
    enabled: boolean
    interval: number
  }
}

export interface BackupResult {
  success: boolean
  backupId: string
  metadata: BackupMetadata
  size: number
  compressionRatio?: number
  warnings: string[]
  duration: number
  backupType: 'full' | 'incremental' | 'differential'
}

export interface RestoreResult {
  success: boolean
  message: string
  restoredItems: {
    cards: number
    folders: number
    tags: number
    images: number
  }
  warnings: string[]
  conflicts: Array<{
    type: 'card' | 'folder' | 'tag' | 'image'
    id: string
    action: 'overwrite' | 'merge' | 'skip'
  }>
}

export interface StorageLocation {
  id: string
  name: string
  type: 'indexeddb' | 'filesystem' | 'cloud'
  available: boolean
  capacity: { used: number; total: number }
  lastUsed: Date
  config?: any
}

// ============================================================================
// 备份核心服务类
// ============================================================================

export class BackupCoreService {
  private backupConfigs: Map<string, BackupConfig> = new Map()
  private storageLocations: Map<string, StorageLocation> = new Map()
  private isBackupInProgress = false
  private isRestoreInProgress = false

  // 增量备份相关
  private lastFullBackup: Map<string, BackupMetadata> = new Map()
  private incrementalChain: Map<string, BackupMetadata[]> = new Map()
  private backupSequence: Map<string, number> = new Map()

  constructor() {
    this.initializeDefaultConfig()
    this.initializeStorageLocations()
    this.loadBackupConfigs()
    this.loadBackupChains()
  }

  /**
   * 初始化默认配置
   */
  private initializeDefaultConfig(): void {
    const defaultConfig: BackupConfig = {
      id: 'default',
      name: '默认备份配置',
      autoBackup: true,
      interval: 30 * 60 * 1000, // 30分钟
      maxBackups: 10,
      compression: true,
      encryption: false,
      retention: {
        days: 30,
        maxSize: 500 // 500MB
      },
      include: {
        cards: true,
        folders: true,
        tags: true,
        images: false, // 图片较大，默认不包含
        settings: true,
        syncQueue: true
      },
      storage: {
        primary: 'indexeddb',
        secondary: 'filesystem'
      },
      incremental: {
        enabled: true,
        maxChainLength: 10,
        threshold: 100,
        algorithm: 'checksum'
      },
      differential: {
        enabled: true,
        interval: 5
      }
    }

    this.backupConfigs.set('default', defaultConfig)
  }

  /**
   * 初始化存储位置
   */
  private async initializeStorageLocations(): Promise<void> {
    // IndexedDB存储
    this.storageLocations.set('indexeddb', {
      id: 'indexeddb',
      name: 'IndexedDB 存储',
      type: 'indexeddb',
      available: true,
      capacity: { used: 0, total: 0 },
      lastUsed: new Date()
    })

    // 文件系统存储
    try {
      const fsAvailable = await fileSystemService.isAvailable()
      this.storageLocations.set('filesystem', {
        id: 'filesystem',
        name: '文件系统存储',
        type: 'filesystem',
        available: fsAvailable,
        capacity: { used: 0, total: 0 },
        lastUsed: new Date()
      })
    } catch (error) {
      console.warn('File system storage not available:', error)
    }
  }

  /**
   * 加载备份配置
   */
  private async loadBackupConfigs(): Promise<void> {
    try {
      const savedConfigs = localStorage.getItem('cardall-backup-configs')
      if (savedConfigs) {
        const configs = JSON.parse(savedConfigs)
        Object.entries(configs).forEach(([id, config]) => {
          this.backupConfigs.set(id, config as BackupConfig)
        })
      }
    } catch (error) {
      console.error('Failed to load backup configs:', error)
    }
  }

  /**
   * 加载备份链信息
   */
  private async loadBackupChains(): Promise<void> {
    try {
      const savedChains = localStorage.getItem('cardall-backup-chains')
      if (savedChains) {
        const chains = JSON.parse(savedChains)
        Object.entries(chains).forEach(([configId, chain]) => {
          this.incrementalChain.set(configId, chain as BackupMetadata[])
        })
      }

      const savedLastFull = localStorage.getItem('cardall-backup-last-full')
      if (savedLastFull) {
        const lastFull = JSON.parse(savedLastFull)
        Object.entries(lastFull).forEach(([configId, backup]) => {
          this.lastFullBackup.set(configId, backup as BackupMetadata)
        })
      }
    } catch (error) {
      console.error('Failed to load backup chains:', error)
    }
  }

  /**
   * 创建备份
   */
  async createBackup(configId: string = 'default', options?: {
    name?: string
    description?: string
    force?: boolean
  }): Promise<BackupResult> {
    const startTime = Date.now()
    const warnings: string[] = []

    try {
      const config = this.backupConfigs.get(configId)
      if (!config) {
        throw new Error(`Backup config ${configId} not found`)
      }

      // 检查是否已有备份进行中
      if (this.isBackupInProgress && !options?.force) {
        throw new Error('Backup already in progress')
      }

      this.isBackupInProgress = true

      // 检查存储空间
      const spaceCheck = await this.checkStorageSpace(config)
      if (!spaceCheck.hasSpace) {
        throw new Error(`Insufficient storage space: ${spaceCheck.message}`)
      }

      // 收集备份数据
      const backupData = await this.collectBackupData(config, warnings)

      // 压缩数据
      const compressedData = await this.compressData(backupData, config.compression)

      // 加密数据
      const encryptedData = await this.encryptData(compressedData, config.encryption)

      // 计算校验和
      const checksum = await this.calculateChecksum(encryptedData)

      // 确定备份类型
      const backupType = await this.determineBackupType(configId, backupData)

      // 创建元数据
      const metadata: BackupMetadata = {
        id: this.generateBackupId(),
        configId,
        name: options?.name || `Backup ${new Date().toISOString()}`,
        description: options?.description || '',
        timestamp: new Date(),
        type: backupType,
        size: encryptedData.size,
        checksum,
        compression: config.compression,
        encryption: config.encryption,
        include: config.include,
        deviceId: await this.getDeviceInfo(),
        version: '1.0'
      }

      // 保存备份
      await this.saveBackup(encryptedData.data, metadata, config.storage.primary)

      // 更新备份链
      await this.updateBackupChain(configId, metadata, backupData)

      // 清理旧备份
      await this.cleanupOldBackups(config)

      const duration = Date.now() - startTime

      return {
        success: true,
        backupId: metadata.id,
        metadata,
        size: metadata.size,
        compressionRatio: compressedData.size / backupData.size,
        warnings,
        duration,
        backupType
      }

    } catch (error) {
      console.error('Backup failed:', error)
      return {
        success: false,
        backupId: '',
        metadata: {} as BackupMetadata,
        size: 0,
        warnings: [error instanceof Error ? error.message : 'Unknown error'],
        duration: Date.now() - startTime,
        backupType: 'full'
      }
    } finally {
      this.isBackupInProgress = false
    }
  }

  /**
   * 检查存储空间
   */
  private async checkStorageSpace(config: BackupConfig): Promise<{
    hasSpace: boolean
    message: string
  }> {
    const storage = this.storageLocations.get(config.storage.primary)
    if (!storage?.available) {
      return { hasSpace: false, message: 'Storage not available' }
    }

    // 简化的空间检查
    const estimatedSize = 50 * 1024 * 1024 // 50MB 估算
    const availableSpace = storage.capacity.total - storage.capacity.used

    return {
      hasSpace: availableSpace > estimatedSize,
      message: availableSpace > estimatedSize
        ? 'Sufficient space available'
        : `Insufficient space: ${availableSpace}MB available, ${estimatedSize}MB needed`
    }
  }

  /**
   * 收集备份数据
   */
  private async collectBackupData(config: BackupConfig, warnings: string[]): Promise<any> {
    const data: any = {}

    try {
      // 收集卡片数据
      if (config.include.cards) {
        data.cards = await db.cards.toArray()
      }

      // 收集文件夹数据
      if (config.include.folders) {
        data.folders = await db.folders.toArray()
      }

      // 收集标签数据
      if (config.include.tags) {
        data.tags = await db.tags.toArray()
        data.hiddenTags = await db.hiddenTags.toArray()
      }

      // 收集图片数据
      if (config.include.images) {
        data.images = await db.images.toArray()
        warnings.push('Image backup may increase backup size significantly')
      }

      // 收集设置数据
      if (config.include.settings) {
        data.settings = await db.settings.toArray()
      }

      // 收集同步队列数据
      if (config.include.syncQueue) {
        data.syncQueue = await db.syncQueue.toArray()
      }

      return data

    } catch (error) {
      console.error('Failed to collect backup data:', error)
      throw new Error('Failed to collect backup data')
    }
  }

  /**
   * 压缩数据
   */
  private async compressData(data: any, enabled: boolean): Promise<{ data: any; size: number }> {
    if (!enabled) {
      const jsonString = JSON.stringify(data)
      return { data, size: new Blob([jsonString]).size }
    }

    try {
      const jsonString = JSON.stringify(data)
      const compressed = await this.compressString(jsonString, { algorithm: 'gzip', level: 6 })
      return { data: compressed, size: new Blob([compressed]).size }
    } catch (error) {
      console.warn('Compression failed, using uncompressed data:', error)
      const jsonString = JSON.stringify(data)
      return { data, size: new Blob([jsonString]).size }
    }
  }

  /**
   * 加密数据
   */
  private async encryptData(data: any, enabled: boolean): Promise<{ data: any; size: number }> {
    if (!enabled) {
      return { data, size: typeof data === 'string' ? new Blob([data]).size : JSON.stringify(data).length }
    }

    // 简化的加密实现
    try {
      const jsonString = typeof data === 'string' ? data : JSON.stringify(data)
      // 这里应该使用实际的加密算法，现在只是示例
      const encrypted = btoa(jsonString)
      return { data: encrypted, size: new Blob([encrypted]).size }
    } catch (error) {
      console.warn('Encryption failed, using unencrypted data:', error)
      return { data, size: typeof data === 'string' ? new Blob([data]).size : JSON.stringify(data).length }
    }
  }

  /**
   * 计算校验和
   */
  private async calculateChecksum(data: any): Promise<string> {
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data)

    // 简单的校验和算法
    let hash = 0
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }

    return Math.abs(hash).toString(16)
  }

  /**
   * 保存备份
   */
  private async saveBackup(
    data: any,
    metadata: BackupMetadata,
    storageType: 'indexeddb' | 'filesystem' | 'cloud'
  ): Promise<void> {
    switch (storageType) {
      case 'indexeddb':
        await this.saveToIndexedDB(data, metadata, metadata.name)
        break
      case 'filesystem':
        await this.saveToFileSystem(data, metadata, metadata.name)
        break
      case 'cloud':
        await this.saveToCloud(data, metadata, metadata.name)
        break
    }
  }

  /**
   * 保存到IndexedDB
   */
  private async saveToIndexedDB(data: any, metadata: BackupMetadata, name: string): Promise<void> {
    try {
      await db.backups.add({
        id: metadata.id,
        name,
        data,
        metadata,
        createdAt: new Date()
      })
    } catch (error) {
      console.error('Failed to save backup to IndexedDB:', error)
      throw new Error('Failed to save backup to IndexedDB')
    }
  }

  /**
   * 保存到文件系统
   */
  private async saveToFileSystem(data: any, metadata: BackupMetadata, name: string): Promise<void> {
    try {
      const fileName = `${name}_${metadata.id}.backup`
      const content = typeof data === 'string' ? data : JSON.stringify(data)
      await fileSystemService.writeFile(fileName, content)
    } catch (error) {
      console.error('Failed to save backup to filesystem:', error)
      throw new Error('Failed to save backup to filesystem')
    }
  }

  /**
   * 保存到云端
   */
  private async saveToCloud(data: any, metadata: BackupMetadata, name: string): Promise<void> {
    // 云端存储实现
    console.warn('Cloud storage not implemented yet')
    throw new Error('Cloud storage not implemented')
  }

  /**
   * 确定备份类型
   */
  private async determineBackupType(configId: string, currentData: any): Promise<'full' | 'incremental' | 'differential'> {
    const config = this.backupConfigs.get(configId)
    if (!config?.incremental?.enabled) {
      return 'full'
    }

    const lastBackup = this.lastFullBackup.get(configId)
    if (!lastBackup) {
      return 'full'
    }

    // 检查是否应该创建增量备份
    const changes = await this.detectChanges(lastBackup.timestamp, currentData)
    if (changes.totalChanges > 0 && changes.totalChanges < 100) {
      return 'incremental'
    }

    return 'full'
  }

  /**
   * 检测变化
   */
  private async detectChanges(since: Date, currentData: any): Promise<{
    totalChanges: number
    entityChanges: Array<{ type: string; changes: any[] }>
  }> {
    // 简化的变化检测
    const entityChanges: Array<{ type: string; changes: any[] }> = []
    let totalChanges = 0

    for (const [entityType, entities] of Object.entries(currentData)) {
      if (Array.isArray(entities)) {
        const changes = entities.filter(entity => {
          const updatedAt = new Date(entity.updatedAt || entity.createdAt)
          return updatedAt > since
        })

        if (changes.length > 0) {
          entityChanges.push({ type: entityType, changes })
          totalChanges += changes.length
        }
      }
    }

    return { totalChanges, entityChanges }
  }

  /**
   * 更新备份链
   */
  private async updateBackupChain(configId: string, metadata: BackupMetadata, backupData: any): Promise<void> {
    const config = this.backupConfigs.get(configId)
    if (!config) return

    if (metadata.type === 'full') {
      this.lastFullBackup.set(configId, metadata)
      this.incrementalChain.set(configId, [metadata])
    } else if (metadata.type === 'incremental') {
      const chain = this.incrementalChain.get(configId) || []
      chain.push(metadata)

      // 限制链长度
      if (chain.length > (config.incremental?.maxChainLength || 10)) {
        chain.shift()
      }

      this.incrementalChain.set(configId, chain)
    }

    // 保存备份链信息
    await this.saveBackupChainInfo(configId)
  }

  /**
   * 保存备份链信息
   */
  private async saveBackupChainInfo(configId: string): Promise<void> {
    try {
      const chains = Object.fromEntries(this.incrementalChain)
      localStorage.setItem('cardall-backup-chains', JSON.stringify(chains))

      const lastFull = Object.fromEntries(this.lastFullBackup)
      localStorage.setItem('cardall-backup-last-full', JSON.stringify(lastFull))
    } catch (error) {
      console.error('Failed to save backup chain info:', error)
    }
  }

  /**
   * 清理旧备份
   */
  private async cleanupOldBackups(config: BackupConfig): Promise<void> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - config.retention.days)

      const backups = await this.getBackupsByConfig(config.storage.primary)
      const oldBackups = backups.filter(backup => backup.timestamp < cutoffDate)

      // 保留最新的N个备份
      const sortedBackups = backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      const toKeep = sortedBackups.slice(0, config.maxBackups)
      const toDelete = oldBackups.filter(backup => !toKeep.some(keep => keep.id === backup.id))

      for (const backup of toDelete) {
        await this.deleteBackup(backup.id, config.storage.primary)
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error)
    }
  }

  /**
   * 获取配置的备份列表
   */
  private async getBackupsByConfig(storageType: 'indexeddb' | 'filesystem' | 'cloud'): Promise<BackupMetadata[]> {
    try {
      switch (storageType) {
        case 'indexeddb':
          const backups = await db.backups.toArray()
          return backups.map(backup => backup.metadata)

        case 'filesystem':
          // 从文件系统获取备份列表
          return []

        case 'cloud':
          // 从云端获取备份列表
          return []

        default:
          return []
      }
    } catch (error) {
      console.error('Failed to get backups:', error)
      return []
    }
  }

  /**
   * 删除备份
   */
  private async deleteBackup(backupId: string, storageType: 'indexeddb' | 'filesystem' | 'cloud'): Promise<void> {
    try {
      switch (storageType) {
        case 'indexeddb':
          await db.backups.delete(backupId)
          break

        case 'filesystem':
          // 从文件系统删除
          break

        case 'cloud':
          // 从云端删除
          break
      }
    } catch (error) {
      console.error('Failed to delete backup:', error)
    }
  }

  /**
   * 恢复备份
   */
  async restoreBackup(backupId: string, options?: {
    validateOnly?: boolean
    conflictResolution?: 'overwrite' | 'merge' | 'skip'
  }): Promise<RestoreResult> {
    try {
      if (this.isRestoreInProgress) {
        throw new Error('Restore already in progress')
      }

      this.isRestoreInProgress = true

      // 查找备份
      const backup = await this.findBackup(backupId)
      if (!backup) {
        throw new Error(`Backup ${backupId} not found`)
      }

      // 验证备份
      const validation = await this.validateBackup(backup)
      if (!validation.valid && !options?.validateOnly) {
        throw new Error(`Backup validation failed: ${validation.errors.join(', ')}`)
      }

      if (options?.validateOnly) {
        return {
          success: true,
          message: 'Backup validation completed',
          restoredItems: { cards: 0, folders: 0, tags: 0, images: 0 },
          warnings: validation.warnings,
          conflicts: []
        }
      }

      // 执行恢复
      return await this.performRestore(backup, options?.conflictResolution || 'overwrite')

    } catch (error) {
      console.error('Restore failed:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        restoredItems: { cards: 0, folders: 0, tags: 0, images: 0 },
        warnings: [],
        conflicts: []
      }
    } finally {
      this.isRestoreInProgress = false
    }
  }

  /**
   * 查找备份
   */
  private async findBackup(backupId: string): Promise<{
    data: any
    metadata: BackupMetadata
  } | null> {
    try {
      // 首先从IndexedDB查找
      const backup = await db.backups.get(backupId)
      if (backup) {
        return {
          data: backup.data,
          metadata: backup.metadata
        }
      }

      // 从其他存储位置查找...
      return null

    } catch (error) {
      console.error('Failed to find backup:', error)
      return null
    }
  }

  /**
   * 验证备份
   */
  private async validateBackup(backup: {
    data: any
    metadata: BackupMetadata
  }): Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
  }> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // 验证校验和
      const calculatedChecksum = await this.calculateChecksum(backup.data)
      if (calculatedChecksum !== backup.metadata.checksum) {
        errors.push('Backup checksum mismatch')
      }

      // 验证数据结构
      if (typeof backup.data !== 'object' || backup.data === null) {
        errors.push('Invalid backup data structure')
      }

      // 验证必要字段
      if (!backup.metadata.id || !backup.metadata.timestamp) {
        errors.push('Missing required metadata fields')
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      }

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return {
        valid: false,
        errors,
        warnings
      }
    }
  }

  /**
   * 执行恢复
   */
  private async performRestore(
    backup: { data: any; metadata: BackupMetadata },
    conflictResolution: 'overwrite' | 'merge' | 'skip'
  ): Promise<RestoreResult> {
    const conflicts: Array<{ type: 'card' | 'folder' | 'tag' | 'image'; id: string; action: 'overwrite' | 'merge' | 'skip' }> = []
    const warnings: string[] = []

    const restoredItems = {
      cards: 0,
      folders: 0,
      tags: 0,
      images: 0
    }

    try {
      const restoreData = backup.data

      // 恢复卡片
      if (restoreData.cards && Array.isArray(restoreData.cards)) {
        for (const card of restoreData.cards) {
          try {
            const existingCard = await db.cards.get(card.id)

            if (existingCard) {
              conflicts.push({
                type: 'card',
                id: card.id,
                action: conflictResolution
              })

              if (conflictResolution === 'overwrite') {
                await db.cards.put(card)
                restoredItems.cards++
              }
            } else {
              await db.cards.add(card)
              restoredItems.cards++
            }
          } catch (error) {
            warnings.push(`Failed to restore card ${card.id}: ${error}`)
          }
        }
      }

      // 恢复文件夹
      if (restoreData.folders && Array.isArray(restoreData.folders)) {
        for (const folder of restoreData.folders) {
          try {
            const existingFolder = await db.folders.get(folder.id)

            if (existingFolder) {
              conflicts.push({
                type: 'folder',
                id: folder.id,
                action: conflictResolution
              })

              if (conflictResolution === 'overwrite') {
                await db.folders.put(folder)
                restoredItems.folders++
              }
            } else {
              await db.folders.add(folder)
              restoredItems.folders++
            }
          } catch (error) {
            warnings.push(`Failed to restore folder ${folder.id}: ${error}`)
          }
        }
      }

      // 恢复标签
      if (restoreData.tags && Array.isArray(restoreData.tags)) {
        for (const tag of restoreData.tags) {
          try {
            const existingTag = await db.tags.get(tag.id)

            if (existingTag) {
              conflicts.push({
                type: 'tag',
                id: tag.id,
                action: conflictResolution
              })

              if (conflictResolution === 'overwrite') {
                await db.tags.put(tag)
                restoredItems.tags++
              }
            } else {
              await db.tags.add(tag)
              restoredItems.tags++
            }
          } catch (error) {
            warnings.push(`Failed to restore tag ${tag.id}: ${error}`)
          }
        }
      }

      // 恢复图片
      if (restoreData.images && Array.isArray(restoreData.images)) {
        for (const image of restoreData.images) {
          try {
            const existingImage = await db.images.get(image.id)

            if (existingImage) {
              conflicts.push({
                type: 'image',
                id: image.id,
                action: conflictResolution
              })

              if (conflictResolution === 'overwrite') {
                await db.images.put(image)
                restoredItems.images++
              }
            } else {
              await db.images.add(image)
              restoredItems.images++
            }
          } catch (error) {
            warnings.push(`Failed to restore image ${image.id}: ${error}`)
          }
        }
      }

      return {
        success: true,
        message: 'Restore completed successfully',
        restoredItems,
        warnings,
        conflicts
      }

    } catch (error) {
      console.error('Restore failed:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        restoredItems,
        warnings: [error instanceof Error ? error.message : 'Unknown error'],
        conflicts
      }
    }
  }

  /**
   * 获取设备信息
   */
  private async getDeviceInfo(): Promise<string> {
    const userAgent = navigator.userAgent
    const platform = navigator.platform

    // 简化的设备标识
    const deviceHash = await this.calculateChecksum({ userAgent, platform, timestamp: Date.now() })
    return deviceHash.substring(0, 8)
  }

  /**
   * 生成备份ID
   */
  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 压缩字符串
   */
  private async compressString(data: string, options: { algorithm: string; level: number }): Promise<string> {
    // 简化的压缩实现
    // 实际项目中应该使用CompressionStream或其他压缩库
    return data
  }

  // ============================================================================
  // 公共接口方法
  // ============================================================================

  /**
   * 获取备份配置
   */
  getBackupConfig(configId: string): BackupConfig | undefined {
    return this.backupConfigs.get(configId)
  }

  /**
   * 更新备份配置
   */
  async updateBackupConfig(configId: string, config: BackupConfig): Promise<void> {
    this.backupConfigs.set(configId, config)
    await this.saveConfigs()
  }

  /**
   * 保存配置
   */
  private async saveConfigs(): Promise<void> {
    try {
      const configs = Object.fromEntries(this.backupConfigs)
      localStorage.setItem('cardall-backup-configs', JSON.stringify(configs))
    } catch (error) {
      console.error('Failed to save backup configs:', error)
    }
  }

  /**
   * 获取存储位置
   */
  getStorageLocations(): StorageLocation[] {
    return Array.from(this.storageLocations.values())
  }

  /**
   * 获取备份统计信息
   */
  async getBackupStats(): Promise<{
    totalBackups: number
    totalSize: number
    lastBackup: Date | null
    configs: Array<{ id: string; name: string; backups: number }>
  }> {
    const backups = await this.getBackupsByConfig('indexeddb')

    return {
      totalBackups: backups.length,
      totalSize: backups.reduce((sum, backup) => sum + backup.size, 0),
      lastBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
      configs: Array.from(this.backupConfigs.entries()).map(([id, config]) => ({
        id,
        name: config.name,
        backups: backups.filter(backup => backup.configId === id).length
      }))
    }
  }

  /**
   * 测试存储位置
   */
  async testStorageLocation(storageType: 'indexeddb' | 'filesystem' | 'cloud'): Promise<{
    available: boolean
    message: string
    capacity?: { used: number; total: number }
  }> {
    const storage = this.storageLocations.get(storageType)

    if (!storage) {
      return { available: false, message: 'Storage location not found' }
    }

    if (!storage.available) {
      return { available: false, message: 'Storage not available' }
    }

    try {
      // 简单的读写测试
      const testData = { test: true, timestamp: Date.now() }
      const testId = `test_${Date.now()}`

      if (storageType === 'indexeddb') {
        await db.backups.add({
          id: testId,
          name: 'test',
          data: testData,
          metadata: {} as BackupMetadata,
          createdAt: new Date()
        })
        await db.backups.delete(testId)
      }

      return {
        available: true,
        message: 'Storage location is working properly',
        capacity: storage.capacity
      }
    } catch (error) {
      return {
        available: false,
        message: `Storage test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }
}

// 导出单例实例
export const backupCoreService = new BackupCoreService()