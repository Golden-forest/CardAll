/**
 * 增强本地备份服务 (Enhanced Local Backup Service)
 * 
 * T022-T025 任务实现：综合本地数据管理服务
 * - 自动备份到 IndexedDB
 * - 数据导出为 JSON 文件
 * - 从 JSON 文件导入数据
 * - 本地数据完整性验证
 */

import { getDatabase } from './database'
import { simpleBackupService } from './simple-backup-service'
import { dataIntegrityChecker, type IntegrityCheckResult } from './data-integrity-checker'
import { 
  BackupMetadata, 
  BackupData, 
  BackupOptions, 
  BackupProgress,
  BackupSchedule,
  ImportOptions,
  ImportResult,
  IntegrityCheckResult as LocalIntegrityCheckResult,
  DataIntegrityIssue
} from '@/types/backup'
import { Card, Folder, Tag } from '@/types/card'

export interface EnhancedBackupConfig {
  // 自动备份配置
  autoBackupEnabled: boolean
  autoBackupInterval: number // 毫秒
  maxAutoBackups: number
  autoBackupName: string
  
  // 数据完整性检查配置
  integrityCheckEnabled: boolean
  integrityCheckInterval: number
  autoFixIntegrityIssues: boolean
  
  // 导入导出配置
  exportFormat: 'json' | 'csv'
  includeImagesInExport: boolean
  compressionEnabled: boolean
  
  // 存储配置
  maxBackupStorageSize: number // 字节
  cleanupOldBackups: boolean
  backupRetentionDays: number
}

export interface BackupStatistics {
  totalBackups: number
  autoBackups: number
  manualBackups: number
  totalSize: number
  lastBackupTime?: Date
  lastIntegrityCheck?: Date
  integrityIssues: number
  storageUsage: number
  storageQuota: number
}

export class EnhancedLocalBackupService {
  private static instance: EnhancedLocalBackupService
  private db = getDatabase()
  private config: EnhancedBackupConfig
  private autoBackupTimer?: number
  private integrityCheckTimer?: number
  private isInitialized = false

  // 默认配置
  private readonly defaultConfig: EnhancedBackupConfig = {
    autoBackupEnabled: true,
    autoBackupInterval: 24 * 60 * 60 * 1000, // 24小时
    maxAutoBackups: 7,
    autoBackupName: 'AutoBackup',
    
    integrityCheckEnabled: true,
    integrityCheckInterval: 12 * 60 * 60 * 1000, // 12小时
    autoFixIntegrityIssues: false,
    
    exportFormat: 'json',
    includeImagesInExport: true,
    compressionEnabled: false,
    
    maxBackupStorageSize: 100 * 1024 * 1024, // 100MB
    cleanupOldBackups: true,
    backupRetentionDays: 30
  }

  static getInstance(): EnhancedLocalBackupService {
    if (!EnhancedLocalBackupService.instance) {
      EnhancedLocalBackupService.instance = new EnhancedLocalBackupService()
    }
    return EnhancedLocalBackupService.instance
  }

  constructor(config?: Partial<EnhancedBackupConfig>) {
    this.config = { ...this.defaultConfig, ...config }
  }

  // ============================================================================
  // 初始化和生命周期管理
  // ============================================================================

  async initialize(config?: Partial<EnhancedBackupConfig>): Promise<void> {
    if (this.isInitialized) {
      console.log('EnhancedLocalBackupService already initialized')
      return
    }

    try {
      console.log('Initializing EnhancedLocalBackupService...')

      // 更新配置
      if (config) {
        this.config = { ...this.config, ...config }
        await this.saveConfig()
      }

      // 加载保存的配置
      await this.loadConfig()

      // 初始化数据完整性检查器
      if (this.config.integrityCheckEnabled) {
        await dataIntegrityChecker.initialize({
          enabled: true,
          autoStart: true,
          enableAutoFix: this.config.autoFixIntegrityIssues
        })
      }

      // 启动自动备份
      if (this.config.autoBackupEnabled) {
        this.startAutoBackup()
      }

      // 启动定期完整性检查
      if (this.config.integrityCheckEnabled) {
        this.startIntegrityCheck()
      }

      // 清理旧备份
      if (this.config.cleanupOldBackups) {
        await this.cleanupOldBackups()
      }

      this.isInitialized = true
      console.log('EnhancedLocalBackupService initialized successfully')

    } catch (error) {
      console.error('EnhancedLocalBackupService initialization failed:', error)
      throw error
    }
  }

  async destroy(): Promise<void> {
    try {
      console.log('Destroying EnhancedLocalBackupService...')

      // 停止定时器
      this.stopAutoBackup()
      this.stopIntegrityCheck()

      // 停止数据完整性检查器
      await dataIntegrityChecker.stop()

      this.isInitialized = false
      console.log('EnhancedLocalBackupService destroyed successfully')

    } catch (error) {
      console.error('EnhancedLocalBackupService destroy failed:', error)
      throw error
    }
  }

