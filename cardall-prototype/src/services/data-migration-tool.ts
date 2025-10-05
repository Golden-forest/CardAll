import { db, DbCard, DbFolder, DbTag, DbImage, AppSettings, OfflineSnapshot } from './database-unified'
import { Card, Folder, Tag, ImageData } from '@/types/card'
import { fileSystemService } from './file-system'
import { supabase } from './supabase'

// ============================================================================
// 数据迁移工具 - 安全、可靠的数据迁移机制
// ============================================================================

export export export export export export export }

export   consistency: {
    referencesValid: boolean
    duplicatesFound: number
    orphansFound: number
  }
  performance: {
    totalTime: number
    dataSize: number
    throughput: number // MB/s
  }
  issues: string[]
  recommendations: string[]
}

/**
 * 统一数据迁移工具
 * 提供安全、可靠的数据迁移机制
 */
class DataMigrationTool {
  private isMigrating = false
  private currentPlan: MigrationPlan | null = null
  private progressCallbacks: Set<(progress: MigrationProgress) => void> = new Set()
  private migrationQueue: MigrationPlan[] = []
  private activeMigrations = new Map<string, MigrationProgress>()
  private retryDelays = [1000, 2000, 5000, 10000, 30000] // 重试延迟

  /**
   * 获取当前用户ID
   */
  private async getCurrentUserId(): Promise<string | null> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (user && !userError) {
        console.log(`数据迁移工具获取到当前用户ID: ${user.id}`)
        return user.id
      }
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (session?.user && !sessionError) {
        console.log(`数据迁移工具从会话获取到用户ID: ${session.user.id}`)
        return session.user.id
      }
      console.warn('数据迁移工具无法获取当前用户ID,将使用默认值')
      return null
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 分析数据源并创建迁移计划
   */
  async analyzeAndCreatePlan(source: MigrationSource): Promise<MigrationPlan> {
    console.log(`Analyzing migration source: ${source.type}`)

    const sourceData = await this.analyzeDataSource(source)
    const target: MigrationTarget = {
      version: '4.0.0',
      database: 'CardAllUnifiedDatabase',
      schema: await this.getTargetSchema()
    }

    const steps = this.createMigrationSteps(source, sourceData, target)

    const plan: MigrationPlan = {
      id: crypto.randomUUID(),
      source,
      target,
      steps,
      estimatedTime: steps.reduce((total, step) => total + step.estimatedTime, 0),
      backupRequired: this.needsBackup(source),
      rollbackEnabled: true,
      validationLevel: this.getValidationLevel(source)
    }

    console.log(`Migration plan created: ${plan.id}`)
    return plan
  }

  /**
   * 分析数据源
   */
  private async analyzeDataSource(source: MigrationSource): Promise<any> {
    switch (source.type) {
      case 'localStorage':
        return await this.analyzeLocalStorage()
      case 'database-simple':
        return await this.analyzeSimpleDatabase()
      case 'database-full':
        return await this.analyzeFullDatabase()
      case 'backup':
        return await this.analyzeBackup(source.path!)
      case 'cloud':
        return await this.analyzeCloudSource()
      default:
        throw new Error(`Unknown migration source: ${source.type}`)
    }
  }

