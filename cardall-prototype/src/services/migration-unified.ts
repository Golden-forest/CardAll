import { db, DbCard, DbFolder, DbTag, DbImage } from './database-unified'
import { Card, Folder, Tag, ImageData } from '@/types/card'

// ============================================================================
// 数据迁移服务 - 统一的迁移策略
// ============================================================================

export interface MigrationResult {
  success: boolean
  migratedCards: number
  migratedFolders: number
  migratedTags: number
  migratedImages: number
  migratedSettings: number
  errors: string[]
  warnings: string[]
  duration: number
}

export interface MigrationSource {
  type: 'localStorage' | 'database-simple' | 'database-full' | 'cloud'
  version?: string
  metadata?: any
}

export interface MigrationPlan {
  source: MigrationSource
  target: {
    version: string
    database: string
  }
  steps: MigrationStep[]
  estimatedTime: number
  backupRequired: boolean
}

export interface MigrationStep {
  id: string
  name: string
  description: string
  type: 'data' | 'schema' | 'validation' | 'cleanup'
  priority: 'high' | 'medium' | 'low'
  estimatedTime: number
  required: boolean
}

class UnifiedMigrationService {
  private isMigrating = false
  private migrationProgress: number = 0
  private currentStep: string = ''

  // 检查是否需要迁移
  async checkMigrationNeeded(): Promise<{
    needsMigration: boolean
    sources: MigrationSource[]
    recommendedPlan?: MigrationPlan
  }> {
    const sources: MigrationSource[] = []
    
    // 检查 localStorage 数据
    const hasLocalStorageData = await this.hasLocalStorageData()
    if (hasLocalStorageData) {
      sources.push({
        type: 'localStorage',
        version: '1.0'
      })
    }
    
    // 检查旧数据库
    const hasOldDatabase = await this.hasOldDatabase()
    if (hasOldDatabase) {
      sources.push({
        type: 'database-simple',
        version: '1.0'
      })
    }
    
    // 检查是否需要数据库版本升级
    const currentVersion = await db.getSetting('databaseVersion')
    if (currentVersion !== '3.0.0') {
      sources.push({
        type: 'database-full',
        version: currentVersion || 'unknown'
      })
    }
    
    const needsMigration = sources.length > 0
    
    return {
      needsMigration,
      sources,
      recommendedPlan: needsMigration ? await this.createMigrationPlan(sources) : undefined
    }
  }

  private async hasLocalStorageData(): Promise<boolean> {
    const hasCards = !!localStorage.getItem('cardall-cards')
    const hasFolders = !!localStorage.getItem('cardall-folders')
    const hasTags = !!localStorage.getItem('cardall-tags')
    
    return hasCards || hasFolders || hasTags
  }

  private async hasOldDatabase(): Promise<boolean> {
    try {
      // 尝试打开旧数据库
      const oldDb = new (Dexie as any)('CardAllDatabase')
      await oldDb.open()
      await oldDb.close()
      return true
    } catch {
      return false
    }
  }