  // ============================================================================
  // T022: 自动备份功能
  // ============================================================================

  /**
   * 创建自动备份
   */
  async createAutoBackup(): Promise<string> {
    const backupName = `${this.config.autoBackupName}_${new Date().toISOString().split('T')[0]}_${new Date().toTimeString().split(' ')[0].replace(/:/g, '-')}`
    
    const options: BackupOptions = {
      name: backupName,
      includeImages: true,
      includeSettings: true,
      compress: this.config.compressionEnabled,
      encrypt: false,
      tags: ['auto-backup']
    }

    try {
      console.log(`Creating auto backup: ${backupName}`)
      
      const backupId = await simpleBackupService.createBackup(options, (progress) => {
        console.log(`Auto backup progress: ${progress.progress}% - ${progress.message}`)
      })

      // 检查并清理旧备份
      await this.manageAutoBackupCount()

      // 保存备份统计
      await this.updateBackupStatistics()

      console.log(`Auto backup created successfully: ${backupId}`)
      return backupId

    } catch (error) {
      console.error('Auto backup creation failed:', error)
      throw error
    }
  }

  /**
   * 启动自动备份
   */
  private startAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer)
    }

    this.autoBackupTimer = window.setInterval(async () => {
      try {
        await this.createAutoBackup()
      } catch (error) {
        console.error('Scheduled auto backup failed:', error)
      }
    }, this.config.autoBackupInterval)

    console.log(`Auto backup started with interval: ${this.config.autoBackupInterval}ms`)
  }

  /**
   * 停止自动备份
   */
  private stopAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer)
      this.autoBackupTimer = undefined
      console.log('Auto backup stopped')
    }
  }

  /**
   * 管理自动备份数量
   */
  private async manageAutoBackupCount(): Promise<void> {
    try {
      const backups = await simpleBackupService.getBackupList()
      const autoBackups = backups.filter(backup => 
        backup.tags.includes('auto-backup')
      ).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      if (autoBackups.length > this.config.maxAutoBackups) {
        const toDelete = autoBackups.slice(this.config.maxAutoBackups)
        
        for (const backup of toDelete) {
          await simpleBackupService.deleteBackup(backup.id)
          console.log(`Deleted old auto backup: ${backup.id}`)
        }
      }
    } catch (error) {
      console.warn('Failed to manage auto backup count:', error)
    }
  }

  // ============================================================================
  // T023: 数据导出功能
  // ============================================================================

  /**
   * 导出数据为 JSON 文件
   */
  async exportDataAsJSON(options: {
    includeCards?: boolean
    includeFolders?: boolean
    includeTags?: boolean
    includeImages?: boolean
    includeSettings?: boolean
    filename?: string
  } = {}): Promise<void> {
    try {
      const {
        includeCards = true,
        includeFolders = true,
        includeTags = true,
        includeImages = this.config.includeImagesInExport,
        includeSettings = true,
        filename
      } = options

      console.log('Starting data export...')

      // 收集数据
      const exportData: any = {
        exportInfo: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          source: 'CardAll Local Export'
        }
      }

      if (includeCards) {
        exportData.cards = await this.collectCardsForExport()
      }

      if (includeFolders) {
        exportData.folders = await this.collectFoldersForExport()
      }

      if (includeTags) {
        exportData.tags = await this.collectTagsForExport()
      }

      if (includeImages) {
        exportData.images = await this.collectImagesForExport()
      }

      if (includeSettings) {
        exportData.settings = await this.collectSettingsForExport()
      }

      // 生成文件名
      const finalFilename = filename || `CardAll_Export_${new Date().toISOString().split('T')[0]}.json`

      // 创建下载
      const jsonString = JSON.stringify(exportData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      
      // 检查文件大小
      const fileSize = blob.size
      if (fileSize > 50 * 1024 * 1024) { // 50MB
        console.warn(`Export file is large: ${(fileSize / 1024 / 1024).toFixed(2)}MB`)
      }

      // 创建下载链接
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = finalFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      console.log(`Data exported successfully: ${finalFilename} (${(fileSize / 1024).toFixed(2)}KB)`)

    } catch (error) {
      console.error('Data export failed:', error)
      throw error
    }
  }

  /**
   * 导出特定备份
   */
  async exportBackup(backupId: string): Promise<void> {
    try {
      await simpleBackupService.exportBackup(backupId)
    } catch (error) {
      console.error('Backup export failed:', error)
      throw error
    }
  }

  /**
   * 收集卡片数据用于导出
   */
  private async collectCardsForExport(): Promise<any[]> {
    try {
      const cards = await this.db.cards.toArray()
      return cards.map(card => ({
        ...card,
        createdAt: card.createdAt.toISOString(),
        updatedAt: card.updatedAt.toISOString()
      }))
    } catch (error) {
      console.warn('Failed to collect cards for export:', error)
      return []
    }
  }

  /**
   * 收集文件夹数据用于导出
   */
  private async collectFoldersForExport(): Promise<any[]> {
    try {
      const folders = await this.db.folders.toArray()
      return folders.map(folder => ({
        ...folder,
        createdAt: folder.createdAt.toISOString(),
        updatedAt: folder.updatedAt.toISOString()
      }))
    } catch (error) {
      console.warn('Failed to collect folders for export:', error)
      return []
    }
  }

  /**
   * 收集标签数据用于导出
   */
  private async collectTagsForExport(): Promise<any[]> {
    try {
      const tags = await this.db.tags.toArray()
      return tags.map(tag => ({
        ...tag,
        createdAt: tag.createdAt.toISOString()
      }))
    } catch (error) {
      console.warn('Failed to collect tags for export:', error)
      return []
    }
  }

  /**
   * 收集图片数据用于导出
   */
  private async collectImagesForExport(): Promise<any[]> {
    try {
      const images = await this.db.images.toArray()
      return images.map(image => ({
        ...image,
        createdAt: image.createdAt.toISOString(),
        updatedAt: image.updatedAt.toISOString()
      }))
    } catch (error) {
      console.warn('Failed to collect images for export:', error)
      return []
    }
  }

  /**
   * 收集设置数据用于导出
   */
  private async collectSettingsForExport(): Promise<Record<string, any>> {
    try {
      const settings = await this.db.settings.toArray()
      const settingsMap: Record<string, any> = {}

      settings.forEach(setting => {
        settingsMap[setting.key] = setting.value
      })

      return settingsMap
    } catch (error) {
      console.warn('Failed to collect settings for export:', error)
      return {}
    }
  }

  // ============================================================================
  // T024: 数据导入功能
  // ============================================================================

  /**
   * 从 JSON 文件导入数据
   */
  async importDataFromJSON(file: File, options: ImportOptions): Promise<ImportResult> {
    const startTime = Date.now()

    try {
      console.log(`Starting import from file: ${file.name}`)

      // 创建导入前备份
      let backupId: string | undefined
      if (options.createBackup) {
        backupId = await simpleBackupService.createBackup({
          name: `PreImportBackup_${new Date().toISOString().split('T')[0]}`,
          includeImages: true,
          includeSettings: true,
          compress: false,
          encrypt: false,
          tags: ['pre-import']
        })
        console.log(`Created pre-import backup: ${backupId}`)
      }

      // 读取文件内容
      const fileContent = await this.readFileContent(file)
      const importData = JSON.parse(fileContent)

      // 验证数据格式
      if (!this.validateImportData(importData)) {
        throw new Error('Invalid import data format')
      }

      // 数据完整性检查
      if (options.validateData) {
        const integrityResult = await this.validateImportDataIntegrity(importData)
        if (!integrityResult.isValid && integrityResult.issues.length > 0) {
          console.warn('Import data integrity issues found:', integrityResult.issues)
        }
      }

      // 执行导入
      const importResult = await this.performDataImport(importData, options)

      // 计算耗时
      const duration = Date.now() - startTime

      const result: ImportResult = {
        success: importResult.errors.length === 0,
        totalItems: importResult.totalItems,
        importedItems: importResult.importedItems,
        skippedItems: importResult.skippedItems,
        errors: importResult.errors,
        warnings: importResult.warnings,
        duration,
        createdBackup: backupId
      }

      console.log('Import completed:', result)
      return result

    } catch (error) {
      console.error('Data import failed:', error)
      throw error
    }
  }

  /**
   * 读取文件内容
   */
  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string)
        } else {
          reject(new Error('Failed to read file content'))
        }
      }
      reader.onerror = () => reject(new Error('File reading error'))
      reader.readAsText(file, 'utf-8')
    })
  }

  /**
   * 验证导入数据格式
   */
  private validateImportData(data: any): boolean {
    try {
      // 检查基本结构
      if (!data || typeof data !== 'object') {
        return false
      }

      // 检查导出信息
      if (data.exportInfo && !data.exportInfo.timestamp) {
        return false
      }

      // 检查数据数组格式
      if (data.cards && !Array.isArray(data.cards)) return false
      if (data.folders && !Array.isArray(data.folders)) return false
      if (data.tags && !Array.isArray(data.tags)) return false
      if (data.images && !Array.isArray(data.images)) return false
      if (data.settings && typeof data.settings !== 'object') return false

      return true
    } catch (error) {
      console.error('Import data validation failed:', error)
      return false
    }
  }

  /**
   * 验证导入数据完整性
   */
  private async validateImportDataIntegrity(data: any): Promise<LocalIntegrityCheckResult> {
    const issues: DataIntegrityIssue[] = []

    try {
      // 检查必需字段
      if (data.cards) {
        data.cards.forEach((card: any, index: number) => {
          if (!card.id || !card.userId || !card.frontContent) {
            issues.push({
              type: 'corrupted-data',
              severity: 'high',
              entityId: card.id || `card_${index}`,
              entityType: 'card',
              description: 'Card missing required fields',
              suggestedAction: 'manual-review',
              details: { card, index }
            })
          }
        })
      }

      if (data.folders) {
        data.folders.forEach((folder: any, index: number) => {
          if (!folder.id || !folder.userId || !Array.isArray(folder.cardIds)) {
            issues.push({
              type: 'corrupted-data',
              severity: 'high',
              entityId: folder.id || `folder_${index}`,
              entityType: 'folder',
              description: 'Folder missing required fields',
              suggestedAction: 'manual-review',
              details: { folder, index }
            })
          }
        })
      }

      // 检查引用完整性
      const cardIds = new Set(data.cards?.map((c: any) => c.id) || [])
      const folderIds = new Set(data.folders?.map((f: any) => f.id) || [])
      const tagIds = new Set(data.tags?.map((t: any) => t.id) || [])

      // 检查文件夹引用
      if (data.cards) {
        data.cards.forEach((card: any) => {
          if (card.folderId && !folderIds.has(card.folderId)) {
            issues.push({
              type: 'invalid-reference',
              severity: 'medium',
              entityId: card.id,
              entityType: 'card',
              description: 'Card references non-existent folder',
              suggestedAction: 'repair',
              details: { folderId: card.folderId }
            })
          }
        })
      }

      // 检查文件夹中的卡片引用
      if (data.folders) {
        data.folders.forEach((folder: any) => {
          folder.cardIds?.forEach((cardId: string) => {
            if (!cardIds.has(cardId)) {
              issues.push({
                type: 'invalid-reference',
                severity: 'medium',
                entityId: folder.id,
                entityType: 'folder',
                description: 'Folder references non-existent card',
                suggestedAction: 'repair',
                details: { cardId }
              })
            }
          })
        })
      }

    } catch (error) {
      console.error('Import data integrity validation failed:', error)
      issues.push({
        type: 'corrupted-data',
        severity: 'critical',
        entityId: 'import_data',
        entityType: 'card',
        description: 'Failed to validate data integrity',
        suggestedAction: 'manual-review',
        details: { error }
      })
    }

    return {
      isValid: issues.length === 0,
      totalEntities: {
        cards: data.cards?.length || 0,
        folders: data.folders?.length || 0,
        tags: data.tags?.length || 0,
        images: data.images?.length || 0
      },
      issues,
      checkTime: new Date(),
      recommendations: this.generateIntegrityRecommendations(issues),
      autoFixable: issues.filter(i => i.suggestedAction === 'repair').length > 0
    }
  }

  /**
   * 执行数据导入
   */
  private async performDataImport(data: any, options: ImportOptions): Promise<{
    totalItems: number
    importedItems: {
      cards: number
      folders: number
      tags: number
      images: number
      settings: number
    }
    skippedItems: {
      cards: number
      folders: number
      tags: number
      images: number
    }
    errors: string[]
    warnings: string[]
  }> {
    const result = {
      totalItems: 0,
      importedItems: { cards: 0, folders: 0, tags: 0, images: 0, settings: 0 },
      skippedItems: { cards: 0, folders: 0, tags: 0, images: 0 },
      errors: [] as string[],
      warnings: [] as string[]
    }

    const selectedTypes = options.selectedTypes || ['cards', 'folders', 'tags', 'images', 'settings']

    try {
      // 导入数据前的准备
      const currentUserId = await this.getCurrentUserId()
      if (!currentUserId) {
        throw new Error('User not authenticated')
      }

      // 计算总项目数
      if (selectedTypes.includes('cards')) result.totalItems += data.cards?.length || 0
      if (selectedTypes.includes('folders')) result.totalItems += data.folders?.length || 0
      if (selectedTypes.includes('tags')) result.totalItems += data.tags?.length || 0
      if (selectedTypes.includes('images')) result.totalItems += data.images?.length || 0
      if (selectedTypes.includes('settings')) result.totalItems += Object.keys(data.settings || {}).length

      // 使用事务处理导入
      await this.db.transaction('rw', this.db.cards, this.db.folders, this.db.tags, this.db.images, this.db.settings, async () => {
        // 导入标签（先导入标签，因为卡片会引用）
        if (selectedTypes.includes('tags') && data.tags) {
          for (const tag of data.tags) {
            try {
              await this.importTag(tag, options, currentUserId, result)
            } catch (error) {
              result.errors.push(`Failed to import tag ${tag.name}: ${error}`)
            }
          }
        }

        // 导入文件夹
        if (selectedTypes.includes('folders') && data.folders) {
          for (const folder of data.folders) {
            try {
              await this.importFolder(folder, options, currentUserId, result)
            } catch (error) {
              result.errors.push(`Failed to import folder ${folder.name}: ${error}`)
            }
          }
        }

        // 导入卡片
        if (selectedTypes.includes('cards') && data.cards) {
          for (const card of data.cards) {
            try {
              await this.importCard(card, options, currentUserId, result)
            } catch (error) {
              result.errors.push(`Failed to import card ${card.id}: ${error}`)
            }
          }
        }

        // 导入图片
        if (selectedTypes.includes('images') && options.importImages && data.images) {
          for (const image of data.images) {
            try {
              await this.importImage(image, options, currentUserId, result)
            } catch (error) {
              result.errors.push(`Failed to import image ${image.id}: ${error}`)
            }
          }
        }

        // 导入设置
        if (selectedTypes.includes('settings') && options.importSettings && data.settings) {
          try {
            await this.importSettings(data.settings, result)
          } catch (error) {
            result.errors.push(`Failed to import settings: ${error}`)
          }
        }
      })

    } catch (error) {
      result.errors.push(`Transaction failed: ${error}`)
      console.error('Data import transaction failed:', error)
    }

    return result
  }

  /**
   * 导入单个标签
   */
  private async importTag(tag: any, options: ImportOptions, userId: string, result: any): Promise<void> {
    try {
      // 检查是否已存在
      const existing = await this.db.tags.where({ name: tag.name, userId }).first()
      
      if (existing && options.strategy === 'skip-existing') {
        result.skippedItems.tags++
        result.warnings.push(`Tag "${tag.name}" already exists, skipped`)
        return
      }

      const tagData = {
        id: options.preserveIds ? tag.id : crypto.randomUUID(),
        userId,
        name: tag.name,
        color: tag.color || '#3B82F6',
        count: tag.count || 0,
        isHidden: tag.isHidden || false,
        createdAt: new Date(tag.createdAt),
        isDeleted: false
      }

      if (existing && options.strategy === 'merge') {
        await this.db.tags.update(existing.id!, tagData)
        result.warnings.push(`Tag "${tag.name}" updated`)
      } else {
        await this.db.tags.add(tagData)
      }
      
      result.importedItems.tags++

    } catch (error) {
      console.error('Failed to import tag:', tag, error)
      throw error
    }
  }

  /**
   * 导入单个文件夹
   */
  private async importFolder(folder: any, options: ImportOptions, userId: string, result: any): Promise<void> {
    try {
      // 检查是否已存在
      const existing = await this.db.folders.where({ name: folder.name, userId }).first()
      
      if (existing && options.strategy === 'skip-existing') {
        result.skippedItems.folders++
        result.warnings.push(`Folder "${folder.name}" already exists, skipped`)
        return
      }

      const folderData = {
        id: options.preserveIds ? folder.id : crypto.randomUUID(),
        userId,
        name: folder.name,
        description: folder.description || '',
        cardIds: folder.cardIds || [],
        color: folder.color || '#10B981',
        isExpanded: folder.isExpanded !== undefined ? folder.isExpanded : true,
        createdAt: new Date(folder.createdAt),
        updatedAt: new Date(folder.updatedAt),
        isDeleted: false
      }

      if (existing && options.strategy === 'merge') {
        await this.db.folders.update(existing.id!, folderData)
        result.warnings.push(`Folder "${folder.name}" updated`)
      } else {
        await this.db.folders.add(folderData)
      }
      
      result.importedItems.folders++

    } catch (error) {
      console.error('Failed to import folder:', folder, error)
      throw error
    }
  }

  /**
   * 导入单个卡片
   */
  private async importCard(card: any, options: ImportOptions, userId: string, result: any): Promise<void> {
    try {
      // 检查是否已存在
      const existing = options.preserveIds ? await this.db.cards.get(card.id) : null
      
      if (existing && options.strategy === 'skip-existing') {
        result.skippedItems.cards++
        result.warnings.push(`Card "${card.id}" already exists, skipped`)
        return
      }

      const cardData = {
        id: options.preserveIds ? card.id : crypto.randomUUID(),
        userId,
        frontContent: card.frontContent,
        backContent: card.backContent,
        style: card.style || 'solid-blue',
        folderId: card.folderId || null,
        tags: card.tags || [],
        createdAt: new Date(card.createdAt),
        updatedAt: new Date(card.updatedAt),
        isDeleted: false,
        syncVersion: 0,
        pendingSync: false
      }

      if (existing && options.strategy === 'merge') {
        await this.db.cards.update(existing.id!, cardData)
        result.warnings.push(`Card "${card.id}" updated`)
      } else {
        await this.db.cards.add(cardData)
      }
      
      result.importedItems.cards++

    } catch (error) {
      console.error('Failed to import card:', card, error)
      throw error
    }
  }

  /**
   * 导入单个图片
   */
  private async importImage(image: any, options: ImportOptions, userId: string, result: any): Promise<void> {
    try {
      // 检查是否已存在
      const existing = options.preserveIds ? await this.db.images.get(image.id) : null
      
      if (existing && options.strategy === 'skip-existing') {
        result.skippedItems.images++
        result.warnings.push(`Image "${image.id}" already exists, skipped`)
        return
      }

      const imageData = {
        id: options.preserveIds ? image.id : crypto.randomUUID(),
        userId,
        filename: image.filename,
        data: image.data, // Base64 数据
        mimeType: image.mimeType || 'image/jpeg',
        size: image.size || 0,
        createdAt: new Date(image.createdAt),
        updatedAt: new Date(image.updatedAt),
        isDeleted: false
      }

      if (existing && options.strategy === 'merge') {
        await this.db.images.update(existing.id!, imageData)
        result.warnings.push(`Image "${image.id}" updated`)
      } else {
        await this.db.images.add(imageData)
      }
      
      result.importedItems.images++

    } catch (error) {
      console.error('Failed to import image:', image, error)
      throw error
    }
  }

  /**
   * 导入设置
   */
  private async importSettings(settings: Record<string, any>, result: any): Promise<void> {
    try {
      for (const [key, value] of Object.entries(settings)) {
        await this.db.settings.put({
          key,
          value,
          scope: 'global',
          updatedAt: new Date()
        })
        result.importedItems.settings++
      }
    } catch (error) {
      console.error('Failed to import settings:', error)
      throw error
    }
  }

  /**
   * 获取当前用户ID
   */
  private async getCurrentUserId(): Promise<string | null> {
    try {
      // 这里应该从认证服务获取用户ID
      // 暂时返回一个默认值用于测试
      return 'local-user'
    } catch (error) {
      console.error('Failed to get current user ID:', error)
      return null
    }
  }

  /**
   * 生成完整性检查建议
   */
  private generateIntegrityRecommendations(issues: DataIntegrityIssue[]): string[] {
    const recommendations: string[] = []

    const criticalIssues = issues.filter(i => i.severity === 'critical')
    const highIssues = issues.filter(i => i.severity === 'high')
    const mediumIssues = issues.filter(i => i.severity === 'medium')

    if (criticalIssues.length > 0) {
      recommendations.push(`发现 ${criticalIssues.length} 个严重问题，建议手动检查并修复数据`)
    }

    if (highIssues.length > 0) {
      recommendations.push(`发现 ${highIssues.length} 个高风险问题，可能影响数据完整性`)
    }

    if (mediumIssues.length > 0) {
      recommendations.push(`发现 ${mediumIssues.length} 个中等问题，建议在导入后进行数据清理`)
    }

    const repairableIssues = issues.filter(i => i.suggestedAction === 'repair')
    if (repairableIssues.length > 0) {
      recommendations.push(`${repairableIssues.length} 个问题可以自动修复，建议启用自动修复功能`)
    }

    return recommendations
  }

  // ============================================================================
  // T025: 数据完整性检查
  // ============================================================================

  /**
   * 运行数据完整性检查
   */
  async runIntegrityCheck(): Promise<IntegrityCheckResult> {
    try {
      console.log('Starting data integrity check...')
      
      const result = await dataIntegrityChecker.runFullCheck({
        autoFix: this.config.autoFixIntegrityIssues
      })

      // 保存检查结果
      await this.saveIntegrityCheckResult(result)

      console.log('Data integrity check completed:', result)
      return result

    } catch (error) {
      console.error('Data integrity check failed:', error)
      throw error
    }
  }

  /**
   * 启动定期完整性检查
   */
  private startIntegrityCheck(): void {
    if (this.integrityCheckTimer) {
      clearInterval(this.integrityCheckTimer)
    }

    this.integrityCheckTimer = window.setInterval(async () => {
      try {
        await this.runIntegrityCheck()
      } catch (error) {
        console.error('Scheduled integrity check failed:', error)
      }
    }, this.config.integrityCheckInterval)

    console.log(`Integrity check started with interval: ${this.config.integrityCheckInterval}ms`)
  }

  /**
   * 停止定期完整性检查
   */
  private stopIntegrityCheck(): void {
    if (this.integrityCheckTimer) {
      clearInterval(this.integrityCheckTimer)
      this.integrityCheckTimer = undefined
      console.log('Integrity check stopped')
    }
  }

  /**
   * 保存完整性检查结果
   */
  private async saveIntegrityCheckResult(result: IntegrityCheckResult): Promise<void> {
    try {
      const key = `integrity_check_${result.id}`
      await this.db.settings.put({
        key,
        value: {
          ...result,
          checkTime: new Date()
        },
        scope: 'global',
        updatedAt: new Date()
      })

      // 更新检查历史
      await this.updateIntegrityCheckHistory(result)

    } catch (error) {
      console.warn('Failed to save integrity check result:', error)
    }
  }

  /**
   * 更新完整性检查历史
   */
  private async updateIntegrityCheckHistory(result: IntegrityCheckResult): Promise<void> {
    try {
      const historyKey = 'integrity_check_history'
      const historyRecord = await this.db.settings.where('key').equals(historyKey).first()
      
      let history: IntegrityCheckResult[] = []
      if (historyRecord?.value) {
        history = historyRecord.value
      }

      // 添加新结果到开头
      history.unshift(result)

      // 限制历史记录数量
      if (history.length > 50) {
        history = history.slice(0, 50)
      }

      // 保存更新后的历史
      if (historyRecord) {
        await this.db.settings.update(historyRecord.id!, { value: history })
      } else {
        await this.db.settings.add({
          key: historyKey,
          value: history,
          scope: 'global',
          updatedAt: new Date()
        })
      }

    } catch (error) {
      console.warn('Failed to update integrity check history:', error)
    }
  }

  // ============================================================================
  // 备份管理和统计
  // ============================================================================

  /**
   * 获取备份统计信息
   */
  async getBackupStatistics(): Promise<BackupStatistics> {
    try {
      const backupList = await simpleBackupService.getBackupList()
      const storageStats = await simpleBackupService.getBackupStorageStats()
      
      const autoBackups = backupList.filter(b => b.tags.includes('auto-backup'))
      const manualBackups = backupList.filter(b => !b.tags.includes('auto-backup'))

      // 获取最近的完整性检查结果
      const lastIntegrityCheck = await this.getLastIntegrityCheckResult()

      return {
        totalBackups: backupList.length,
        autoBackups: autoBackups.length,
        manualBackups: manualBackups.length,
        totalSize: storageStats.totalSize,
        lastBackupTime: backupList.length > 0 ? backupList[0].createdAt : undefined,
        lastIntegrityCheck: lastIntegrityCheck?.startTime,
        integrityIssues: lastIntegrityCheck?.summary.totalIssues || 0,
        storageUsage: storageStats.totalSize,
        storageQuota: this.config.maxBackupStorageSize
      }

    } catch (error) {
      console.error('Failed to get backup statistics:', error)
      return {
        totalBackups: 0,
        autoBackups: 0,
        manualBackups: 0,
        totalSize: 0,
        integrityIssues: 0,
        storageUsage: 0,
        storageQuota: this.config.maxBackupStorageSize
      }
    }
  }

  /**
   * 更新备份统计
   */
  private async updateBackupStatistics(): Promise<void> {
    try {
      const stats = await this.getBackupStatistics()
      const key = 'backup_statistics'
      
      await this.db.settings.put({
        key,
        value: stats,
        scope: 'global',
        updatedAt: new Date()
      })

    } catch (error) {
      console.warn('Failed to update backup statistics:', error)
    }
  }

  /**
   * 获取最近的完整性检查结果
   */
  private async getLastIntegrityCheckResult(): Promise<IntegrityCheckResult | null> {
    try {
      const historyKey = 'integrity_check_history'
      const historyRecord = await this.db.settings.where('key').equals(historyKey).first()
      
      if (historyRecord?.value && historyRecord.value.length > 0) {
        return historyRecord.value[0]
      }

      return null

    } catch (error) {
      console.warn('Failed to get last integrity check result:', error)
      return null
    }
  }

  /**
   * 清理旧备份
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const backupList = await simpleBackupService.getBackupList()
      const cutoffDate = new Date(Date.now() - this.config.backupRetentionDays * 24 * 60 * 60 * 1000)
      
      const oldBackups = backupList.filter(backup => backup.createdAt < cutoffDate)
      
      for (const backup of oldBackups) {
        // 保留自动备份的最近几个
        if (backup.tags.includes('auto-backup')) {
          const autoBackups = backupList.filter(b => b.tags.includes('auto-backup'))
          const sortedAutoBackups = autoBackups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          const backupIndex = sortedAutoBackups.findIndex(b => b.id === backup.id)
          
          if (backupIndex < this.config.maxAutoBackups) {
            continue // 保留这个自动备份
          }
        }

        await simpleBackupService.deleteBackup(backup.id)
        console.log(`Cleaned up old backup: ${backup.id}`)
      }

    } catch (error) {
      console.warn('Failed to cleanup old backups:', error)
    }
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  /**
   * 更新配置
   */
  async updateConfig(config: Partial<EnhancedBackupConfig>): Promise<void> {
    const oldConfig = { ...this.config }
    this.config = { ...this.config, ...config }
    
    await this.saveConfig()
    
    // 重启定时器（如果间隔发生变化）
    if (oldConfig.autoBackupInterval !== this.config.autoBackupInterval) {
      if (this.config.autoBackupEnabled) {
        this.startAutoBackup()
      }
    }

    if (oldConfig.integrityCheckInterval !== this.config.integrityCheckInterval) {
      if (this.config.integrityCheckEnabled) {
        this.startIntegrityCheck()
      }
    }

    console.log('Configuration updated:', this.config)
  }

  /**
   * 获取配置
   */
  getConfig(): EnhancedBackupConfig {
    return { ...this.config }
  }

  /**
   * 保存配置
   */
  private async saveConfig(): Promise<void> {
    try {
      await this.db.settings.put({
        key: 'enhanced_backup_config',
        value: this.config,
        scope: 'global',
        updatedAt: new Date()
      })
    } catch (error) {
      console.warn('Failed to save config:', error)
    }
  }

  /**
   * 加载配置
   */
  private async loadConfig(): Promise<void> {
    try {
      const configRecord = await this.db.settings.where('key').equals('enhanced_backup_config').first()
      
      if (configRecord?.value) {
        this.config = { ...this.config, ...configRecord.value }
        console.log('Configuration loaded from storage')
      }
    } catch (error) {
      console.warn('Failed to load config:', error)
    }
  }

  // ============================================================================
  // 公共接口方法
  // ============================================================================

  /**
   * 创建手动备份
   */
  async createManualBackup(options?: Partial<BackupOptions>): Promise<string> {
    const backupOptions: BackupOptions = {
      name: `ManualBackup_${new Date().toISOString().split('T')[0]}`,
      includeImages: true,
      includeSettings: true,
      compress: this.config.compressionEnabled,
      encrypt: false,
      tags: ['manual-backup'],
      ...options
    }

    return await simpleBackupService.createBackup(backupOptions)
  }

  /**
   * 恢复备份
   */
  async restoreBackup(backupId: string): Promise<void> {
    try {
      console.log(`Starting backup restore: ${backupId}`)
      
      const backupData = await simpleBackupService.getBackup(backupId)
      if (!backupData) {
        throw new Error('Backup not found')
      }

      // 创建恢复前备份
      await this.createManualBackup({
        name: `PreRestoreBackup_${new Date().toISOString().split('T')[0]}`,
        tags: ['pre-restore']
      })

      // 执行恢复
      const importOptions: ImportOptions = {
        strategy: 'replace',
        importImages: true,
        importSettings: true,
        preserveIds: false,
        validateData: true,
        createBackup: false
      }

      // 将备份数据转换为导入格式
      const importData = {
        cards: backupData.cards,
        folders: backupData.folders,
        tags: backupData.tags,
        images: backupData.images,
        settings: backupData.settings
      }

      const result = await this.performDataImport(importData, importOptions)
      
      if (result.errors.length > 0) {
        console.warn('Restore completed with errors:', result.errors)
      } else {
        console.log('Backup restore completed successfully')
      }

    } catch (error) {
      console.error('Backup restore failed:', error)
      throw error
    }
  }

  /**
   * 获取备份列表
   */
  async getBackupList(): Promise<BackupMetadata[]> {
    return await simpleBackupService.getBackupList()
  }

  /**
   * 删除备份
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    return await simpleBackupService.deleteBackup(backupId)
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const enhancedLocalBackupService = EnhancedLocalBackupService.getInstance()

// ============================================================================
// 导出便利方法
// ============================================================================

export const initializeEnhancedBackup = (config?: Partial<EnhancedBackupConfig>) =>
  enhancedLocalBackupService.initialize(config)

export const createAutoBackup = () =>
  enhancedLocalBackupService.createAutoBackup()

export const exportDataAsJSON = (options?: Parameters<EnhancedLocalBackupService['exportDataAsJSON']>[0]) =>
  enhancedLocalBackupService.exportDataAsJSON(options)

export const importDataFromJSON = (file: File, options: ImportOptions) =>
  enhancedLocalBackupService.importDataFromJSON(file, options)

export const runIntegrityCheck = () =>
  enhancedLocalBackupService.runIntegrityCheck()

export const getBackupStatistics = () =>
  enhancedLocalBackupService.getBackupStatistics()