  /**
   * 分析localStorage数据源
   */
  private async analyzeLocalStorage(): Promise<any> {
    const data: any = {}

    // 分析卡片数据
    const cardsData = localStorage.getItem('cardall-cards')
    if (cardsData) {
      try {
        data.cards = JSON.parse(cardsData)
        data.cardCount = data.cards.length
        data.hasImages = data.cards.some((card: Card) =>
          card.frontContent.images.length > 0 || card.backContent.images.length > 0
        )
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }

    // 分析文件夹数据
    const foldersData = localStorage.getItem('cardall-folders')
    if (foldersData) {
      try {
        data.folders = JSON.parse(foldersData)
        data.folderCount = data.folders.length
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }

    // 分析标签数据
    const tagsData = localStorage.getItem('cardall-tags')
    if (tagsData) {
      try {
        data.tags = JSON.parse(tagsData)
        data.tagCount = data.tags.length
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }

    // 分析设置数据
    const hiddenTags = localStorage.getItem('cardall-hidden-tags')
    if (hiddenTags) {
      try {
        data.hiddenTags = JSON.parse(hiddenTags)
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }

    // 计算数据大小
    data.size = this.calculateDataSize(data)

    return data
  }

  /**
   * 分析简化版数据库
   */
  private async analyzeSimpleDatabase(): Promise<any> {
    try {
      // 尝试连接旧数据库
      const oldDb = new (Dexie as any)('CardAllDatabase')
      await oldDb.open()

      const stats = {
        cardCount: await oldDb.cards.count(),
        folderCount: await oldDb.folders.count(),
        tagCount: await oldDb.tags.count(),
        imageCount: await oldDb.images.count(),
        syncQueueCount: await oldDb.syncQueue.count()
      }

      await oldDb.close()

      return {
        ...stats,
        type: 'simple-database',
        size: 0 // 简化版本
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 分析完整版数据库
   */
  private async analyzeFullDatabase(): Promise<any> {
    try {
      const stats = await db.getStats()
      const health = await db.healthCheck()

      return {
        ...stats,
        isHealthy: health.isHealthy,
        issues: health.issues,
        type: 'full-database'
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 分析备份文件
   */
  private async analyzeBackup(backupPath: string): Promise<any> {
    try {
      // 这里可以实现从文件系统读取备份
      const backupData = localStorage.getItem(backupPath)
      if (!backupData) {
        return { exists: false }
      }

      const backup = JSON.parse(backupData)
      return {
        ...backup,
        type: 'backup',
        size: JSON.stringify(backup).length
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 分析云端数据源
   */
  private async analyzeCloudSource(): Promise<any> {
    // 这里可以实现云端数据源分析
    return {
      type: 'cloud',
      supported: false,
      message: 'Cloud migration not yet implemented'
    }
  }

  /**
   * 获取目标架构
   */
  private async getTargetSchema(): Promise<Record<string, any>> {
    return {
      cards: {
        version: 4,
        indexes: ['userId', 'folderId', 'createdAt', 'updatedAt', 'syncVersion', 'pendingSync'],
        requiredFields: ['frontContent.title', 'backContent.title']
      },
      folders: {
        version: 4,
        indexes: ['userId', 'parentId', 'createdAt', 'updatedAt', 'syncVersion', 'pendingSync'],
        requiredFields: ['name']
      },
      tags: {
        version: 4,
        indexes: ['userId', 'name', 'createdAt', 'syncVersion', 'pendingSync'],
        requiredFields: ['name']
      },
      images: {
        version: 4,
        indexes: ['cardId', 'userId', 'createdAt', 'updatedAt', 'syncVersion', 'pendingSync'],
        requiredFields: ['cardId', 'fileName', 'filePath', 'metadata']
      },
      syncQueue: {
        version: 4,
        indexes: ['type', 'entity', 'entityId', 'timestamp', 'priority'],
        requiredFields: ['type', 'entity', 'entityId']
      }
    }
  }

  /**
   * 创建迁移步骤
   */
  private createMigrationSteps(source: MigrationSource, sourceData: any, target: MigrationTarget): MigrationStep[] {
    const steps: MigrationStep[] = []

    // 数据验证步骤
    steps.push({
      id: 'validate-source',
      name: '验证源数据',
      description: '验证源数据的完整性和可用性',
      type: 'validation',
      priority: 'critical',
      estimatedTime: 1000,
      required: true
    })

    // 创建备份步骤
    if (this.needsBackup(source)) {
      steps.push({
        id: 'create-backup',
        name: '创建数据备份',
        description: '创建当前数据的完整备份',
        type: 'backup',
        priority: 'critical',
        estimatedTime: 5000,
        required: true,
        retryCount: 0,
        maxRetries: 3
      })
    }

    // 根据数据源类型添加迁移步骤
    switch (source.type) {
      case 'localStorage':
        if (sourceData.cardCount > 0) {
          steps.push({
            id: 'migrate-cards',
            name: '迁移卡片数据',
            description: `迁移 ${sourceData.cardCount} 个卡片`,
            type: 'data',
            priority: 'high',
            estimatedTime: Math.max(2000, sourceData.cardCount * 10),
            required: true,
            retryCount: 0,
            maxRetries: 5
          })
        }

        if (sourceData.folderCount > 0) {
          steps.push({
            id: 'migrate-folders',
            name: '迁移文件夹数据',
            description: `迁移 ${sourceData.folderCount} 个文件夹`,
            type: 'data',
            priority: 'high',
            estimatedTime: Math.max(1000, sourceData.folderCount * 5),
            required: true
          })
        }

        if (sourceData.tagCount > 0) {
          steps.push({
            id: 'migrate-tags',
            name: '迁移标签数据',
            description: `迁移 ${sourceData.tagCount} 个标签`,
            type: 'data',
            priority: 'high',
            estimatedTime: Math.max(500, sourceData.tagCount * 2),
            required: true
          })
        }

        if (sourceData.hasImages) {
          steps.push({
            id: 'migrate-images',
            name: '迁移图片数据',
            description: '迁移卡片中的图片文件',
            type: 'data',
            priority: 'medium',
            estimatedTime: 10000,
            required: true,
            retryCount: 0,
            maxRetries: 3
          })
        }
        break

      case 'database-simple':
        steps.push({
          id: 'migrate-simple-db',
          name: '迁移简化版数据库',
          description: '从简化版数据库迁移所有数据',
          type: 'data',
          priority: 'high',
          estimatedTime: 15000,
          required: true,
          retryCount: 0,
          maxRetries: 3
        })
        break

      case 'database-full':
        steps.push({
          id: 'upgrade-schema',
          name: '升级数据库架构',
          description: '升级到最新版本的数据库架构',
          type: 'schema',
          priority: 'critical',
          estimatedTime: 5000,
          required: true
        })
        break
    }

    // 数据转换和优化步骤
    steps.push({
      id: 'transform-data',
      name: '数据转换和优化',
      description: '转换数据格式并优化性能',
      type: 'data',
      priority: 'medium',
      estimatedTime: 3000,
      required: true
    })

    // 验证迁移结果
    steps.push({
      id: 'validate-migration',
      name: '验证迁移结果',
      description: '验证迁移后数据的完整性和一致性',
      type: 'validation',
      priority: 'high',
      estimatedTime: 2000,
      required: true
    })

    // 清理步骤（可选）
    steps.push({
      id: 'cleanup-source',
      name: '清理源数据',
      description: '清理迁移后的源数据（可选）',
      type: 'cleanup',
      priority: 'low',
      estimatedTime: 1000,
      required: false
    })

    return steps
  }

  /**
   * 判断是否需要备份
   */
  private needsBackup(source: MigrationSource): boolean {
    return source.type !== 'backup' // 非备份源需要备份
  }

  /**
   * 获取验证级别
   */
  private getValidationLevel(source: MigrationSource): 'basic' | 'strict' | 'comprehensive' {
    switch (source.type) {
      case 'localStorage':
        return 'strict'
      case 'database-full':
        return 'basic'
      default:
        return 'comprehensive'
    }
  }

  /**
   * 计算数据大小
   */
  private calculateDataSize(data: any): number {
    return JSON.stringify(data).length
  }

  /**
   * 执行迁移计划
   */
  async executeMigration(plan: MigrationPlan): Promise<MigrationResult> {
    if (this.isMigrating) {
      throw new Error('Migration already in progress')
    }

    this.isMigrating = true
    this.currentPlan = plan
    const startTime = Date.now()

    const result: MigrationResult = {
      success: false,
      planId: plan.id,
      executedAt: new Date(),
      duration: 0,
      stepsCompleted: 0,
      totalSteps: plan.steps.length,
      migratedCards: 0,
      migratedFolders: 0,
      migratedTags: 0,
      migratedImages: 0,
      migratedSettings: 0,
      dataSize: 0,
      errors: [],
      warnings: [],
      validationPassed: false
    }

    const progress: MigrationProgress = {
      planId: plan.id,
      status: 'running',
      progress: 0,
      currentStep: '',
      currentStepProgress: 0,
      startTime: new Date(),
      speed: 0
    }

    this.activeMigrations.set(plan.id, progress)
    this.notifyProgress(progress)

    try {
      console.log(`Starting migration plan: ${plan.id}`)

      // 创建回滚点
      const rollbackPoint = await this.createRollbackPoint()
      result.rollbackPoint = rollbackPoint

      // 按优先级执行迁移步骤
      const sortedSteps = this.sortStepsByPriority(plan.steps)

      for (let i = 0; i < sortedSteps.length; i++) {
        const step = sortedSteps[i]
        progress.currentStep = step.name
        progress.currentStepProgress = 0
        progress.progress = (i / sortedSteps.length) * 100

        this.notifyProgress(progress)

        console.log(`Executing migration step: ${step.name}`)

        try {
          const stepResult = await this.executeStep(step, plan)
          result.stepsCompleted++

          if (stepResult.success) {
            // 更新迁移统计
            result.migratedCards += stepResult.migratedCards || 0
            result.migratedFolders += stepResult.migratedFolders || 0
            result.migratedTags += stepResult.migratedTags || 0
            result.migratedImages += stepResult.migratedImages || 0
            result.migratedSettings += stepResult.migratedSettings || 0
            result.dataSize += stepResult.dataSize || 0

            if (stepResult.warnings) {
              result.warnings.push(...stepResult.warnings)
            }
          } else {
            const errorMsg = `Step ${step.name} failed: ${stepResult.error}`
            result.errors.push(errorMsg)

            if (step.required) {
              throw new Error(`Required migration step failed: ${step.name}`)
            }
          }
        } catch (error) {
          console.warn("操作失败:", error)
        } failed: ${error}`
          result.errors.push(errorMsg)

          // 重试逻辑
          if (step.required && step.retryCount! < (step.maxRetries || 3)) {
            console.log(`Retrying step ${step.name} (${step.retryCount! + 1}/${step.maxRetries})`)
            step.retryCount = (step.retryCount || 0) + 1
            i-- // 重试当前步骤
            await this.delay(this.retryDelays[step.retryCount - 1])
            continue
          }

          if (step.required) {
            throw error
          }
        }
      }

      // 验证迁移结果
      const validation = await this.validateMigration(plan)
      result.validationPassed = validation.success

      if (!validation.success) {
        result.errors.push('Migration validation failed')
        result.errors.push(...validation.issues)
      } else {
        result.success = true
        console.log('Migration completed successfully')
      }

    } catch (error) {
          console.warn("操作失败:", error)
        } catch (error) {
          console.warn("操作失败:", error)
        }`)
      }
    } finally {
      this.isMigrating = false
      progress.status = result.success ? 'completed' : 'failed'
      progress.progress = 100
      progress.currentStepProgress = 100
      progress.currentStep = result.success ? 'Migration completed' : 'Migration failed'

      result.duration = Date.now() - startTime

      this.notifyProgress(progress)
      this.activeMigrations.delete(plan.id)

      // 清理临时数据
      await this.cleanupMigration(plan.id)
    }

    return result
  }

  /**
   * 按优先级排序步骤
   */
  private sortStepsByPriority(steps: MigrationStep[]): MigrationStep[] {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
    return [...steps].sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
  }

  /**
   * 创建回滚点
   */
  private async createRollbackPoint(): Promise<string> {
    const rollbackId = crypto.randomUUID()
    const timestamp = new Date()

    try {
      // 创建完整的数据库备份
      const backup = {
        id: rollbackId,
        timestamp,
        version: '4.0.0',
        data: {
          cards: await db.cards.toArray(),
          folders: await db.folders.toArray(),
          tags: await db.tags.toArray(),
          images: await db.images.toArray(),
          settings: await db.settings.toArray(),
          syncQueue: await db.syncQueue.toArray()
        },
        checksum: await this.calculateChecksum()
      }

      // 保存回滚点
      await db.settings.add({
        key: `rollback_${rollbackId}`,
        value: backup,
        updatedAt: new Date(),
        scope: 'global'
      })

      console.log(`Rollback point created: ${rollbackId}`)
      return rollbackId
    } catch (error) {
          console.warn("操作失败:", error)
        }`)
    }
  }

  /**
   * 执行迁移步骤
   */
  private async executeStep(step: MigrationStep, plan: MigrationPlan): Promise<{
    success: boolean
    migratedCards?: number
    migratedFolders?: number
    migratedTags?: number
    migratedImages?: number
    migratedSettings?: number
    dataSize?: number
    warnings?: string[]
    error?: string
  }> {
    try {
      switch (step.id) {
        case 'validate-source':
          return await this.validateSource(plan.source)

        case 'create-backup':
          return await this.createBackup(plan)

        case 'migrate-cards':
          return await this.migrateCardsFromLocalStorage()

        case 'migrate-folders':
          return await this.migrateFoldersFromLocalStorage()

        case 'migrate-tags':
          return await this.migrateTagsFromLocalStorage()

        case 'migrate-images':
          return await this.migrateImagesFromLocalStorage()

        case 'migrate-simple-db':
          return await this.migrateFromSimpleDatabase()

        case 'upgrade-schema':
          return await this.upgradeDatabaseSchema()

        case 'transform-data':
          return await this.transformData()

        case 'validate-migration':
          return await this.validateMigrationStep(plan)

        case 'cleanup-source':
          return await this.cleanupSource(plan.source)

        default:
          return { success: false, error: `Unknown migration step: ${step.id}` }
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 验证源数据
   */
  private async validateSource(source: MigrationSource): Promise<{
    success: boolean
    warnings?: string[]
    error?: string
  }> {
    try {
      const warnings: string[] = []

      switch (source.type) {
        case 'localStorage':
          // 验证localStorage数据格式
          const cardsData = localStorage.getItem('cardall-cards')
          if (cardsData) {
            try {
              const cards = JSON.parse(cardsData)
              if (!Array.isArray(cards)) {
                warnings.push('Cards data is not an array')
              }
            } catch {
              warnings.push('Invalid cards data format')
            }
          }

          const foldersData = localStorage.getItem('cardall-folders')
          if (foldersData) {
            try {
              const folders = JSON.parse(foldersData)
              if (!Array.isArray(folders)) {
                warnings.push('Folders data is not an array')
              }
            } catch {
              warnings.push('Invalid folders data format')
            }
          }
          break

        case 'database-simple':
          // 验证旧数据库
          try {
            const oldDb = new (Dexie as any)('CardAllDatabase')
            await oldDb.open()
            await oldDb.close()
          } catch {
            warnings.push('Cannot connect to legacy database')
          }
          break
      }

      return {
        success: true,
        warnings: warnings.length > 0 ? warnings : undefined
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 创建备份
   */
  private async createBackup(plan: MigrationPlan): Promise<{
    success: boolean
    dataSize?: number
    warnings?: string[]
    error?: string
  }> {
    try {
      console.log('Creating backup before migration...')

      const backup = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        planId: plan.id,
        source: plan.source,
        data: {
          cards: await db.cards.toArray(),
          folders: await db.folders.toArray(),
          tags: await db.tags.toArray(),
          images: await db.images.toArray(),
          settings: await db.settings.toArray(),
          syncQueue: await db.syncQueue.toArray()
        },
        checksum: await this.calculateChecksum()
      }

      const dataSize = JSON.stringify(backup.data).length

      // 保存备份到数据库
      await db.settings.add({
        key: `migration_backup_${backup.id}`,
        value: backup,
        updatedAt: new Date(),
        scope: 'global'
      })

      // 同时保存到localStorage作为额外保护
      localStorage.setItem(`migration_backup_${backup.id}`, JSON.stringify(backup))

      console.log(`Backup created successfully (${dataSize} bytes)`)

      return {
        success: true,
        dataSize
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 从localStorage迁移卡片
   */
  private async migrateCardsFromLocalStorage(): Promise<{
    success: boolean
    migratedCards: number
    dataSize: number
    warnings?: string[]
    error?: string
  }> {
    // 获取当前用户ID
    const currentUserId = await this.getCurrentUserId()
    if (!currentUserId) {
      return {
        success: false,
        migratedCards: 0,
        dataSize: 0,
        error: '无法获取当前用户ID,迁移中止'
      }
    }

    const cardsData = localStorage.getItem('cardall-cards')
    if (!cardsData) {
      return { success: true, migratedCards: 0, dataSize: 0 }
    }

    try {
      const cards: Card[] = JSON.parse(cardsData)
      const dbCards: DbCard[] = []
      let totalSize = 0

      for (const card of cards) {
        const dbCard: DbCard = {
          ...card,
          userId: currentUserId,
          syncVersion: 1,
          pendingSync: true,
          updatedAt: new Date(card.updatedAt),
          searchVector: this.generateSearchVector(card),
          folderId: card.folderId
        }

        dbCards.push(dbCard)
        totalSize += JSON.stringify(dbCard).length
      }

      await db.cards.bulkAdd(dbCards)
      console.log(`Migrated ${dbCards.length} cards from localStorage`)

      return {
        success: true,
        migratedCards: dbCards.length,
        dataSize: totalSize
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 从localStorage迁移文件夹
   */
  private async migrateFoldersFromLocalStorage(): Promise<{
    success: boolean
    migratedFolders: number
    dataSize: number
    error?: string
  }> {
    // 获取当前用户ID
    const currentUserId = await this.getCurrentUserId()
    if (!currentUserId) {
      return {
        success: false,
        migratedFolders: 0,
        dataSize: 0,
        error: '无法获取当前用户ID,迁移中止'
      }
    }

    const foldersData = localStorage.getItem('cardall-folders')
    if (!foldersData) {
      return { success: true, migratedFolders: 0, dataSize: 0 }
    }

    try {
      const folders: Folder[] = JSON.parse(foldersData)
      const dbFolders: DbFolder[] = []
      let totalSize = 0

      for (const folder of folders) {
        const dbFolder: DbFolder = {
          ...folder,
          userId: currentUserId,
          syncVersion: 1,
          pendingSync: true,
          updatedAt: new Date(folder.updatedAt),
          fullPath: this.generateFullPath(folder),
          depth: this.calculateDepth(folder)
        }

        dbFolders.push(dbFolder)
        totalSize += JSON.stringify(dbFolder).length
      }

      await db.folders.bulkAdd(dbFolders)
      console.log(`Migrated ${dbFolders.length} folders from localStorage`)

      return {
        success: true,
        migratedFolders: dbFolders.length,
        dataSize: totalSize
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 从localStorage迁移标签
   */
  private async migrateTagsFromLocalStorage(): Promise<{
    success: boolean
    migratedTags: number
    dataSize: number
    error?: string
  }> {
    // 获取当前用户ID
    const currentUserId = await this.getCurrentUserId()
    if (!currentUserId) {
      return {
        success: false,
        migratedTags: 0,
        dataSize: 0,
        error: '无法获取当前用户ID,迁移中止'
      }
    }

    const tagsData = localStorage.getItem('cardall-tags')
    if (!tagsData) {
      return { success: true, migratedTags: 0, dataSize: 0 }
    }

    try {
      const tags: Tag[] = JSON.parse(tagsData)
      const dbTags: DbTag[] = []
      let totalSize = 0

      for (const tag of tags) {
        const dbTag: DbTag = {
          ...tag,
          userId: currentUserId,
          syncVersion: 1,
          pendingSync: true,
          updatedAt: new Date(tag.createdAt),
          count: 0 // 初始计数
        }

        dbTags.push(dbTag)
        totalSize += JSON.stringify(dbTag).length
      }

      await db.tags.bulkAdd(dbTags)
      console.log(`Migrated ${dbTags.length} tags from localStorage`)

      return {
        success: true,
        migratedTags: dbTags.length,
        dataSize: totalSize
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 从localStorage迁移图片
   */
  private async migrateImagesFromLocalStorage(): Promise<{
    success: boolean
    migratedImages: number
    dataSize: number
    warnings?: string[]
    error?: string
  }> {
    // 获取当前用户ID
    const currentUserId = await this.getCurrentUserId()
    if (!currentUserId) {
      return {
        success: false,
        migratedImages: 0,
        dataSize: 0,
        error: '无法获取当前用户ID,迁移中止'
      }
    }

    const cardsData = localStorage.getItem('cardall-cards')
    if (!cardsData) {
      return { success: true, migratedImages: 0, dataSize: 0 }
    }

    try {
      const cards: Card[] = JSON.parse(cardsData)
      const warnings: string[] = []
      let migratedImages = 0
      let totalSize = 0

      for (const card of cards) {
        // 处理正面图片
        for (const image of card.frontContent.images) {
          if (image.url && image.url.startsWith('data:')) {
            const result = await this.migrateImage(image, card.id, currentUserId, card.folderId)
            if (result.success) {
              migratedImages++
              totalSize += result.size
            } else {
              warnings.push(`Failed to migrate image from card ${card.id}: ${result.error}`)
            }
          }
        }

        // 处理背面图片
        for (const image of card.backContent.images) {
          if (image.url && image.url.startsWith('data:')) {
            const result = await this.migrateImage(image, card.id, currentUserId, card.folderId)
            if (result.success) {
              migratedImages++
              totalSize += result.size
            } else {
              warnings.push(`Failed to migrate image from card ${card.id}: ${result.error}`)
            }
          }
        }
      }

      console.log(`Migrated ${migratedImages} images from localStorage`)

      return {
        success: true,
        migratedImages,
        dataSize: totalSize,
        warnings: warnings.length > 0 ? warnings : undefined
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 迁移单个图片
   */
  private async migrateImage(image: ImageData, cardId: string, userId: string, folderId?: string): Promise<{
    success: boolean
    size: number
    error?: string
  }> {
    try {
      if (!image.url || !image.url.startsWith('data:')) {
        return { success: true, size: 0 } // 非base64图片,无需迁移
      }

      // 转换base64为Blob
      const blob = await this.base64ToBlob(image.url)
      const file = new File([blob], image.alt || 'migrated-image.jpg', {
        type: blob.type
      })

      // 保存到文件系统
      const processedImage = await fileSystemService.saveImage(file, cardId, folderId)

      // 创建图片记录
      const dbImage: DbImage = {
        id: crypto.randomUUID(),
        cardId,
        userId: userId,
        fileName: image.alt || 'migrated-image.jpg',
        filePath: processedImage.filePath,
        metadata: {
          originalName: image.alt || 'migrated-image.jpg',
          size: blob.size,
          width: processedImage.metadata.width,
          height: processedImage.metadata.height,
          format: blob.type.split('/')[1],
          compressed: false
        },
        storageMode: 'filesystem',
        createdAt: new Date(),
        updatedAt: new Date(),
        syncVersion: 1,
        pendingSync: true
      }

      await db.images.add(dbImage)

      return {
        success: true,
        size: blob.size
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 从简化版数据库迁移
   */
  private async migrateFromSimpleDatabase(): Promise<{
    success: boolean
    migratedCards: number
    migratedFolders: number
    migratedTags: number
    dataSize: number
    error?: string
  }> {
    try {
      const oldDb = new (Dexie as any)('CardAllDatabase')
      await oldDb.open()

      let migratedCards = 0
      let migratedFolders = 0
      let migratedTags = 0
      let totalSize = 0

      // 迁移卡片
      const oldCards = await oldDb.cards.toArray()
      const dbCards: DbCard[] = oldCards.map(card => ({
        ...card,
        userId: 'default',
        syncVersion: 1,
        pendingSync: true,
        updatedAt: new Date(card.updatedAt)
      }))

      await db.cards.bulkAdd(dbCards)
      migratedCards = dbCards.length
      totalSize += JSON.stringify(dbCards).length

      // 迁移文件夹
      const oldFolders = await oldDb.folders.toArray()
      const dbFolders: DbFolder[] = oldFolders.map(folder => ({
        ...folder,
        userId: 'default',
        syncVersion: 1,
        pendingSync: true,
        updatedAt: new Date(folder.updatedAt)
      }))

      await db.folders.bulkAdd(dbFolders)
      migratedFolders = dbFolders.length
      totalSize += JSON.stringify(dbFolders).length

      // 迁移标签
      const oldTags = await oldDb.tags.toArray()
      const dbTags: DbTag[] = oldTags.map(tag => ({
        ...tag,
        userId: 'default',
        syncVersion: 1,
        pendingSync: true,
        updatedAt: new Date(tag.createdAt)
      }))

      await db.tags.bulkAdd(dbTags)
      migratedTags = dbTags.length
      totalSize += JSON.stringify(dbTags).length

      await oldDb.close()

      console.log(`Migrated from simple database: ${migratedCards} cards, ${migratedFolders} folders, ${migratedTags} tags`)

      return {
        success: true,
        migratedCards,
        migratedFolders,
        migratedTags,
        dataSize: totalSize
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 升级数据库架构
   */
  private async upgradeDatabaseSchema(): Promise<{
    success: boolean
    warnings?: string[]
    error?: string
  }> {
    try {
      // 数据库架构升级已经在 database-unified.ts 的 upgradeDatabase 方法中处理
      console.log('Database schema upgrade completed')
      return { success: true }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 转换和优化数据
   */
  private async transformData(): Promise<{
    success: boolean
    warnings?: string[]
    error?: string
  }> {
    try {
      const warnings: string[] = []

      // 重建搜索索引
      const cards = await db.cards.toArray()
      for (const card of cards) {
        if (!card.searchVector) {
          await db.cards.update(card.id!, {
            searchVector: this.generateSearchVector(card)
          })
        }
      }

      // 更新文件夹路径和深度
      const folders = await db.folders.toArray()
      for (const folder of folders) {
        if (!folder.fullPath || folder.depth === undefined) {
          await db.folders.update(folder.id!, {
            fullPath: this.generateFullPath(folder),
            depth: this.calculateDepth(folder)
          })
        }
      }

      console.log('Data transformation completed')

      return {
        success: true,
        warnings: warnings.length > 0 ? warnings : undefined
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 验证迁移步骤
   */
  private async validateMigrationStep(plan: MigrationPlan): Promise<{
    success: boolean
    warnings?: string[]
    error?: string
  }> {
    const validation = await this.validateMigration(plan)
    return {
      success: validation.success,
      warnings: validation.issues.length > 0 ? validation.issues : undefined,
      error: validation.success ? undefined : 'Migration validation failed'
    }
  }

  /**
   * 清理源数据
   */
  private async cleanupSource(source: MigrationSource): Promise<{
    success: boolean
    warnings?: string[]
    error?: string
  }> {
    try {
      const warnings: string[] = []

      switch (source.type) {
        case 'localStorage':
          // 清理localStorage数据
          localStorage.removeItem('cardall-cards')
          localStorage.removeItem('cardall-folders')
          localStorage.removeItem('cardall-tags')
          localStorage.removeItem('cardall-hidden-tags')
          console.log('LocalStorage data cleaned up')
          break

        case 'database-simple':
          // 清理旧数据库
          try {
            const oldDb = new (Dexie as any)('CardAllDatabase')
            await oldDb.delete()
            console.log('Legacy database cleaned up')
          } catch (error) {
          console.warn("操作失败:", error)
        }`)
          }
          break
      }

      return {
        success: true,
        warnings: warnings.length > 0 ? warnings : undefined
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 验证迁移结果
   */
  private async validateMigration(plan: MigrationPlan): Promise<{
    success: boolean
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    try {
      // 数据完整性验证
      const stats = await db.getStats()

      if (stats.cards === 0 && stats.folders === 0 && stats.tags === 0) {
        issues.push('No data was migrated')
      }

      // 数据一致性验证
      const cards = await db.cards.toArray()
      for (const card of cards) {
        if (!card.frontContent?.title) {
          issues.push(`Card ${card.id} is missing front title`)
        }
        if (!card.backContent?.title) {
          issues.push(`Card ${card.id} is missing back title`)
        }
      }

      const folders = await db.folders.toArray()
      for (const folder of folders) {
        if (!folder.name) {
          issues.push(`Folder ${folder.id} is missing name`)
        }
      }

      const tags = await db.tags.toArray()
      for (const tag of tags) {
        if (!tag.name) {
          issues.push(`Tag ${tag.id} is missing name`)
        }
      }

      // 数据库健康检查
      const health = await db.healthCheck()
      if (!health.isHealthy) {
        issues.push(...health.issues)
      }

      // 性能评估
      if (stats.totalSize > 100 * 1024 * 1024) { // 100MB
        recommendations.push('Consider optimizing large images for better performance')
      }

      if (stats.pendingSync > 100) {
        recommendations.push('Large number of pending sync operations may impact performance')
      }

      return {
        success: issues.length === 0,
        issues,
        recommendations
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 回滚迁移
   */
  private async rollbackMigration(rollbackPoint: string): Promise<void> {
    try {
      console.log(`Rolling back migration to point: ${rollbackPoint}`)

      // 获取回滚数据
      const rollbackData = await db.settings
        .where('key')
        .equals(`rollback_${rollbackPoint}`)
        .first()

      if (!rollbackData) {
        throw new Error('Rollback point not found')
      }

      const backup = rollbackData.value

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
      if (backup.data.syncQueue) {
        await db.syncQueue.bulkAdd(backup.data.syncQueue)
      }

      console.log('Rollback completed successfully')
    } catch (error) {
          console.warn("操作失败:", error)
        }`)
    }
  }

  /**
   * 计算数据校验和
   */
  private async calculateChecksum(): Promise<string> {
    const data = {
      cards: await db.cards.count(),
      folders: await db.folders.count(),
      tags: await db.tags.count(),
      images: await db.images.count()
    }

    const dataString = JSON.stringify(data)
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(dataString)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * 生成搜索向量
   */
  private generateSearchVector(card: Card): string {
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

  /**
   * 生成完整路径
   */
  private generateFullPath(folder: Folder): string {
    // 简化实现,实际应该根据父文件夹构建完整路径
    return folder.name
  }

  /**
   * 计算文件夹深度
   */
  private calculateDepth(folder: Folder): number {
    // 简化实现,实际应该根据父文件夹计算深度
    return folder.parentId ? 1 : 0
  }

  /**
   * Base64转Blob
   */
  private async base64ToBlob(base64: string): Promise<Blob> {
    const response = await fetch(base64)
    return response.blob()
  }

  /**
   * 延迟执行
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 清理迁移数据
   */
  private async cleanupMigration(planId: string): Promise<void> {
    try {
      // 清理回滚点
      const rollbackKeys = await db.settings
        .where('key')
        .startsWith('rollback_')
        .keys()

      for (const key of rollbackKeys) {
        await db.settings.delete(key)
      }

      console.log(`Migration cleanup completed for plan: ${planId}`)
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 通知进度更新
   */
  private notifyProgress(progress: MigrationProgress): void {
    this.progressCallbacks.forEach(callback => callback(progress))
  }

  // ============================================================================
  // 公共接口方法
  // ============================================================================

  /**
   * 注册进度回调
   */
  onProgress(callback: (progress: MigrationProgress) => void): () => void {
    this.progressCallbacks.add(callback)
    return () => this.progressCallbacks.delete(callback)
  }

  /**
   * 获取迁移进度
   */
  getMigrationProgress(planId: string): MigrationProgress | undefined {
    return this.activeMigrations.get(planId)
  }

  /**
   * 取消迁移
   */
  async cancelMigration(planId: string): Promise<boolean> {
    const progress = this.activeMigrations.get(planId)
    if (!progress || progress.status !== 'running') {
      return false
    }

    progress.status = 'paused'
    this.notifyProgress(progress)

    // 这里可以实现更复杂的取消逻辑
    // 例如设置取消标志,让正在运行的步骤检测并停止

    return true
  }

  /**
   * 获取迁移历史
   */
  async getMigrationHistory(): Promise<MigrationResult[]> {
    try {
      const historyKeys = await db.settings
        .where('key')
        .startsWith('migration_result_')
        .toArray()

      const results: MigrationResult[] = []

      for (const key of historyKeys) {
        try {
          const result = JSON.parse(key.value)
          results.push(result)
        } catch (error) {
          console.warn("操作失败:", error)
        }`, error)
        }
      }

      return results.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 创建验证报告
   */
  async createValidationReport(): Promise<ValidationReport> {
    const startTime = Date.now()

    try {
      const stats = await db.getStats()
      const health = await db.healthCheck()

      // 数据完整性检查
      const cards = await db.cards.toArray()
      const folders = await db.folders.toArray()
      const tags = await db.tags.toArray()
      const images = await db.images.toArray()

      const integrity = {
        cardsValid: cards.filter(card =>
          card.frontContent?.title && card.backContent?.title
        ).length,
        cardsInvalid: cards.filter(card =>
          !card.frontContent?.title || !card.backContent?.title
        ).length,
        foldersValid: folders.filter(folder => folder.name).length,
        foldersInvalid: folders.filter(folder => !folder.name).length,
        tagsValid: tags.filter(tag => tag.name).length,
        tagsInvalid: tags.filter(tag => !tag.name).length,
        imagesValid: images.filter(image =>
          image.cardId && image.filePath && image.metadata
        ).length,
        imagesInvalid: images.filter(image =>
          !image.cardId || !image.filePath || !image.metadata
        ).length
      }

      // 一致性检查
      const cardIds = new Set(cards.map(card => card.id))
      const folderIds = new Set(folders.map(folder => folder.id))

      const orphanedImages = images.filter(image => !cardIds.has(image.cardId))
      const invalidFolders = folders.filter(folder =>
        folder.parentId && !folderIds.has(folder.parentId)
      )

      const consistency = {
        referencesValid: orphanedImages.length === 0 && invalidFolders.length === 0,
        duplicatesFound: 0, // 简化实现
        orphansFound: orphanedImages.length + invalidFolders.length
      }

      // 性能评估
      const duration = Date.now() - startTime
      const dataSize = await this.calculateTotalSize()

      const performance = {
        totalTime: duration,
        dataSize,
        throughput: dataSize / (duration / 1000) / 1024 / 1024 // MB/s
      }

      // 生成问题和建议
      const issues: string[] = []
      const recommendations: string[] = []

      if (!health.isHealthy) {
        issues.push(...health.issues)
      }

      if (integrity.cardsInvalid > 0) {
        issues.push(`${integrity.cardsInvalid} cards have missing required fields`)
      }

      if (consistency.orphansFound > 0) {
        issues.push(`${consistency.orphansFound} orphaned records found`)
      }

      if (performance.throughput < 1) {
        recommendations.push('Database performance may be slow, consider optimizing indexes')
      }

      if (stats.pendingSync > 100) {
        recommendations.push('High number of pending sync operations')
      }

      return {
        success: issues.length === 0,
        integrity,
        consistency,
        performance,
        issues,
        recommendations
      }
    } catch (error) {
          console.warn("操作失败:", error)
        },
        consistency: {
          referencesValid: false,
          duplicatesFound: 0,
          orphansFound: 0
        },
        performance: {
          totalTime: 0,
          dataSize: 0,
          throughput: 0
        },
        issues: [error instanceof Error ? error.message : 'Unknown error'],
        recommendations: []
      }
    }
  }

  /**
   * 计算总数据大小
   */
  private async calculateTotalSize(): Promise<number> {
    const [cards, folders, tags, images] = await Promise.all([
      db.cards.toArray(),
      db.folders.toArray(),
      db.tags.toArray(),
      db.images.toArray()
    ])

    const cardSize = JSON.stringify(cards).length
    const folderSize = JSON.stringify(folders).length
    const tagSize = JSON.stringify(tags).length
    const imageSize = images.reduce((total, image) => total + image.metadata.size, 0)

    return cardSize + folderSize + tagSize + imageSize
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus(): Promise<{
    isMigrating: boolean
    activeMigrations: string[]
    databaseHealthy: boolean
    storageQuota: { used: number; total: number }
    lastMigration?: Date
  }> {
    const health = await db.healthCheck()
    const activeMigrationIds = Array.from(this.activeMigrations.keys())
    const lastMigration = await this.getLastMigrationTime()
    const storageQuota = await this.getStorageQuota()

    return {
      isMigrating: this.isMigrating,
      activeMigrations: activeMigrationIds,
      databaseHealthy: health.isHealthy,
      storageQuota,
      lastMigration
    }
  }

  /**
   * 获取最后迁移时间
   */
  private async getLastMigrationTime(): Promise<Date | undefined> {
    try {
      const history = await this.getMigrationHistory()
      return history.length > 0 ? history[0].executedAt : undefined
    } catch {
      return undefined
    }
  }

  /**
   * 获取存储配额
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
          console.warn("操作失败:", error)
        }

    return { used: 0, total: 0 }
  }

  /**
   * 检查是否需要迁移
   */
  async checkMigrationNeeds(): Promise<{
    needsMigration: boolean
    sources: MigrationSource[]
    recommendations: string[]
  }> {
    const sources: MigrationSource[] = []
    const recommendations: string[] = []

    // 检查localStorage数据
    const hasLocalStorageData = await this.hasLocalStorageData()
    if (hasLocalStorageData) {
      sources.push({
        type: 'localStorage',
        version: '1.0'
      })
      recommendations.push('Migrate localStorage data to IndexedDB for better performance')
    }

    // 检查旧数据库
    const hasOldDatabase = await this.hasOldDatabase()
    if (hasOldDatabase) {
      sources.push({
        type: 'database-simple',
        version: '1.0'
      })
      recommendations.push('Migrate legacy database to unified database structure')
    }

    // 检查数据库版本
    const currentVersion = await db.getSetting('databaseVersion')
    if (currentVersion !== '4.0.0') {
      sources.push({
        type: 'database-full',
        version: currentVersion || 'unknown'
      })
      recommendations.push('Upgrade database to latest version')
    }

    return {
      needsMigration: sources.length > 0,
      sources,
      recommendations
    }
  }

  /**
   * 检查localStorage数据
   */
  private async hasLocalStorageData(): Promise<boolean> {
    const hasCards = !!localStorage.getItem('cardall-cards')
    const hasFolders = !!localStorage.getItem('cardall-folders')
    const hasTags = !!localStorage.getItem('cardall-tags')

    return hasCards || hasFolders || hasTags
  }

  /**
   * 检查旧数据库
   */
  private async hasOldDatabase(): Promise<boolean> {
    try {
      const oldDb = new (Dexie as any)('CardAllDatabase')
      await oldDb.open()
      await oldDb.close()
      return true
    } catch {
      return false
    }
  }

  /**
   * 智能迁移建议
   */
  async getMigrationRecommendations(): Promise<{
    priority: 'high' | 'medium' | 'low'
    source: MigrationSource
    reason: string
    estimatedTime: number
    risk: 'low' | 'medium' | 'high'
  }[]> {
    const needs = await this.checkMigrationNeeds()
    const recommendations: any[] = []

    for (const source of needs.sources) {
      switch (source.type) {
        case 'localStorage':
          recommendations.push({
            priority: 'high' as const,
            source,
            reason: 'LocalStorage data is vulnerable to clearing and has size limitations',
            estimatedTime: 15000,
            risk: 'low' as const
          })
          break

        case 'database-simple':
          recommendations.push({
            priority: 'medium' as const,
            source,
            reason: 'Legacy database lacks advanced features and optimizations',
            estimatedTime: 10000,
            risk: 'low' as const
          })
          break

        case 'database-full':
          recommendations.push({
            priority: 'medium' as const,
            source,
            reason: 'Database version upgrade available with performance improvements',
            estimatedTime: 5000,
            risk: 'low' as const
          })
          break
      }
    }

    return recommendations
  }
}

// 创建数据迁移工具实例
export const dataMigrationTool = new DataMigrationTool()

// 导出便捷函数
export const createMigrationPlan = (source: MigrationSource) =>
  dataMigrationTool.analyzeAndCreatePlan(source)

export const executeMigrationPlan = (plan: MigrationPlan) =>
  dataMigrationTool.executeMigration(plan)

export const checkMigrationNeeds = () =>
  dataMigrationTool.checkMigrationNeeds()

export const getMigrationProgress = (planId: string) =>
  dataMigrationTool.getMigrationProgress(planId)

export const createValidationReport = () =>
  dataMigrationTool.createValidationReport()

export const getSystemStatus = () =>
  dataMigrationTool.getSystemStatus()