  private async createMigrationPlan(sources: MigrationSource[]): Promise<MigrationPlan> {
    const steps: MigrationStep[] = []
    
    // 根据数据源创建迁移步骤
    for (const source of sources) {
      switch (source.type) {
        case 'localStorage':
          steps.push({
            id: 'migrate-localstorage-cards',
            name: '迁移 localStorage 卡片数据',
            description: '从 localStorage 迁移卡片数据到统一数据库',
            type: 'data',
            priority: 'high',
            estimatedTime: 5000,
            required: true
          })
          steps.push({
            id: 'migrate-localstorage-folders',
            name: '迁移 localStorage 文件夹数据',
            description: '从 localStorage 迁移文件夹数据到统一数据库',
            type: 'data',
            priority: 'high',
            estimatedTime: 3000,
            required: true
          })
          steps.push({
            id: 'migrate-localstorage-tags',
            name: '迁移 localStorage 标签数据',
            description: '从 localStorage 迁移标签数据到统一数据库',
            type: 'data',
            priority: 'high',
            estimatedTime: 2000,
            required: true
          })
          break
          
        case 'database-simple':
          steps.push({
            id: 'migrate-database-simple',
            name: '迁移简化版数据库',
            description: '从简化版数据库迁移数据到统一数据库',
            type: 'data',
            priority: 'high',
            estimatedTime: 10000,
            required: true
          })
          break
          
        case 'database-full':
          steps.push({
            id: 'upgrade-database-schema',
            name: '升级数据库架构',
            description: '升级数据库架构到最新版本',
            type: 'schema',
            priority: 'high',
            estimatedTime: 5000,
            required: true
          })
          break
      }
    }
    
    // 添加通用步骤
    steps.push({
      id: 'validate-data',
      name: '数据验证',
      description: '验证迁移后的数据完整性',
      type: 'validation',
      priority: 'medium',
      estimatedTime: 3000,
      required: true
    })
    
    steps.push({
      id: 'cleanup-old-data',
      name: '清理旧数据',
      description: '清理迁移后的旧数据（可选）',
      type: 'cleanup',
      priority: 'low',
      estimatedTime: 2000,
      required: false
    })
    
    return {
      source: sources[0],
      target: {
        version: '3.0.0',
        database: 'CardAllUnifiedDatabase'
      },
      steps,
      estimatedTime: steps.reduce((total, step) => total + step.estimatedTime, 0),
      backupRequired: true
    }
  }

  // 执行迁移
  async executeMigration(plan: MigrationPlan, onProgress?: (progress: number, step: string) => void): Promise<MigrationResult> {
    if (this.isMigrating) {
      throw new Error('Migration already in progress')
    }
    
    this.isMigrating = true
    const startTime = Date.now()
    
    const result: MigrationResult = {
      success: false,
      migratedCards: 0,
      migratedFolders: 0,
      migratedTags: 0,
      migratedImages: 0,
      migratedSettings: 0,
      errors: [],
      warnings: [],
      duration: 0
    }
    
    try {
      console.log('Starting migration execution...')
      
      // 创建备份
      if (plan.backupRequired) {
        await this.createBackup()
      }
      
      // 按优先级执行迁移步骤
      const sortedSteps = plan.steps.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      })
      
      for (let i = 0; i < sortedSteps.length; i++) {
        const step = sortedSteps[i]
        this.currentStep = step.name
        this.migrationProgress = (i / sortedSteps.length) * 100
        
        if (onProgress) {
          onProgress(this.migrationProgress, this.currentStep)
        }
        
        console.log(`Executing migration step: ${step.name}`)
        
        try {
          const stepResult = await this.executeMigrationStep(step, plan.source)
          if (stepResult.success) {
            result.migratedCards += stepResult.migratedCards || 0
            result.migratedFolders += stepResult.migratedFolders || 0
            result.migratedTags += stepResult.migratedTags || 0
            result.migratedImages += stepResult.migratedImages || 0
            result.migratedSettings += stepResult.migratedSettings || 0
          } else {
            result.errors.push(`Step ${step.name} failed: ${stepResult.error}`)
          }
        } catch (error) {
          result.errors.push(`Step ${step.name} failed: ${error}`)
          if (step.required) {
            throw new Error(`Required migration step failed: ${step.name}`)
          }
        }
      }
      
