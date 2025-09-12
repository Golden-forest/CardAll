import { supabase } from './supabase'
import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from './database'
import { networkMonitorService, type NetworkInfo } from './network-monitor'
import { localOperationService, type LocalSyncOperation } from './local-operation'

// ============================================================================
// 增量同步和冲突检测系统
// ============================================================================

// 冲突类型
export type ConflictType = 
  | 'version-mismatch'        // 版本不匹配
  | 'concurrent-modification' // 并发修改
  | 'data-inconsistency'     // 数据不一致
  | 'network-partition'      // 网络分区
  | 'constraint-violation'   // 约束违反

// 冲突解决策略
export type ResolutionStrategy = 
  | 'local-wins'            // 本地数据获胜
  | 'remote-wins'           // 远程数据获胜
  | 'merge-fields'          // 字段级别合并
  | 'manual-resolution'      // 手动解决
  | 'timestamp-based'       // 基于时间戳
  | 'operation-based'       // 基于操作类型

// 冲突信息
export interface SyncConflict {
  id: string
  type: ConflictType
  entityType: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  userId: string
  
  // 冲突数据
  localData: any
  remoteData: any
  baseData?: any // 基础版本（三路合并）
  
  // 冲突详情
  fieldConflicts: Array<{
    field: string
    localValue: any
    remoteValue: any
    conflictReason: string
  }>
  
  // 元信息
  localVersion: number
  remoteVersion: number
  localTimestamp: Date
  remoteTimestamp: Date
  
  // 解决信息
  resolution?: ResolutionStrategy
  resolvedData?: any
  resolvedAt?: Date
  resolvedBy?: 'system' | 'user'
  
  // 上下文
  context: {
    networkInfo: NetworkInfo
    operationType: string
    retryCount: number
  }
  
  createdAt: Date
}

// 同步策略配置
export interface SyncStrategyConfig {
  // 冲突解决默认策略
  defaultResolution: ResolutionStrategy
  
  // 按实体类型的策略
  entityStrategies: {
    card: ResolutionStrategy
    folder: ResolutionStrategy
    tag: ResolutionStrategy
    image: ResolutionStrategy
  }
  
  // 按冲突类型的策略
  conflictTypeStrategies: Record<ConflictType, ResolutionStrategy>
  
  // 增量同步配置
  incremental: {
    enabled: boolean
    batchSize: number
    maxConcurrentSyncs: number
    versionCheckInterval: number
  }
  
  // 冲突检测配置
  conflictDetection: {
    enabled: boolean
    fieldGranularity: boolean
    threeWayMerge: boolean
    autoResolveThreshold: number // 自动解决的置信度阈值
  }
  
  // 性能优化
  performance: {
    useCompression: boolean
    useBatching: boolean
    adaptiveBatchSize: boolean
    networkAware: boolean
  }
}

// 默认同步策略配置
export const DEFAULT_SYNC_STRATEGY: SyncStrategyConfig = {
  defaultResolution: 'timestamp-based',
  
  entityStrategies: {
    card: 'merge-fields',
    folder: 'remote-wins',
    tag: 'merge-fields',
    image: 'remote-wins'
  },
  
  conflictTypeStrategies: {
    'version-mismatch': 'timestamp-based',
    'concurrent-modification': 'merge-fields',
    'data-inconsistency': 'manual-resolution',
    'network-partition': 'local-wins',
    'constraint-violation': 'remote-wins'
  },
  
  incremental: {
    enabled: true,
    batchSize: 50,
    maxConcurrentSyncs: 3,
    versionCheckInterval: 30000 // 30秒
  },
  
  conflictDetection: {
    enabled: true,
    fieldGranularity: true,
    threeWayMerge: true,
    autoResolveThreshold: 0.8
  },
  
  performance: {
    useCompression: true,
    useBatching: true,
    adaptiveBatchSize: true,
    networkAware: true
  }
}

// 同步进度和统计
export interface SyncProgress {
  totalItems: number
  processedItems: number
  successfulItems: number
  failedItems: number
  conflictedItems: number
  
  currentBatch?: {
    startIndex: number
    endIndex: number
    items: number
  }
  
  performance: {
    startTime: Date
    estimatedTimeRemaining?: number
    bytesTransferred: number
    networkLatency: number
  }
  
  conflicts: SyncConflict[]
}

// ============================================================================
// 同步策略服务
// ============================================================================

export class SyncStrategyService {
  private config: SyncStrategyConfig
  private isSyncing = false
  private activeSyncs: Map<string, Promise<void>> = new Map()
  
  // 冲突解决器
  private conflictResolvers: Map<ResolutionStrategy, (conflict: SyncConflict) => Promise<any>> = new Map()
  
  // 事件监听器
  private listeners: {
    conflictDetected?: (conflict: SyncConflict) => void
    conflictResolved?: (conflict: SyncConflict) => void
    syncProgress?: (progress: SyncProgress) => void
    syncCompleted?: (stats: SyncProgress) => void
    syncError?: (error: Error) => void
  } = {}

  constructor(config: Partial<SyncStrategyConfig> = {}) {
    this.config = { ...DEFAULT_SYNC_STRATEGY, ...config }
    this.initializeConflictResolvers()
  }

  // 初始化冲突解决器
  private initializeConflictResolvers(): void {
    this.conflictResolvers.set('local-wins', this.resolveLocalWins.bind(this))
    this.conflictResolvers.set('remote-wins', this.resolveRemoteWins.bind(this))
    this.conflictResolvers.set('merge-fields', this.resolveMergeFields.bind(this))
    this.conflictResolvers.set('timestamp-based', this.resolveTimestampBased.bind(this))
    this.conflictResolvers.set('operation-based', this.resolveOperationBased.bind(this))
  }