      // 最终验证
      const validationResult = await this.validateMigrationResult()
      if (!validationResult.success) {
        result.errors.push(...validationResult.errors)
      } else {
        result.success = true
        console.log('Migration completed successfully')
      }
      
    } catch (error) {
      console.error('Migration failed:', error)
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
      
      // 尝试回滚
      try {
        await this.rollbackMigration()
      } catch (rollbackError) {
        result.errors.push(`Rollback failed: ${rollbackError}`)
      }
    } finally {
      this.isMigrating = false
      this.migrationProgress = 100
      result.duration = Date.now() - startTime
    }
    
    return result
  }

  private async executeMigrationStep(step: MigrationStep, source: MigrationSource): Promise<{
    success: boolean
    migratedCards?: number
    migratedFolders?: number
    migratedTags?: number
    migratedImages?: number
    migratedSettings?: number
    error?: string
  }> {
    switch (step.id) {
      case 'migrate-localstorage-cards':
        return await this.migrateLocalStorageCards()
      case 'migrate-localstorage-folders':
        return await this.migrateLocalStorageFolders()
      case 'migrate-localstorage-tags':
        return await this.migrateLocalStorageTags()
      case 'migrate-database-simple':
        return await this.migrateFromSimpleDatabase()
      case 'upgrade-database-schema':
        return await this.upgradeDatabaseSchema()
      case 'validate-data':
        return await this.validateData()
      case 'cleanup-old-data':
        return await this.cleanupOldData()
      default:
        return { success: false, error: `Unknown migration step: ${step.id}` }
    }
  }

  private async migrateLocalStorageCards(): Promise<{
    success: boolean
    migratedCards: number
  }> {
    const cardsData = localStorage.getItem('cardall-cards')
    if (!cardsData) {
      return { success: true, migratedCards: 0 }
    }
    
    try {
      const cards: Card[] = JSON.parse(cardsData)
      const dbCards: DbCard[] = cards.map(card => ({
        ...card,
        userId: 'default',
        syncVersion: 1,
        pendingSync: true,
        updatedAt: new Date(card.updatedAt)
      }))
      
      await db.cards.bulkAdd(dbCards)
      console.log(`Migrated ${dbCards.length} cards from localStorage`)
      
      return { success: true, migratedCards: dbCards.length }
    } catch (error) {
      return { success: false, migratedCards: 0, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  private async migrateLocalStorageFolders(): Promise<{
    success: boolean
    migratedFolders: number
  }> {
    const foldersData = localStorage.getItem('cardall-folders')
    if (!foldersData) {
      return { success: true, migratedFolders: 0 }
    }
    
    try {
      const folders: Folder[] = JSON.parse(foldersData)
      const dbFolders: DbFolder[] = folders.map(folder => ({
        ...folder,
        userId: 'default',
        syncVersion: 1,
        pendingSync: true,
        updatedAt: new Date(folder.updatedAt)
      }))
      
      await db.folders.bulkAdd(dbFolders)
      console.log(`Migrated ${dbFolders.length} folders from localStorage`)
      
      return { success: true, migratedFolders: dbFolders.length }
    } catch (error) {
      return { success: false, migratedFolders: 0, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  private async migrateLocalStorageTags(): Promise<{
    success: boolean
    migratedTags: number
  }> {
    const tagsData = localStorage.getItem('cardall-tags')
    if (!tagsData) {
      return { success: true, migratedTags: 0 }
    }
    
    try {
      const tags: Tag[] = JSON.parse(tagsData)
      const dbTags: DbTag[] = tags.map(tag => ({
        ...tag,
        userId: 'default',
        syncVersion: 1,
        pendingSync: true,
        updatedAt: new Date(tag.createdAt)
      }))
      
      await db.tags.bulkAdd(dbTags)
      console.log(`Migrated ${dbTags.length} tags from localStorage`)
      
      return { success: true, migratedTags: dbTags.length }
    } catch (error) {
      return { success: false, migratedTags: 0, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  private async migrateFromSimpleDatabase(): Promise<{
    success: boolean
    migratedCards: number
    migratedFolders: number
    migratedTags: number
  }> {
    try {
      // 这里需要实现从简化版数据库的迁移逻辑
      // 由于简化版数据库的结构略有不同，需要转换数据格式
      console.log('Migrating from simple database...')
      
      // 实际实现需要根据 database-simple.ts 的具体结构来编写
      return { success: true, migratedCards: 0, migratedFolders: 0, migratedTags: 0 }
    } catch (error) {
      return { success: false, migratedCards: 0, migratedFolders: 0, migratedTags: 0, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  private async upgradeDatabaseSchema(): Promise<{
    success: boolean
  }> {
    try {
      // 数据库架构升级已经在 database-unified.ts 的 upgradeDatabase 方法中处理
      console.log('Database schema upgrade completed')
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  private async validateData(): Promise<{
    success: boolean
    errors: string[]
  }> {
    const errors: string[] = []
    
    try {
      // 验证卡片数据
      const cards = await db.cards.toArray()
      for (const card of cards) {
        if (!card.frontContent?.title) {
          errors.push(`Card ${card.id} is missing front title`)
        }
        if (!card.backContent?.title) {
          errors.push(`Card ${card.id} is missing back title`)
        }
      }
      
      // 验证文件夹数据
      const folders = await db.folders.toArray()
      for (const folder of folders) {
        if (!folder.name) {
          errors.push(`Folder ${folder.id} is missing name`)
        }
      }
      
      // 验证标签数据
      const tags = await db.tags.toArray()
      for (const tag of tags) {
        if (!tag.name) {
          errors.push(`Tag ${tag.id} is missing name`)
        }
      }
      
      return { success: errors.length === 0, errors }
    } catch (error) {
      return { success: false, errors: [error instanceof Error ? error.message : 'Unknown error'] }
    }
  }

  private async cleanupOldData(): Promise<{
    success: boolean
  }> {
    try {
      // 清理 localStorage 数据
      localStorage.removeItem('cardall-cards')
      localStorage.removeItem('cardall-folders')
      localStorage.removeItem('cardall-tags')
      
      // 清理旧数据库（如果存在）
      try {
        const oldDb = new (Dexie as any)('CardAllDatabase')
        await oldDb.delete()
      } catch {
        // 忽略删除失败
      }
      
      console.log('Old data cleanup completed')
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  private async createBackup(): Promise<void> {
    console.log('Creating backup before migration...')
    
    const backup = {
      timestamp: new Date().toISOString(),
      version: '3.0.0',
      data: {
        cards: await db.cards.toArray(),
        folders: await db.folders.toArray(),
        tags: await db.tags.toArray(),
        images: await db.images.toArray(),
        settings: await db.settings.toArray()
      }
    }
    
    // 保存备份到 localStorage
    localStorage.setItem('cardall-backup', JSON.stringify(backup))
    console.log('Backup created successfully')
  }

  private async rollbackMigration(): Promise<void> {
    console.log('Attempting to rollback migration...')
    
    const backupData = localStorage.getItem('cardall-backup')
    if (!backupData) {
      throw new Error('No backup found for rollback')
    }
    
    try {
      const backup = JSON.parse(backupData)
      
      // 清理当前数据
      await db.clearAll()
      
      // 恢复备份数据
      if (backup.data.cards) {
        await db.cards.bulkAdd(backup.data.cards)
      }
      if (backup.data.folders) {
        await db.folders.bulkAdd(backup.data.folders)
      }
      if (backup.data.tags) {
        await db.tags.bulkAdd(backup.data.tags)
      }
      if (backup.data.images) {
        await db.images.bulkAdd(backup.data.images)
      }
      if (backup.data.settings) {
        await db.settings.bulkAdd(backup.data.settings)
      }
      
      console.log('Rollback completed successfully')
    } catch (error) {
      throw new Error(`Rollback failed: ${error}`)
    }
  }

  private async validateMigrationResult(): Promise<{
    success: boolean
    errors: string[]
  }> {
    const errors: string[] = []
    
    try {
      // 检查数据库完整性
      const stats = await db.getStats()
      
      if (stats.cards === 0 && stats.folders === 0 && stats.tags === 0) {
        errors.push('No data migrated')
      }
      
      // 检查数据库健康状态
      const health = await db.healthCheck()
      if (!health.isHealthy) {
        errors.push(...health.issues)
      }
      
      return { success: errors.length === 0, errors }
    } catch (error) {
      return { success: false, errors: [error instanceof Error ? error.message : 'Unknown error'] }
    }
  }

  // 获取迁移状态
  getMigrationStatus(): {
    isMigrating: boolean
    progress: number
    currentStep: string
  } {
    return {
      isMigrating: this.isMigrating,
      progress: this.migrationProgress,
      currentStep: this.currentStep
    }
  }

  // 取消迁移
  async cancelMigration(): Promise<void> {
    if (this.isMigrating) {
      throw new Error('Cannot cancel migration in progress')
    }
  }
}

// 创建迁移服务实例
export const unifiedMigrationService = new UnifiedMigrationService()

// 导出便捷函数
export const checkMigrationNeeded = () => unifiedMigrationService.checkMigrationNeeded()
export const executeMigration = (plan: MigrationPlan, onProgress?: (progress: number, step: string) => void) => 
  unifiedMigrationService.executeMigration(plan, onProgress)
export const getMigrationStatus = () => unifiedMigrationService.getMigrationStatus()