  // ============================================================================
  // 主要同步方法
  // ============================================================================

  // 检测冲突
  async detectConflicts(
    localData: any[],
    remoteData: any[],
    lastSyncTime: Date
  ): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = []
    
    // 创建快速查找映射
    const localMap = new Map(localData.map(item => [item.id, item]))
    const remoteMap = new Map(remoteData.map(item => [item.id, item]))
    
    // 检查修改冲突
    for (const [id, localItem] of localMap) {
      const remoteItem = remoteMap.get(id)
      
      if (remoteItem) {
        // 两个数据源都修改了同一个项目
        const localUpdated = new Date(localItem.updatedAt || localItem.updated_at || 0)
        const remoteUpdated = new Date(remoteItem.updatedAt || remoteItem.updated_at || 0)
        const syncTime = new Date(lastSyncTime)
        
        if (localUpdated > syncTime && remoteUpdated > syncTime) {
          conflicts.push({
            id: `conflict-${id}`,
            entityType: this.inferEntityType(localItem),
            entityId: id,
            localVersion: localItem,
            remoteVersion: remoteItem,
            conflictType: 'modification',
            detectedAt: new Date(),
            resolutionStrategy: this.config.defaultResolutionStrategy
          })
        }
      }
    }
    
    console.log(`Detected ${conflicts.length} conflicts during sync`)
    return conflicts
  }

  // 推断实体类型
  private inferEntityType(item: any): string {
    if (item.frontContent && item.backContent) return 'card'
    if (item.name && item.parentId !== undefined) return 'folder'
    if (item.name && !item.parentId) return 'tag'
    if (item.url && item.cardId) return 'image'
    return 'unknown'
  }

  // 执行增量同步
  async performIncrementalSync(
    userId: string,
    lastSyncTime: Date,
    options?: {
      forceFullSync?: boolean
      entityTypes?: ('card' | 'folder' | 'tag' | 'image')[]
      limit?: number
    }
  ): Promise<SyncProgress> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress')
    }

    this.isSyncing = true
    const syncId = crypto.randomUUID()
    const startTime = new Date()
    
    try {
      const progress: SyncProgress = {
        totalItems: 0,
        processedItems: 0,
        successfulItems: 0,
        failedItems: 0,
        conflictedItems: 0,
        performance: {
          startTime,
          bytesTransferred: 0,
          networkLatency: 0
        },
        conflicts: []
      }

      // 如果强制全量同步或没有上次同步时间
      if (options?.forceFullSync || !lastSyncTime) {
        await this.performFullSync(userId, progress)
      } else {
        await this.performDeltaSync(userId, lastSyncTime, progress, options)
      }

      this.notifyListeners('syncCompleted', progress)
      return progress
    } catch (error) {
      this.notifyListeners('syncError', error as Error)
      throw error
    } finally {
      this.isSyncing = false
      this.activeSyncs.delete(syncId)
    }
  }

  // 执行全量同步
  private async performFullSync(userId: string, progress: SyncProgress): Promise<void> {
    console.log('Starting full sync for user:', userId)
    
    // 获取所有本地数据
    const [localCards, localFolders, localTags, localImages] = await Promise.all([
      db.cards.where('userId').equals(userId).toArray(),
      db.folders.where('userId').equals(userId).toArray(),
      db.tags.where('userId').equals(userId).toArray(),
      db.images.where('userId').equals(userId).toArray()
    ])

    progress.totalItems = localCards.length + localFolders.length + localTags.length + localImages.length

    // 同步每种实体类型
    await Promise.all([
      this.syncEntities(userId, 'card', localCards, progress),
      this.syncEntities(userId, 'folder', localFolders, progress),
      this.syncEntities(userId, 'tag', localTags, progress),
      this.syncEntities(userId, 'image', localImages, progress)
    ])
  }

  // 执行增量同步
  private async performDeltaSync(
    userId: string,
    lastSyncTime: Date,
    progress: SyncProgress,
    options?: { entityTypes?: ('card' | 'folder' | 'tag' | 'image')[]; limit?: number }
  ): Promise<void> {
    console.log('Starting delta sync from:', lastSyncTime)
    
    const entityTypes = options?.entityTypes || ['card', 'folder', 'tag', 'image']
    
    // 获取云端增量数据
    const remoteData = await this.fetchRemoteDelta(userId, lastSyncTime, entityTypes)
    
    progress.totalItems = remoteData.cards.length + remoteData.folders.length + 
                          remoteData.tags.length + remoteData.images.length

    // 处理云端增量数据
    await Promise.all([
      this.processRemoteDelta(userId, 'card', remoteData.cards, progress),
      this.processRemoteDelta(userId, 'folder', remoteData.folders, progress),
      this.processRemoteDelta(userId, 'tag', remoteData.tags, progress),
      this.processRemoteDelta(userId, 'image', remoteData.images, progress)
    ])

    // 同步本地待处理操作
    await this.syncPendingOperations(userId, progress)
  }

  // ============================================================================
  // 实体同步方法
  // ============================================================================

  // 同步实体
  private async syncEntities<T extends DbCard | DbFolder | DbTag | DbImage>(
    userId: string,
    entityType: 'card' | 'folder' | 'tag' | 'image',
    localEntities: T[],
    progress: SyncProgress
  ): Promise<void> {
    const batchSize = this.getAdaptiveBatchSize()
    
    for (let i = 0; i < localEntities.length; i += batchSize) {
      const batch = localEntities.slice(i, i + batchSize)
      
      try {
        await this.syncEntityBatch(userId, entityType, batch, progress)
      } catch (error) {
        console.error(`Failed to sync ${entityType} batch:`, error)
        progress.failedItems += batch.length
      }
      
      // 更新进度
      this.updateProgress(progress, batch.length)
    }
  }

  // 同步实体批次
  private async syncEntityBatch<T extends DbCard | DbFolder | DbTag | DbImage>(
    userId: string,
    entityType: 'card' | 'folder' | 'tag' | 'image',
    entities: T[],
    progress: SyncProgress
  ): Promise<void> {
    switch (entityType) {
      case 'card':
        await this.syncCardBatch(userId, entities as DbCard[], progress)
        break
      case 'folder':
        await this.syncFolderBatch(userId, entities as DbFolder[], progress)
        break
      case 'tag':
        await this.syncTagBatch(userId, entities as DbTag[], progress)
        break
      case 'image':
        await this.syncImageBatch(userId, entities as DbImage[], progress)
        break
    }
  }

  // 同步卡片批次
  private async syncCardBatch(userId: string, cards: DbCard[], progress: SyncProgress): Promise<void> {
    const remoteCards = await this.fetchRemoteCards(userId, cards.map(c => c.id!))
    
    for (const localCard of cards) {
      try {
        const remoteCard = remoteCards.find(r => r.id === localCard.id)
        
        if (!remoteCard) {
          // 本地存在，云端不存在 - 上传
          await this.uploadCard(userId, localCard)
          progress.successfulItems++
        } else {
          // 云端也存在 - 检查冲突
          const conflict = await this.detectCardConflict(userId, localCard, remoteCard)
          
          if (conflict) {
            progress.conflicts.push(conflict)
            progress.conflictedItems++
            await this.resolveConflict(conflict)
          } else {
            // 无冲突，更新本地版本
            await this.updateCardVersion(localCard.id!, remoteCard.sync_version)
            progress.successfulItems++
          }
        }
      } catch (error) {
        console.error('Failed to sync card:', localCard.id, error)
        progress.failedItems++
      }
    }
  }

  // 同步文件夹批次
  private async syncFolderBatch(userId: string, folders: DbFolder[], progress: SyncProgress): Promise<void> {
    const remoteFolders = await this.fetchRemoteFolders(userId, folders.map(f => f.id!))
    
    for (const localFolder of folders) {
      try {
        const remoteFolder = remoteFolders.find(r => r.id === localFolder.id)
        
        if (!remoteFolder) {
          await this.uploadFolder(userId, localFolder)
          progress.successfulItems++
        } else {
          const conflict = await this.detectFolderConflict(userId, localFolder, remoteFolder)
          
          if (conflict) {
            progress.conflicts.push(conflict)
            progress.conflictedItems++
            await this.resolveConflict(conflict)
          } else {
            await this.updateFolderVersion(localFolder.id!, remoteFolder.sync_version)
            progress.successfulItems++
          }
        }
      } catch (error) {
        console.error('Failed to sync folder:', localFolder.id, error)
        progress.failedItems++
      }
    }
  }

  // 同步标签批次
  private async syncTagBatch(userId: string, tags: DbTag[], progress: SyncProgress): Promise<void> {
    const remoteTags = await this.fetchRemoteTags(userId, tags.map(t => t.id!))
    
    for (const localTag of tags) {
      try {
        const remoteTag = remoteTags.find(r => r.id === localTag.id)
        
        if (!remoteTag) {
          await this.uploadTag(userId, localTag)
          progress.successfulItems++
        } else {
          const conflict = await this.detectTagConflict(userId, localTag, remoteTag)
          
          if (conflict) {
            progress.conflicts.push(conflict)
            progress.conflictedItems++
            await this.resolveConflict(conflict)
          } else {
            await this.updateTagVersion(localTag.id!, remoteTag.sync_version)
            progress.successfulItems++
          }
        }
      } catch (error) {
        console.error('Failed to sync tag:', localTag.id, error)
        progress.failedItems++
      }
    }
  }

  // 同步图片批次
  private async syncImageBatch(userId: string, images: DbImage[], progress: SyncProgress): Promise<void> {
    const remoteImages = await this.fetchRemoteImages(userId, images.map(i => i.id!))
    
    for (const localImage of images) {
      try {
        const remoteImage = remoteImages.find(r => r.id === localImage.id)
        
        if (!remoteImage) {
          await this.uploadImage(userId, localImage)
          progress.successfulItems++
        } else {
          const conflict = await this.detectImageConflict(userId, localImage, remoteImage)
          
          if (conflict) {
            progress.conflicts.push(conflict)
            progress.conflictedItems++
            await this.resolveConflict(conflict)
          } else {
            await this.updateImageVersion(localImage.id!, remoteImage.sync_version)
            progress.successfulItems++
          }
        }
      } catch (error) {
        console.error('Failed to sync image:', localImage.id, error)
        progress.failedItems++
      }
    }
  }

  // ============================================================================
  // 冲突检测
  // ============================================================================

  // 检测卡片冲突
  private async detectCardConflict(
    userId: string,
    localCard: DbCard,
    remoteCard: any
  ): Promise<SyncConflict | null> {
    if (!this.config.conflictDetection.enabled) {
      return null
    }

    const conflicts: SyncConflict['fieldConflicts'] = []
    let hasConflict = false

    // 检查版本
    if (localCard.syncVersion >= remoteCard.sync_version) {
      return null
    }

    // 检查字段级别的冲突
    if (this.config.conflictDetection.fieldGranularity) {
      // 检查正面内容
      const localFront = JSON.stringify(localCard.frontContent)
      const remoteFront = JSON.stringify(remoteCard.front_content)
      if (localFront !== remoteFront) {
        conflicts.push({
          field: 'frontContent',
          localValue: localCard.frontContent,
          remoteValue: remoteCard.front_content,
          conflictReason: 'Content mismatch'
        })
        hasConflict = true
      }

      // 检查背面内容
      const localBack = JSON.stringify(localCard.backContent)
      const remoteBack = JSON.stringify(remoteCard.back_content)
      if (localBack !== remoteBack) {
        conflicts.push({
          field: 'backContent',
          localValue: localCard.backContent,
          remoteValue: remoteCard.back_content,
          conflictReason: 'Content mismatch'
        })
        hasConflict = true
      }

      // 检查样式
      const localStyle = JSON.stringify(localCard.style)
      const remoteStyle = JSON.stringify(remoteCard.style)
      if (localStyle !== remoteStyle) {
        conflicts.push({
          field: 'style',
          localValue: localCard.style,
          remoteValue: remoteCard.style,
          conflictReason: 'Style mismatch'
        })
        hasConflict = true
      }

      // 检查文件夹
      if (localCard.folderId !== remoteCard.folder_id) {
        conflicts.push({
          field: 'folderId',
          localValue: localCard.folderId,
          remoteValue: remoteCard.folder_id,
          conflictReason: 'Folder assignment mismatch'
        })
        hasConflict = true
      }
    }

    if (!hasConflict) {
      return null
    }

    return {
      id: crypto.randomUUID(),
      type: 'concurrent-modification',
      entityType: 'card',
      entityId: localCard.id!,
      userId,
      localData: localCard,
      remoteData: remoteCard,
      fieldConflicts: conflicts,
      localVersion: localCard.syncVersion,
      remoteVersion: remoteCard.sync_version,
      localTimestamp: new Date(localCard.updatedAt),
      remoteTimestamp: new Date(remoteCard.updated_at),
      context: {
        networkInfo: networkMonitorService.getCurrentState(),
        operationType: 'sync',
        retryCount: 0
      },
      createdAt: new Date()
    }
  }

  // 检测文件夹冲突
  private async detectFolderConflict(
    userId: string,
    localFolder: DbFolder,
    remoteFolder: any
  ): Promise<SyncConflict | null> {
    if (!this.config.conflictDetection.enabled) {
      return null
    }

    if (localFolder.syncVersion >= remoteFolder.sync_version) {
      return null
    }

    const conflicts: SyncConflict['fieldConflicts'] = []

    // 检查名称
    if (localFolder.name !== remoteFolder.name) {
      conflicts.push({
        field: 'name',
        localValue: localFolder.name,
        remoteValue: remoteFolder.name,
        conflictReason: 'Name mismatch'
      })
    }

    // 检查父文件夹
    if (localFolder.parentId !== remoteFolder.parent_id) {
      conflicts.push({
        field: 'parentId',
        localValue: localFolder.parentId,
        remoteValue: remoteFolder.parent_id,
        conflictReason: 'Parent folder mismatch'
      })
    }

    if (conflicts.length === 0) {
      return null
    }

    return {
      id: crypto.randomUUID(),
      type: 'concurrent-modification',
      entityType: 'folder',
      entityId: localFolder.id!,
      userId,
      localData: localFolder,
      remoteData: remoteFolder,
      fieldConflicts: conflicts,
      localVersion: localFolder.syncVersion,
      remoteVersion: remoteFolder.sync_version,
      localTimestamp: new Date(localFolder.updatedAt),
      remoteTimestamp: new Date(remoteFolder.updated_at),
      context: {
        networkInfo: networkMonitorService.getCurrentState(),
        operationType: 'sync',
        retryCount: 0
      },
      createdAt: new Date()
    }
  }

  // 检测标签冲突
  private async detectTagConflict(
    userId: string,
    localTag: DbTag,
    remoteTag: any
  ): Promise<SyncConflict | null> {
    if (!this.config.conflictDetection.enabled) {
      return null
    }

    if (localTag.syncVersion >= remoteTag.sync_version) {
      return null
    }

    const conflicts: SyncConflict['fieldConflicts'] = []

    // 检查名称
    if (localTag.name !== remoteTag.name) {
      conflicts.push({
        field: 'name',
        localValue: localTag.name,
        remoteValue: remoteTag.name,
        conflictReason: 'Name mismatch'
      })
    }

    // 检查颜色
    if (localTag.color !== remoteTag.color) {
      conflicts.push({
        field: 'color',
        localValue: localTag.color,
        remoteValue: remoteTag.color,
        conflictReason: 'Color mismatch'
      })
    }

    if (conflicts.length === 0) {
      return null
    }

    return {
      id: crypto.randomUUID(),
      type: 'concurrent-modification',
      entityType: 'tag',
      entityId: localTag.id!,
      userId,
      localData: localTag,
      remoteData: remoteTag,
      fieldConflicts: conflicts,
      localVersion: localTag.syncVersion,
      remoteVersion: remoteTag.sync_version,
      localTimestamp: new Date(localTag.updatedAt),
      remoteTimestamp: new Date(remoteTag.updated_at),
      context: {
        networkInfo: networkMonitorService.getCurrentState(),
        operationType: 'sync',
        retryCount: 0
      },
      createdAt: new Date()
    }
  }

  // 检测图片冲突
  private async detectImageConflict(
    userId: string,
    localImage: DbImage,
    remoteImage: any
  ): Promise<SyncConflict | null> {
    if (!this.config.conflictDetection.enabled) {
      return null
    }

    if (localImage.syncVersion >= remoteImage.sync_version) {
      return null
    }

    const conflicts: SyncConflict['fieldConflicts'] = []

    // 检查文件路径
    if (localImage.filePath !== remoteImage.file_path) {
      conflicts.push({
        field: 'filePath',
        localValue: localImage.filePath,
        remoteValue: remoteImage.file_path,
        conflictReason: 'File path mismatch'
      })
    }

    // 检查云URL
    if (localImage.cloudUrl !== remoteImage.cloud_url) {
      conflicts.push({
        field: 'cloudUrl',
        localValue: localImage.cloudUrl,
        remoteValue: remoteImage.cloud_url,
        conflictReason: 'Cloud URL mismatch'
      })
    }

    if (conflicts.length === 0) {
      return null
    }

    return {
      id: crypto.randomUUID(),
      type: 'concurrent-modification',
      entityType: 'image',
      entityId: localImage.id!,
      userId,
      localData: localImage,
      remoteData: remoteImage,
      fieldConflicts: conflicts,
      localVersion: localImage.syncVersion,
      remoteVersion: remoteImage.sync_version,
      localTimestamp: new Date(localImage.updatedAt),
      remoteTimestamp: new Date(remoteImage.updated_at),
      context: {
        networkInfo: networkMonitorService.getCurrentState(),
        operationType: 'sync',
        retryCount: 0
      },
      createdAt: new Date()
    }
  }

  // ============================================================================
  // 冲突解决
  // ============================================================================

  // 解决冲突
  private async resolveConflict(conflict: SyncConflict): Promise<void> {
    try {
      // 获取解决策略
      const strategy = this.getResolutionStrategy(conflict)
      
      // 获取解决器
      const resolver = this.conflictResolvers.get(strategy)
      if (!resolver) {
        throw new Error(`No resolver found for strategy: ${strategy}`)
      }

      // 解决冲突
      const resolvedData = await resolver(conflict)
      
      // 更新冲突记录
      conflict.resolution = strategy
      conflict.resolvedData = resolvedData
      conflict.resolvedAt = new Date()
      conflict.resolvedBy = 'system'

      // 应用解决结果
      await this.applyConflictResolution(conflict)

      // 通知监听器
      this.notifyListeners('conflictResolved', conflict)
    } catch (error) {
      console.error('Failed to resolve conflict:', conflict.id, error)
      
      // 如果自动解决失败，标记为需要手动解决
      conflict.resolution = 'manual-resolution'
      conflict.resolvedBy = 'system'
      conflict.resolvedAt = new Date()
    }
  }

  // 获取解决策略
  private getResolutionStrategy(conflict: SyncConflict): ResolutionStrategy {
    // 首先按实体类型
    const entityStrategy = this.config.entityStrategies[conflict.entityType]
    if (entityStrategy !== this.config.defaultResolution) {
      return entityStrategy
    }

    // 然后按冲突类型
    const typeStrategy = this.config.conflictTypeStrategies[conflict.type]
    if (typeStrategy !== this.config.defaultResolution) {
      return typeStrategy
    }

    // 最后使用默认策略
    return this.config.defaultResolution
  }

  // 应用冲突解决结果
  private async applyConflictResolution(conflict: SyncConflict): Promise<void> {
    if (!conflict.resolvedData) {
      return
    }

    switch (conflict.entityType) {
      case 'card':
        await db.cards.update(conflict.entityId, {
          ...conflict.resolvedData,
          syncVersion: Math.max(conflict.localVersion, conflict.remoteVersion) + 1,
          pendingSync: false
        })
        break
        
      case 'folder':
        await db.folders.update(conflict.entityId, {
          ...conflict.resolvedData,
          syncVersion: Math.max(conflict.localVersion, conflict.remoteVersion) + 1,
          pendingSync: false
        })
        break
        
      case 'tag':
        await db.tags.update(conflict.entityId, {
          ...conflict.resolvedData,
          syncVersion: Math.max(conflict.localVersion, conflict.remoteVersion) + 1,
          pendingSync: false
        })
        break
        
      case 'image':
        await db.images.update(conflict.entityId, {
          ...conflict.resolvedData,
          syncVersion: Math.max(conflict.localVersion, conflict.remoteVersion) + 1,
          pendingSync: false
        })
        break
    }
  }

  // ============================================================================
  // 冲突解决器实现
  // ============================================================================

  // 本地数据获胜
  private async resolveLocalWins(conflict: SyncConflict): Promise<any> {
    return conflict.localData
  }

  // 远程数据获胜
  private async resolveRemoteWins(conflict: SyncConflict): Promise<any> {
    return conflict.remoteData
  }

  // 字段级别合并
  private async resolveMergeFields(conflict: SyncConflict): Promise<any> {
    const merged = { ...conflict.remoteData }

    // 对于每个冲突字段，智能选择保留哪个值
    for (const fieldConflict of conflict.fieldConflicts) {
      const field = fieldConflict.field
      
      // 基于时间戳的简单合并策略
      const localTime = new Date(conflict.localTimestamp).getTime()
      const remoteTime = new Date(conflict.remoteTimestamp).getTime()
      
      if (localTime > remoteTime) {
        merged[field] = fieldConflict.localValue
      } else {
        merged[field] = fieldConflict.remoteValue
      }
    }

    return merged
  }

  // 基于时间戳
  private async resolveTimestampBased(conflict: SyncConflict): Promise<any> {
    const localTime = new Date(conflict.localTimestamp).getTime()
    const remoteTime = new Date(conflict.remoteTimestamp).getTime()
    
    return localTime > remoteTime ? conflict.localData : conflict.remoteData
  }

  // 基于操作类型
  private async resolveOperationBased(conflict: SyncConflict): Promise<any> {
    // 根据操作类型选择解决策略
    const operationType = conflict.context.operationType
    
    switch (operationType) {
      case 'delete':
        // 删除操作通常优先
        return conflict.localData
      case 'create':
        // 创建操作保留创建的数据
        return conflict.localData
      default:
        // 其他操作使用时间戳
        return this.resolveTimestampBased(conflict)
    }
  }

  // ============================================================================
  // 远程数据获取
  // ============================================================================

  // 获取远程增量数据
  private async fetchRemoteDelta(
    userId: string,
    lastSyncTime: Date,
    entityTypes: ('card' | 'folder' | 'tag' | 'image')[]
  ): Promise<{
    cards: any[]
    folders: any[]
    tags: any[]
    images: any[]
  }> {
    const results = await Promise.allSettled([
      entityTypes.includes('card') ? this.fetchRemoteCardsDelta(userId, lastSyncTime) : Promise.resolve([]),
      entityTypes.includes('folder') ? this.fetchRemoteFoldersDelta(userId, lastSyncTime) : Promise.resolve([]),
      entityTypes.includes('tag') ? this.fetchRemoteTagsDelta(userId, lastSyncTime) : Promise.resolve([]),
      entityTypes.includes('image') ? this.fetchRemoteImagesDelta(userId, lastSyncTime) : Promise.resolve([])
    ])

    return {
      cards: results[0].status === 'fulfilled' ? results[0].value : [],
      folders: results[1].status === 'fulfilled' ? results[1].value : [],
      tags: results[2].status === 'fulfilled' ? results[2].value : [],
      images: results[3].status === 'fulfilled' ? results[3].value : []
    }
  }

  // 获取远程卡片增量
  private async fetchRemoteCardsDelta(userId: string, lastSyncTime: Date): Promise<any[]> {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', userId)
      .gte('updated_at', lastSyncTime.toISOString())

    if (error) throw error
    return data || []
  }

  // 获取远程文件夹增量
  private async fetchRemoteFoldersDelta(userId: string, lastSyncTime: Date): Promise<any[]> {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .gte('updated_at', lastSyncTime.toISOString())

    if (error) throw error
    return data || []
  }

  // 获取远程标签增量
  private async fetchRemoteTagsDelta(userId: string, lastSyncTime: Date): Promise<any[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', userId)
      .gte('updated_at', lastSyncTime.toISOString())

    if (error) throw error
    return data || []
  }

  // 获取远程图片增量
  private async fetchRemoteImagesDelta(userId: string, lastSyncTime: Date): Promise<any[]> {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .eq('user_id', userId)
      .gte('updated_at', lastSyncTime.toISOString())

    if (error) throw error
    return data || []
  }

  // 获取远程卡片
  private async fetchRemoteCards(userId: string, cardIds: string[]): Promise<any[]> {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', userId)
      .in('id', cardIds)

    if (error) throw error
    return data || []
  }

  // 获取远程文件夹
  private async fetchRemoteFolders(userId: string, folderIds: string[]): Promise<any[]> {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .in('id', folderIds)

    if (error) throw error
    return data || []
  }

  // 获取远程标签
  private async fetchRemoteTags(userId: string, tagIds: string[]): Promise<any[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', userId)
      .in('id', tagIds)

    if (error) throw error
    return data || []
  }

  // 获取远程图片
  private async fetchRemoteImages(userId: string, imageIds: string[]): Promise<any[]> {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .eq('user_id', userId)
      .in('id', imageIds)

    if (error) throw error
    return data || []
  }

  // ============================================================================
  // 数据上传方法
  // ============================================================================

  // 上传卡片
  private async uploadCard(userId: string, card: DbCard): Promise<void> {
    const { error } = await supabase
      .from('cards')
      .upsert({
        id: card.id,
        user_id: userId,
        front_content: card.frontContent,
        back_content: card.backContent,
        style: card.style,
        folder_id: card.folderId,
        updated_at: new Date().toISOString(),
        sync_version: card.syncVersion + 1
      })

    if (error) throw error
  }

  // 上传文件夹
  private async uploadFolder(userId: string, folder: DbFolder): Promise<void> {
    const { error } = await supabase
      .from('folders')
      .upsert({
        id: folder.id,
        user_id: userId,
        name: folder.name,
        parent_id: folder.parentId,
        updated_at: new Date().toISOString(),
        sync_version: folder.syncVersion + 1
      })

    if (error) throw error
  }

  // 上传标签
  private async uploadTag(userId: string, tag: DbTag): Promise<void> {
    const { error } = await supabase
      .from('tags')
      .upsert({
        id: tag.id,
        user_id: userId,
        name: tag.name,
        color: tag.color,
        updated_at: new Date().toISOString(),
        sync_version: tag.syncVersion + 1
      })

    if (error) throw error
  }

  // 上传图片
  private async uploadImage(userId: string, image: DbImage): Promise<void> {
    const { error } = await supabase
      .from('images')
      .upsert({
        id: image.id,
        user_id: userId,
        card_id: image.cardId,
        file_name: image.fileName,
        file_path: image.filePath,
        cloud_url: image.cloudUrl,
        metadata: image.metadata,
        updated_at: new Date().toISOString(),
        sync_version: image.syncVersion + 1
      })

    if (error) throw error
  }

  // ============================================================================
  // 版本更新方法
  // ============================================================================

  // 更新卡片版本
  private async updateCardVersion(cardId: string, version: number): Promise<void> {
    await db.cards.update(cardId, {
      syncVersion: version,
      pendingSync: false
    })
  }

  // 更新文件夹版本
  private async updateFolderVersion(folderId: string, version: number): Promise<void> {
    await db.folders.update(folderId, {
      syncVersion: version,
      pendingSync: false
    })
  }

  // 更新标签版本
  private async updateTagVersion(tagId: string, version: number): Promise<void> {
    await db.tags.update(tagId, {
      syncVersion: version,
      pendingSync: false
    })
  }

  // 更新图片版本
  private async updateImageVersion(imageId: string, version: number): Promise<void> {
    await db.images.update(imageId, {
      syncVersion: version,
      pendingSync: false
    })
  }

  // ============================================================================
  // 待处理操作同步
  // ============================================================================

  // 同步待处理操作
  private async syncPendingOperations(userId: string, progress: SyncProgress): Promise<void> {
    const pendingOperations = await localOperationService.getPendingOperations(100)
    
    for (const operation of pendingOperations) {
      if (operation.userId !== userId) continue
      
      try {
        await this.processPendingOperation(operation)
        progress.successfulItems++
      } catch (error) {
        console.error('Failed to process pending operation:', operation.id, error)
        progress.failedItems++
      }
      
      this.updateProgress(progress, 1)
    }
  }

  // 处理待处理操作
  private async processPendingOperation(operation: LocalSyncOperation): Promise<void> {
    switch (operation.entityType) {
      case 'card':
        await this.processCardOperation(operation)
        break
      case 'folder':
        await this.processFolderOperation(operation)
        break
      case 'tag':
        await this.processTagOperation(operation)
        break
      case 'image':
        await this.processImageOperation(operation)
        break
    }
    
    // 标记操作为完成
    await localOperationService.markOperationCompleted(operation.id)
  }

  // 处理卡片操作
  private async processCardOperation(operation: LocalSyncOperation): Promise<void> {
    const card = operation.data as DbCard
    
    switch (operation.operationType) {
      case 'create':
      case 'update':
        await this.uploadCard(operation.userId!, card)
        break
      case 'delete':
        await supabase
          .from('cards')
          .update({ is_deleted: true })
          .eq('id', card.id!)
          .eq('user_id', operation.userId!)
        break
    }
  }

  // 处理文件夹操作
  private async processFolderOperation(operation: LocalSyncOperation): Promise<void> {
    const folder = operation.data as DbFolder
    
    switch (operation.operationType) {
      case 'create':
      case 'update':
        await this.uploadFolder(operation.userId!, folder)
        break
      case 'delete':
        await supabase
          .from('folders')
          .update({ is_deleted: true })
          .eq('id', folder.id!)
          .eq('user_id', operation.userId!)
        break
    }
  }

  // 处理标签操作
  private async processTagOperation(operation: LocalSyncOperation): Promise<void> {
    const tag = operation.data as DbTag
    
    switch (operation.operationType) {
      case 'create':
      case 'update':
        await this.uploadTag(operation.userId!, tag)
        break
      case 'delete':
        await supabase
          .from('tags')
          .update({ is_deleted: true })
          .eq('id', tag.id!)
          .eq('user_id', operation.userId!)
        break
    }
  }

  // 处理图片操作
  private async processImageOperation(operation: LocalSyncOperation): Promise<void> {
    const image = operation.data as DbImage
    
    switch (operation.operationType) {
      case 'create':
      case 'update':
        await this.uploadImage(operation.userId!, image)
        break
      case 'delete':
        await supabase
          .from('images')
          .update({ is_deleted: true })
          .eq('id', image.id!)
          .eq('user_id', operation.userId!)
        break
    }
  }

  // ============================================================================
  // 处理远程增量数据
  // ============================================================================

  // 处理远程增量数据
  private async processRemoteDelta<T>(
    userId: string,
    entityType: 'card' | 'folder' | 'tag' | 'image',
    remoteData: any[],
    progress: SyncProgress
  ): Promise<void> {
    for (const remoteItem of remoteData) {
      try {
        await this.processRemoteItem(userId, entityType, remoteItem)
        progress.successfulItems++
      } catch (error) {
        console.error(`Failed to process remote ${entityType}:`, remoteItem.id, error)
        progress.failedItems++
      }
      
      this.updateProgress(progress, 1)
    }
  }

  // 处理远程项目
  private async processRemoteItem(
    userId: string,
    entityType: 'card' | 'folder' | 'tag' | 'image',
    remoteItem: any
  ): Promise<void> {
    // 检查本地是否存在
    let localItem: any = null
    
    switch (entityType) {
      case 'card':
        localItem = await db.cards.get(remoteItem.id)
        break
      case 'folder':
        localItem = await db.folders.get(remoteItem.id)
        break
      case 'tag':
        localItem = await db.tags.get(remoteItem.id)
        break
      case 'image':
        localItem = await db.images.get(remoteItem.id)
        break
    }

    if (!localItem) {
      // 本地不存在，直接插入
      await this.insertRemoteItem(entityType, remoteItem)
    } else {
      // 本地存在，检查是否需要更新
      if (remoteItem.sync_version > localItem.syncVersion) {
        await this.updateLocalItem(entityType, remoteItem)
      }
    }
  }

  // 插入远程项目
  private async insertRemoteItem(
    entityType: 'card' | 'folder' | 'tag' | 'image',
    remoteItem: any
  ): Promise<void> {
    const convertedItem = this.convertRemoteToLocal(entityType, remoteItem)
    
    switch (entityType) {
      case 'card':
        await db.cards.add(convertedItem)
        break
      case 'folder':
        await db.folders.add(convertedItem)
        break
      case 'tag':
        await db.tags.add(convertedItem)
        break
      case 'image':
        await db.images.add(convertedItem)
        break
    }
  }

  // 更新本地项目
  private async updateLocalItem(
    entityType: 'card' | 'folder' | 'tag' | 'image',
    remoteItem: any
  ): Promise<void> {
    const convertedItem = this.convertRemoteToLocal(entityType, remoteItem)
    const { id, ...updateData } = convertedItem
    
    switch (entityType) {
      case 'card':
        await db.cards.update(id, updateData)
        break
      case 'folder':
        await db.folders.update(id, updateData)
        break
      case 'tag':
        await db.tags.update(id, updateData)
        break
      case 'image':
        await db.images.update(id, updateData)
        break
    }
  }

  // 转换远程数据为本地格式
  private convertRemoteToLocal(
    entityType: 'card' | 'folder' | 'tag' | 'image',
    remoteItem: any
  ): any {
    switch (entityType) {
      case 'card':
        return {
          id: remoteItem.id,
          userId: remoteItem.user_id,
          frontContent: remoteItem.front_content,
          backContent: remoteItem.back_content,
          style: remoteItem.style,
          folderId: remoteItem.folder_id,
          isFlipped: false,
          createdAt: new Date(remoteItem.created_at),
          updatedAt: new Date(remoteItem.updated_at),
          syncVersion: remoteItem.sync_version,
          pendingSync: false
        }
        
      case 'folder':
        return {
          id: remoteItem.id,
          userId: remoteItem.user_id,
          name: remoteItem.name,
          color: '#3b82f6',
          icon: 'Folder',
          cardIds: [],
          parentId: remoteItem.parent_id,
          isExpanded: true,
          createdAt: new Date(remoteItem.created_at),
          updatedAt: new Date(remoteItem.updated_at),
          syncVersion: remoteItem.sync_version,
          pendingSync: false
        }
        
      case 'tag':
        return {
          id: remoteItem.id,
          userId: remoteItem.user_id,
          name: remoteItem.name,
          color: remoteItem.color,
          count: 0,
          createdAt: new Date(remoteItem.created_at),
          updatedAt: new Date(remoteItem.updated_at),
          syncVersion: remoteItem.sync_version,
          pendingSync: false
        }
        
      case 'image':
        return {
          id: remoteItem.id,
          cardId: remoteItem.card_id,
          userId: remoteItem.user_id,
          fileName: remoteItem.file_name,
          filePath: remoteItem.file_path,
          cloudUrl: remoteItem.cloud_url,
          metadata: remoteItem.metadata,
          storageMode: 'cloud' as const,
          createdAt: new Date(remoteItem.created_at),
          updatedAt: new Date(remoteItem.updated_at),
          syncVersion: remoteItem.sync_version,
          pendingSync: false
        }
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  // 获取自适应批次大小
  private getAdaptiveBatchSize(): number {
    if (!this.config.performance.adaptiveBatchSize) {
      return this.config.incremental.batchSize
    }

    const networkStrategy = getNetworkStrategy()
    return networkStrategy.batchSize
  }

  // 更新进度
  private updateProgress(progress: SyncProgress, processedItems: number): void {
    progress.processedItems += processedItems
    
    // 计算预计剩余时间
    if (progress.processedItems > 0) {
      const elapsed = Date.now() - progress.performance.startTime.getTime()
      const averageTimePerItem = elapsed / progress.processedItems
      const remainingItems = progress.totalItems - progress.processedItems
      progress.performance.estimatedTimeRemaining = remainingItems * averageTimePerItem
    }

    // 通知进度更新
    this.notifyListeners('syncProgress', progress)
  }

  // 处理远程增量数据
  private async processRemoteDelta(
    userId: string,
    entityType: 'card' | 'folder' | 'tag' | 'image',
    remoteData: any[],
    progress: SyncProgress
  ): Promise<void> {
    for (const remoteItem of remoteData) {
      try {
        await this.processRemoteItem(userId, entityType, remoteItem)
        progress.successfulItems++
      } catch (error) {
        console.error(`Failed to process remote ${entityType}:`, remoteItem.id, error)
        progress.failedItems++
      }
      
      this.updateProgress(progress, 1)
    }
  }

  // ============================================================================
  // 事件监听器管理
  // ============================================================================

  // 添加事件监听器
  addEventListener<K extends keyof typeof this.listeners>(
    event: K,
    callback: NonNullable<typeof this.listeners[K]>
  ): void {
    this.listeners[event] = callback as any
  }

  // 移除事件监听器
  removeEventListener<K extends keyof typeof this.listeners>(
    event: K
  ): void {
    delete this.listeners[event]
  }

  // 通知监听器
  private notifyListeners<K extends keyof typeof this.listeners>(
    event: K,
    data: Parameters<NonNullable<typeof this.listeners[K]>>[0]
  ): void {
    const listener = this.listeners[event]
    if (listener) {
      try {
        listener(data)
      } catch (error) {
        console.error(`Error in ${event} listener:`, error)
      }
    }
  }

  // ============================================================================
  // 公共工具方法
  // ============================================================================

  // 手动解决冲突
  async manuallyResolveConflict(
    conflictId: string,
    resolution: ResolutionStrategy,
    customData?: any
  ): Promise<void> {
    // 这里应该从存储中获取冲突记录
    // 暂时返回空实现
    console.warn('Manual conflict resolution not fully implemented')
  }

  // 获取冲突历史
  async getConflictHistory(
    userId: string,
    options?: {
      limit?: number
      entityType?: 'card' | 'folder' | 'tag' | 'image'
      startDate?: Date
      endDate?: Date
    }
  ): Promise<SyncConflict[]> {
    // 这里应该从数据库或IndexedDB中获取冲突历史
    // 暂时返回空数组
    return []
  }

  // 获取同步统计
  async getSyncStats(userId: string): Promise<{
    totalSyncs: number
    successfulSyncs: number
    failedSyncs: number
    averageSyncTime: number
    lastSyncTime?: Date
    conflictsResolved: number
    conflictsPending: number
  }> {
    // 这里应该从数据库中获取同步统计
    // 暂时返回默认值
    return {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageSyncTime: 0,
      conflictsResolved: 0,
      conflictsPending: 0
    }
  }
}

// 导出单例实例
export const syncStrategyService = new SyncStrategyService()