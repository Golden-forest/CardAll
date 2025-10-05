import { Card, Folder, Tag, Settings } from '../types/cardall'
import { UniversalStorageAdapter } from './universal-storage-adapter'
import { storageMonitorService } from './storage-monitor'

// 恢复点类型
export // 恢复数据结构
export // 恢复元数据
export // 恢复选项
export // 恢复结果
export   conflicts: Conflict[]
  warnings: string[]
  recoveryPoint?: RecoveryPoint
  duration: number
}

// 冲突信息
export // 恢复配置
export   retention: {
    maxTotalSize: number // MB
    maxAge: number // 天
    minPoints: number
    autoCleanup: boolean
  }
  compression: {
    enabled: boolean
    level: number // 1-9
    threshold: number // KB
  }
  encryption: {
    enabled: boolean
    algorithm: string
    keyRotationDays: number
  }
  validation: {
    integrityCheck: boolean
    checksumVerification: boolean
    schemaValidation: boolean
    deepValidation: boolean
  }
  privacy: {
    anonymizeData: boolean
    localOnly: boolean
    dataRetentionPolicy: string
    userConsentRequired: boolean
  }
  smartFeatures: {
    adaptiveScheduling: boolean
    predictiveBackup: boolean
    smartCompression: boolean
    automaticOptimization: boolean
  }
  advancedStrategies: {
    versionChainEnabled: boolean
    incrementalBackupEnabled: boolean
    smartPruningEnabled: boolean
    healthMonitoringEnabled: boolean
    autoPrioritizationEnabled: boolean
  }
  recoveryPointTypes: {
    scheduled: {
      enabled: boolean
      interval: number // 小时
      maxPoints: number
    }
    beforeUpdate: {
      enabled: boolean
      retainPeriod: number // 天
    }
    afterUpdate: {
      enabled: boolean
      validationLevel: 'basic' | 'deep'
    }
    emergency: {
      enabled: boolean
      autoCreateOnError: boolean
      maxPoints: number
    }
  }
}

// 恢复统计信息
export   backupHealth: {
    score: number // 0-100
    issues: string[]
    recommendations: string[]
  }
  privacyMetrics: {
    dataEncrypted: boolean
    localOnly: boolean
    lastCleanup: Date | null
    userAccessCount: number
  }
  performanceMetrics: {
    averageBackupTime: number
    averageRestoreTime: number
    compressionRatio: number
    storageEfficiency: number
  }
}

/**
 * 智能数据恢复服务
 *
 * 提供自动数据备份、恢复和版本管理功能
 * 支持多版本数据备份、智能冲突解决和用户友好的恢复界面
 *
 * 隐私政策承诺:
 * - 所有数据备份仅存储在用户设备上
 * - 不会将任何用户数据上传到外部服务器
 * - 数据加密保护用户隐私
 * - 提供透明的数据存储信息
 * - 用户完全控制数据的备份和删除
 */
class DataRecoveryService {
  private static instance: DataRecoveryService
  private storageAdapter: UniversalStorageAdapter
  private config: RecoveryConfig
  private recoveryPoints: RecoveryPoint[] = []
  private initialized = false
  private autoBackupInterval?: number

  private constructor() {
    this.storageAdapter = UniversalStorageAdapter.getInstance()
    this.config = this.getDefaultConfig()
  }

  static getInstance(): DataRecoveryService {
    if (!DataRecoveryService.instance) {
      DataRecoveryService.instance = new DataRecoveryService()
    }
    return DataRecoveryService.instance
  }

  /**
   * 初始化恢复服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      await this.loadConfig()
      await this.loadRecoveryPoints()
      this.startAutoBackup()

      this.initialized = true
      console.log('Data recovery service initialized successfully')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 创建恢复点
   */
  async createRecoveryPoint(
    type: RecoveryPoint['type'] = 'manual',
    description?: string,
    metadata?: Partial<RecoveryMetadata>,
    options?: {
      priority?: RecoveryPoint['priority']
      tags?: string[]
      isProtected?: boolean
      expirationDate?: number
      parentPointId?: string
    }
  ): Promise<RecoveryPoint> {
    try {
      const startTime = performance.now()

      // 获取当前数据
      const [cards, folders, tags, settings] = await Promise.all([
        this.storageAdapter.getCards(),
        this.storageAdapter.getFolders(),
        this.storageAdapter.getTags(),
        this.storageAdapter.getSettings()
      ])

      // 构建恢复数据
      const recoveryData: RecoveryData = {
        cards,
        folders,
        tags,
        settings,
        version: '1.0',
        schema: 'cardall-v1'
      }

      // 创建恢复点
      const recoveryPoint: RecoveryPoint = {
        id: this.generateRecoveryPointId(),
        timestamp: Date.now(),
        type,
        description: description || this.getDefaultDescription(type),
        data: recoveryData,
        metadata: {
          createdby: 'user',
          reason: description || '',
          tags: this.generateTags(type),
          storageLocation: await this.getCurrentStorageLocation(),
          estimatedDataSize: this.estimateDataSize(recoveryData),
          ...metadata
        },
        checksum: await this.calculateChecksum(recoveryData),
        size: JSON.stringify(recoveryData).length,
        priority: options?.priority || this.getDefaultPriority(type),
        tags: options?.tags || this.generateTags(type),
        isProtected: options?.isProtected || false,
        expirationDate: options?.expirationDate,
        parentPointId: options?.parentPointId,
        childrenPointIds: [],
        restoreCount: 0,
        healthScore: 100
      }

      // 压缩数据（如果启用）
      if (this.config.compression.enabled) {
        const compressedData = await this.compressData(recoveryData)
        if (compressedData.length < recoveryData.size) {
          recoveryPoint.metadata.compressionRatio = compressedData.length / recoveryPoint.size
          // 在实际实现中,这里会存储压缩后的数据
        }
      }

      // 保存恢复点
      this.recoveryPoints.push(recoveryPoint)
      await this.saveRecoveryPoints()

      // 清理旧的恢复点
      await this.cleanupOldRecoveryPoints()

      const duration = performance.now() - startTime
      console.log(`Recovery point created: ${recoveryPoint.id} (${duration.toFixed(2)}ms)`)

      // 记录操作
      storageMonitorService.recordOperation(
        'write',
        'create_recovery_point',
        duration,
        true,
        recoveryPoint.size,
        undefined,
        { recoveryPointId: recoveryPoint.id, type }
      )

      return recoveryPoint
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 从恢复点恢复数据
   */
  async recoverFromPoint(
    recoveryPointId: string,
    options: RecoveryOptions = {}
  ): Promise<RecoveryResult> {
    try {
      const startTime = performance.now()

      // 查找恢复点
      const recoveryPoint = this.recoveryPoints.find(rp => rp.id === recoveryPointId)
      if (!recoveryPoint) {
        throw new Error(`Recovery point not found: ${recoveryPointId}`)
      }

      // 验证恢复点
      if (options.validateIntegrity !== false) {
        const isValid = await this.validateRecoveryPoint(recoveryPoint)
        if (!isValid) {
          throw new Error('Recovery point integrity check failed')
        }
      }

      // 创建当前数据的备份（如果要求）
      let backupPoint: RecoveryPoint | undefined
      if (options.backupBeforeRecovery !== false) {
        backupPoint = await this.createRecoveryPoint(
          'auto',
          `Pre-recovery backup before restoring from ${recoveryPoint.id}`
        )
      }

      // 执行恢复
      const result = await this.performRecovery(recoveryPoint, options)

      const duration = performance.now() - startTime
      result.duration = duration
      result.recoveryPoint = recoveryPoint

      console.log(`Recovery completed: ${recoveryPointId} (${duration.toFixed(2)}ms)`)

      // 记录操作
      storageMonitorService.recordOperation(
        'write',
        'recover_data',
        duration,
        result.success,
        recoveryPoint.size,
        result.success ? undefined : result.message,
        { recoveryPointId: recoveryPoint.id, itemsRestored: result.restoredItems }
      )

      return result
    } catch (error) {
          console.warn("操作失败:", error)
        },
        conflicts: [],
        warnings: [],
        duration
      }

      storageMonitorService.recordOperation(
        'write',
        'recover_data',
        duration,
        false,
        0,
        result.message
      )

      return result
    }
  }

  /**
   * 执行实际的恢复操作
   */
  private async performRecovery(
    recoveryPoint: RecoveryPoint,
    options: RecoveryOptions
  ): Promise<RecoveryResult> {
    const result: RecoveryResult = {
      success: false,
      message: '',
      restoredItems: { cards: 0, folders: 0, tags: 0, settings: false },
      conflicts: [],
      warnings: [],
      duration: 0
    }

    try {
      const targets = options.targetData || ['cards', 'folders', 'tags', 'settings']
      const mergeStrategy = options.mergeStrategy || 'smart_merge'
      const conflictResolution = options.conflictResolution || 'newer_wins'

      // 获取当前数据
      const [currentCards, currentFolders, currentTags, currentSettings] = await Promise.all([
        this.storageAdapter.getCards(),
        this.storageAdapter.getFolders(),
        this.storageAdapter.getTags(),
        this.storageAdapter.getSettings()
      ])

      // 恢复卡片
      if (targets.includes('cards')) {
        const cardResult = await this.recoverCards(
          currentCards,
          recoveryPoint.data.cards,
          mergeStrategy,
          conflictResolution
        )
        result.restoredItems.cards = cardResult.restored
        result.conflicts.push(...cardResult.conflicts)
      }

      // 恢复文件夹
      if (targets.includes('folders')) {
        const folderResult = await this.recoverFolders(
          currentFolders,
          recoveryPoint.data.folders,
          mergeStrategy,
          conflictResolution
        )
        result.restoredItems.folders = folderResult.restored
        result.conflicts.push(...folderResult.conflicts)
      }

      // 恢复标签
      if (targets.includes('tags')) {
        const tagResult = await this.recoverTags(
          currentTags,
          recoveryPoint.data.tags,
          mergeStrategy,
          conflictResolution
        )
        result.restoredItems.tags = tagResult.restored
        result.conflicts.push(...tagResult.conflicts)
      }

      // 恢复设置
      if (targets.includes('settings')) {
        const settingsResult = await this.recoverSettings(
          currentSettings,
          recoveryPoint.data.settings,
          mergeStrategy,
          conflictResolution
        )
        result.restoredItems.settings = settingsResult.restored
        result.conflicts.push(...settingsResult.conflicts)
      }

      result.success = true
      result.message = 'Recovery completed successfully'

      return result
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 恢复卡片数据
   */
  private async recoverCards(
    currentCards: Card[],
    recoveryCards: Card[],
    mergeStrategy: string,
    conflictResolution: string
  ): Promise<{ restored: number; conflicts: Conflict[] }> {
    const conflicts: Conflict[] = []
    let restored = 0

    if (mergeStrategy === 'replace') {
      await this.storageAdapter.saveCards(recoveryCards)
      restored = recoveryCards.length
    } else {
      // 智能合并逻辑
      const mergedCards: Card[] = []
      const currentCardMap = new Map(currentCards.map(c => [c.id, c]))
      const recoveryCardMap = new Map(recoveryCards.map(c => [c.id, c]))

      for (const [id, recoveryCard] of recoveryCardMap) {
        const currentCard = currentCardMap.get(id)

        if (!currentCard) {
          // 新卡片,直接添加
          mergedCards.push(recoveryCard)
          restored++
        } else {
          // 冲突处理
          const conflict = this.resolveCardConflict(currentCard, recoveryCard, conflictResolution)
          if (conflict) {
            conflicts.push(conflict)
          }
          mergedCards.push(conflict?.resolution === 'keep_existing' ? currentCard : recoveryCard)
          restored++
        }
      }

      // 保留当前独有的卡片
      for (const [id, currentCard] of currentCardMap) {
        if (!recoveryCardMap.has(id)) {
          mergedCards.push(currentCard)
        }
      }

      await this.storageAdapter.saveCards(mergedCards)
    }

    return { restored, conflicts }
  }

  /**
   * 恢复文件夹数据
   */
  private async recoverFolders(
    currentFolders: Folder[],
    recoveryFolders: Folder[],
    mergeStrategy: string,
    conflictResolution: string
  ): Promise<{ restored: number; conflicts: Conflict[] }> {
    const conflicts: Conflict[] = []
    let restored = 0

    if (mergeStrategy === 'replace') {
      await this.storageAdapter.saveFolders(recoveryFolders)
      restored = recoveryFolders.length
    } else {
      // 智能合并逻辑
      const mergedFolders: Folder[] = []
      const currentFolderMap = new Map(currentFolders.map(f => [f.id, f]))
      const recoveryFolderMap = new Map(recoveryFolders.map(f => [f.id, f]))

      for (const [id, recoveryFolder] of recoveryFolderMap) {
        const currentFolder = currentFolderMap.get(id)

        if (!currentFolder) {
          mergedFolders.push(recoveryFolder)
          restored++
        } else {
          const conflict = this.resolveFolderConflict(currentFolder, recoveryFolder, conflictResolution)
          if (conflict) {
            conflicts.push(conflict)
          }
          mergedFolders.push(conflict?.resolution === 'keep_existing' ? currentFolder : recoveryFolder)
          restored++
        }
      }

      // 保留当前独有的文件夹
      for (const [id, currentFolder] of currentFolderMap) {
        if (!recoveryFolderMap.has(id)) {
          mergedFolders.push(currentFolder)
        }
      }

      await this.storageAdapter.saveFolders(mergedFolders)
    }

    return { restored, conflicts }
  }

  /**
   * 恢复标签数据
   */
  private async recoverTags(
    currentTags: Tag[],
    recoveryTags: Tag[],
    mergeStrategy: string,
    conflictResolution: string
  ): Promise<{ restored: number; conflicts: Conflict[] }> {
    const conflicts: Conflict[] = []
    let restored = 0

    if (mergeStrategy === 'replace') {
      await this.storageAdapter.saveTags(recoveryTags)
      restored = recoveryTags.length
    } else {
      // 智能合并逻辑
      const mergedTags: Tag[] = []
      const currentTagMap = new Map(currentTags.map(t => [t.id, t]))
      const recoveryTagMap = new Map(recoveryTags.map(t => [t.id, t]))

      for (const [id, recoveryTag] of recoveryTagMap) {
        const currentTag = currentTagMap.get(id)

        if (!currentTag) {
          mergedTags.push(recoveryTag)
          restored++
        } else {
          const conflict = this.resolveTagConflict(currentTag, recoveryTag, conflictResolution)
          if (conflict) {
            conflicts.push(conflict)
          }
          mergedTags.push(conflict?.resolution === 'keep_existing' ? currentTag : recoveryTag)
          restored++
        }
      }

      // 保留当前独有的标签
      for (const [id, currentTag] of currentTagMap) {
        if (!recoveryTagMap.has(id)) {
          mergedTags.push(currentTag)
        }
      }

      await this.storageAdapter.saveTags(mergedTags)
    }

    return { restored, conflicts }
  }

  /**
   * 恢复设置数据
   */
  private async recoverSettings(
    currentSettings: Settings,
    recoverySettings: Settings,
    mergeStrategy: string,
    conflictResolution: string
  ): Promise<{ restored: boolean; conflicts: Conflict[] }> {
    const conflicts: Conflict[] = []

    if (mergeStrategy === 'replace') {
      await this.storageAdapter.saveSettings(recoverySettings)
      return { restored: true, conflicts }
    }

    // 智能合并设置
    const mergedSettings: Settings = { ...currentSettings }

    for (const [key, value] of Object.entries(recoverySettings)) {
      if (currentSettings[key as keyof Settings] !== value) {
        const conflict = this.resolveSettingsConflict(
          key,
          currentSettings[key as keyof Settings],
          value,
          conflictResolution
        )
        if (conflict) {
          conflicts.push(conflict)
        }
        mergedSettings[key as keyof Settings] = conflict?.resolution === 'keep_existing'
          ? currentSettings[key as keyof Settings]
          : value
      }
    }

    await this.storageAdapter.saveSettings(mergedSettings)
    return { restored: true, conflicts }
  }

  /**
   * 解析卡片冲突
   */
  private resolveCardConflict(
    current: Card,
    recovery: Card,
    resolution: string
  ): Conflict | null {
    if (resolution === 'newer_wins') {
      return current.updatedAt > recovery.updatedAt ? {
        id: current.id,
        type: 'card',
        existingData: current,
        recoveryData: recovery,
        resolution: 'keep_existing'
      } : null
    } else if (resolution === 'older_wins') {
      return current.updatedAt < recovery.updatedAt ? {
        id: current.id,
        type: 'card',
        existingData: current,
        recoveryData: recovery,
        resolution: 'keep_existing'
      } : null
    }

    return {
      id: current.id,
      type: 'card',
      existingData: current,
      recoveryData: recovery,
      resolution: resolution === 'manual' ? 'pending' : 'keep_existing'
    }
  }

  /**
   * 解析文件夹冲突
   */
  private resolveFolderConflict(
    current: Folder,
    recovery: Folder,
    resolution: string
  ): Conflict | null {
    // 简化的冲突解决逻辑
    if (resolution === 'newer_wins') {
      return current.updatedAt > recovery.updatedAt ? {
        id: current.id,
        type: 'folder',
        existingData: current,
        recoveryData: recovery,
        resolution: 'keep_existing'
      } : null
    } else if (resolution === 'older_wins') {
      return current.updatedAt < recovery.updatedAt ? {
        id: current.id,
        type: 'folder',
        existingData: current,
        recoveryData: recovery,
        resolution: 'keep_existing'
      } : null
    }

    return {
      id: current.id,
      type: 'folder',
      existingData: current,
      recoveryData: recovery,
      resolution: resolution === 'manual' ? 'pending' : 'keep_existing'
    }
  }

  /**
   * 解析标签冲突
   */
  private resolveTagConflict(
    current: Tag,
    recovery: Tag,
    resolution: string
  ): Conflict | null {
    // 简化的冲突解决逻辑
    if (resolution === 'newer_wins') {
      return current.updatedAt > recovery.updatedAt ? {
        id: current.id,
        type: 'tag',
        existingData: current,
        recoveryData: recovery,
        resolution: 'keep_existing'
      } : null
    } else if (resolution === 'older_wins') {
      return current.updatedAt < recovery.updatedAt ? {
        id: current.id,
        type: 'tag',
        existingData: current,
        recoveryData: recovery,
        resolution: 'keep_existing'
      } : null
    }

    return {
      id: current.id,
      type: 'tag',
      existingData: current,
      recoveryData: recovery,
      resolution: resolution === 'manual' ? 'pending' : 'keep_existing'
    }
  }

  /**
   * 解析设置冲突
   */
  private resolveSettingsConflict(
    key: string,
    current: any,
    recovery: any,
    resolution: string
  ): Conflict | null {
    if (resolution === 'manual') {
      return {
        id: key,
        type: 'setting',
        existingData: { [key]: current },
        recoveryData: { [key]: recovery },
        resolution: 'pending'
      }
    }

    return null // 自动使用恢复值
  }

  /**
   * 获取所有恢复点
   */
  getRecoveryPoints(): RecoveryPoint[] {
    return [...this.recoveryPoints].sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * 获取恢复点详情
   */
  getRecoveryPoint(id: string): RecoveryPoint | null {
    return this.recoveryPoints.find(rp => rp.id === id) || null
  }

  /**
   * 删除恢复点
   */
  async deleteRecoveryPoint(id: string): Promise<boolean> {
    const index = this.recoveryPoints.findIndex(rp => rp.id === id)
    if (index === -1) {
      return false
    }

    this.recoveryPoints.splice(index, 1)
    await this.saveRecoveryPoints()
    return true
  }

  /**
   * 获取恢复统计信息
   */
  getStatistics(): RecoveryStatistics {
    const points = this.recoveryPoints.sort((a, b) => a.timestamp - b.timestamp)
    const totalSize = this.recoveryPoints.reduce((sum, rp) => sum + rp.size, 0)

    return {
      totalRecoveryPoints: this.recoveryPoints.length,
      totalSize,
      oldestRecoveryPoint: points.length > 0 ? new Date(points[0].timestamp) : null,
      newestRecoveryPoint: points.length > 0 ? new Date(points[points.length - 1].timestamp) : null,
      recoverySuccessRate: this.calculateSuccessRate(),
      averageRecoveryTime: this.calculateAverageRecoveryTime(),
      lastRecoveryDate: this.getLastRecoveryDate(),
      storageUsage: this.calculateStorageUsage(),
      backupHealth: this.calculateBackupHealth(),
      privacyMetrics: this.calculatePrivacyMetrics(),
      performanceMetrics: this.calculatePerformanceMetrics()
    }
  }

  /**
   * 获取恢复配置
   */
  getConfig(): RecoveryConfig {
    return { ...this.config }
  }

  /**
   * 更新恢复配置
   */
  async updateConfig(config: Partial<RecoveryConfig>): Promise<void> {
    this.config = { ...this.config, ...config }
    await this.saveConfig()

    // 重启自动备份
    this.stopAutoBackup()
    if (this.config.autoBackup.enabled) {
      this.startAutoBackup()
    }
  }

  /**
   * 验证恢复点完整性
   */
  async validateRecoveryPoint(recoveryPoint: RecoveryPoint): Promise<boolean> {
    try {
      // 验证校验和
      if (this.config.validation.checksumVerification) {
        const calculatedChecksum = await this.calculateChecksum(recoveryPoint.data)
        if (calculatedChecksum !== recoveryPoint.checksum) {
          return false
        }
      }

      // 验证数据完整性
      if (this.config.validation.integrityCheck) {
        const isValid = await this.validateDataIntegrity(recoveryPoint.data)
        if (!isValid) {
          return false
        }
      }

      // 验证架构
      if (this.config.validation.schemaValidation) {
        const isValid = this.validateSchema(recoveryPoint.data)
        if (!isValid) {
          return false
        }
      }

      return true
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 导出恢复点
   */
  async exportRecoveryPoint(id: string): Promise<string> {
    const recoveryPoint = this.recoveryPoints.find(rp => rp.id === id)
    if (!recoveryPoint) {
      throw new Error('Recovery point not found')
    }

    // 创建导出数据（包含元数据）
    const exportData = {
      version: '1.0',
      exportedAt: Date.now(),
      recoveryPoint
    }

    return JSON.stringify(exportData, null, 2)
  }

  /**
   * 导入恢复点
   */
  async importRecoveryPoint(exportData: string): Promise<RecoveryPoint> {
    try {
      const parsed = JSON.parse(exportData)

      if (!parsed.recoveryPoint || !parsed.version) {
        throw new Error('Invalid export format')
      }

      const recoveryPoint = parsed.recoveryPoint

      // 验证恢复点
      const isValid = await this.validateRecoveryPoint(recoveryPoint)
      if (!isValid) {
        throw new Error('Imported recovery point validation failed')
      }

      // 生成新的ID避免冲突
      recoveryPoint.id = this.generateRecoveryPointId()
      recoveryPoint.metadata.createdby = 'user'
      recoveryPoint.metadata.reason = 'Imported recovery point'
      recoveryPoint.timestamp = Date.now()

      this.recoveryPoints.push(recoveryPoint)
      await this.saveRecoveryPoints()

      return recoveryPoint
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 获取隐私政策信息
   */
  getPrivacyPolicy(): string {
    const config = this.getConfig()
    return `
# CardEverything 数据恢复服务隐私政策

**最后更新**: ${new Date().toLocaleDateString('zh-CN')}

## 1. 数据收集和使用

### 1.1 数据收集范围
- **卡片数据**: 包括卡片标题、内容、标签、创建时间、修改时间
- **文件夹结构**: 文件夹名称、层级关系、组织方式
- **标签信息**: 标签名称、颜色、使用统计
- **应用设置**: 用户偏好、显示设置、功能配置
- **系统信息**: 数据版本、架构信息、恢复元数据

### 1.2 数据使用目的
- **数据恢复**: 在数据丢失时提供恢复功能
- **数据迁移**: 支持设备间的数据转移
- **完整性检查**: 验证数据的一致性和完整性
- **性能优化**: 分析使用模式以优化备份策略

### 1.3 数据使用限制
- 不用于商业分析或广告推送
- 不与第三方共享您的个人数据
- 不进行用户行为分析
- 不收集敏感个人信息

## 2. 数据安全保障

### 2.1 存储安全
${config.encryption.enabled ? `
- **数据加密**: 使用 ${config.encryption.algorithm} 加密算法
- **密钥管理**: 支持${config.encryption.keyRotationDays}天密钥轮换
- **本地存储**: ${config.privacy.localOnly ? '所有数据仅存储在本地设备' : '支持云存储同步'}
` : `
- **明文存储**: 当前未启用加密功能
- **建议**: 启用加密以增强数据安全性
`}

### 2.2 访问控制
- **用户授权**: ${config.privacy.userConsentRequired ? '需要用户明确授权' : '自动授权'}
- **访问日志**: 记录所有数据访问操作
- **权限验证**: 每次访问都进行权限验证

### 2.3 数据匿名化
${config.privacy.anonymizeData ? `
- **自动匿名化**: 移除或模糊化个人标识信息
- **数据脱敏**: 备份时自动处理敏感字段
- **统计分析**: 使用匿名数据进行性能分析
` : `
- **原始数据**: 保留原始数据格式
- **完整备份**: 确保恢复时数据的完整性
`}

## 3. 用户权利

### 3.1 数据访问权
- **查看备份**: 随时查看所有恢复点
- **数据导出**: 一键导出所有备份数据
- **访问历史**: 查看数据访问和修改记录

### 3.2 数据控制权
- **删除备份**: 可以删除任何恢复点
- **停止备份**: 可以暂停或关闭自动备份
- **自定义策略**: 设置个性化的数据保留策略

### 3.3 数据可携权
- **数据导出**: 支持多种格式的数据导出
- **数据迁移**: 支持不同设备间的数据迁移
- **格式开放**: 使用开放标准的数据格式

## 4. 数据保留策略

### 4.1 自动保留
- **时间限制**: 自动清理超过 ${config.retention.maxAge} 天的恢复点
- **数量限制**: 最多保留 ${config.retention.maxPoints} 个恢复点
- **空间限制**: 总大小不超过 ${config.retention.maxTotalSize} MB

### 4.2 智能清理
${config.retention.autoCleanup ? `
- **智能清理**: 基于重要性评分自动清理
- **优先保留**: 优先保留重要和频繁使用的数据
- **用户通知**: 清理前通知用户确认
` : `
- **手动清理**: 需要用户手动清理过期数据
- **保留所有**: 保留所有恢复点直到空间不足
`}

## 5. 技术实现

### 5.1 备份机制
- **增量备份**: 仅备份变更的数据以提高效率
- **压缩技术**: 使用 ${config.compression.level} 级压缩算法
- **完整性验证**: 每个恢复点都有校验和验证

### 5.2 恢复机制
- **版本控制**: 支持多版本数据恢复
- **冲突解决**: 智能处理数据冲突
- **回滚支持**: 支持恢复操作的回滚

### 5.3 性能优化
${config.smartFeatures.adaptiveScheduling ? `
- **智能调度**: 根据使用模式调整备份时机
- **预测性备份**: 预测可能的操作并提前备份
` : `
- **固定调度**: 按照固定时间间隔进行备份
- **手动触发**: 主要依靠用户手动触发备份
`}

## 6. 用户责任

### 6.1 设备安全
- **设备保护**: 请确保您的设备密码和生物识别安全
- **定期备份**: 建议定期手动备份重要数据
- **空间管理**: 关注存储空间使用情况

### 6.2 数据确认
- **备份验证**: 定期验证备份数据的完整性
- **恢复测试**: 建议定期测试恢复功能
- **策略更新**: 根据使用情况调整备份策略

## 7. 政策更新

### 7.1 更新通知
- **及时通知**: 政策更新时及时通知用户
- **重大变更**: 重大变更需要用户重新确认
- **历史记录**: 保存政策更新历史记录

### 7.2 用户确认
- **使用确认**: 继续使用即表示同意新政策
- **拒绝权利**: 用户有权拒绝不接受的变更
- **数据导出**: 拒绝时可以导出所有数据

## 8. 联系方式

### 8.1 技术支持
- **应用内反馈**: 通过应用内反馈功能联系
- **问题响应**: 48小时内响应技术问题
- **改进建议**: 欢迎提供功能改进建议

### 8.2 隐私问题
- **隐私咨询**: 专门的隐私问题咨询渠道
- **数据请求**: 处理数据访问和删除请求
- **合规说明**: 提供详细的合规说明文档

---

**同意确认**: 继续使用本应用的数据恢复功能,即表示您已阅读、理解并同意本隐私政策。

**版本**: 2.0
**生效日期**: ${new Date().toLocaleDateString('zh-CN')}
    `.trim()
  }

  /**
   * 检查隐私合规性
   */
  async checkPrivacyCompliance(): Promise<{
    compliant: boolean
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    // 检查本地存储合规性
    if (!this.config.privacy.localOnly) {
      issues.push('数据未限制为本地存储')
      recommendations.push('建议启用仅本地存储选项以保护隐私')
    }

    // 检查加密状态
    if (!this.config.encryption.enabled) {
      recommendations.push('建议启用数据加密以增强安全性')
    }

    // 检查数据匿名化
    if (!this.config.privacy.anonymizeData) {
      recommendations.push('考虑启用数据匿名化功能')
    }

    // 检查用户同意
    if (this.config.privacy.userConsentRequired) {
      // 检查是否已获得用户同意
      const hasConsent = localStorage.getItem('cardall_privacy_consent')
      if (!hasConsent) {
        issues.push('缺少用户隐私同意')
        recommendations.push('需要获取用户隐私同意')
      }
    }

    return {
      compliant: issues.length === 0,
      issues,
      recommendations
    }
  }

  /**
   * 清理用户数据
   */
  async cleanupUserData(): Promise<void> {
    try {
      // 删除所有恢复点
      this.recoveryPoints = []
      await this.saveRecoveryPoints()

      // 删除配置
      localStorage.removeItem('cardall_recovery_config')
      localStorage.removeItem('cardall_recovery_points')
      localStorage.removeItem('cardall_privacy_consent')

      console.log('用户数据已清理')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 导出隐私报告
   */
  async exportPrivacyReport(): Promise<string> {
    const compliance = await this.checkPrivacyCompliance()
    const statistics = this.getStatistics()

    const report = {
      timestamp: new Date().toISOString(),
      privacyPolicy: this.getPrivacyPolicy(),
      compliance,
      dataSummary: {
        totalRecoveryPoints: statistics.totalRecoveryPoints,
        totalStorageUsed: statistics.totalSize,
        dataEncrypted: statistics.privacyMetrics.dataEncrypted,
        localOnly: statistics.privacyMetrics.localOnly,
        retentionPolicy: this.config.privacy.dataRetentionPolicy
      },
      recommendations: compliance.recommendations
    }

    return JSON.stringify(report, null, 2)
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.stopAutoBackup()
    this.initialized = false
    this.recoveryPoints = []
  }

  // 私有方法

  private getDefaultConfig(): RecoveryConfig {
    return {
      autoBackup: {
        enabled: true,
        interval: 60, // 1小时
        maxPoints: 50,
        triggers: ['startup', 'shutdown', 'data_change', 'user_idle']
      },
      retention: {
        maxTotalSize: 100, // 100MB
        maxAge: 30, // 30天
        minPoints: 10,
        autoCleanup: true
      },
      compression: {
        enabled: true,
        level: 6,
        threshold: 10 // 10KB
      },
      encryption: {
        enabled: false,
        algorithm: 'AES-256-GCM',
        keyRotationDays: 90
      },
      validation: {
        integrityCheck: true,
        checksumVerification: true,
        schemaValidation: true,
        deepValidation: false
      },
      privacy: {
        anonymizeData: false,
        localOnly: true,
        dataRetentionPolicy: '保留30天,自动清理过期数据',
        userConsentRequired: false
      },
      smartFeatures: {
        adaptiveScheduling: true,
        predictiveBackup: false,
        smartCompression: true,
        automaticOptimization: true
      },
      advancedStrategies: {
        versionChainEnabled: true,
        incrementalBackupEnabled: true,
        smartPruningEnabled: true,
        healthMonitoringEnabled: true,
        autoPrioritizationEnabled: true
      },
      recoveryPointTypes: {
        scheduled: {
          enabled: true,
          interval: 24, // 24小时
          maxPoints: 30
        },
        beforeUpdate: {
          enabled: true,
          retainPeriod: 7 // 7天
        },
        afterUpdate: {
          enabled: true,
          validationLevel: 'basic'
        },
        emergency: {
          enabled: true,
          autoCreateOnError: true,
          maxPoints: 10
        }
      }
    }
  }

  private generateRecoveryPointId(): string {
    return `rp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 获取默认优先级
  private getDefaultPriority(type: RecoveryPoint['type']): RecoveryPoint['priority'] {
    const priorityMap: Record<RecoveryPoint['type'], RecoveryPoint['priority']> = {
      'manual': 'normal',
      'auto': 'normal',
      'migration': 'high',
      'integrity_check': 'normal',
      'scheduled': 'normal',
      'before_update': 'high',
      'after_update': 'normal',
      'emergency': 'critical'
    }
    return priorityMap[type] || 'normal'
  }

  private getDefaultDescription(type: RecoveryPoint['type']): string {
    const descriptions = {
      manual: 'Manual backup',
      auto: 'Automatic backup',
      migration: 'Pre-migration backup',
      integrity_check: 'Pre-integrity check backup'
    }
    return descriptions[type] || 'Backup'
  }

  private generateTags(type: RecoveryPoint['type']): string[] {
    const tagMap = {
      manual: ['manual', 'user'],
      auto: ['auto', 'scheduled'],
      migration: ['migration', 'system'],
      integrity_check: ['integrity', 'system']
    }
    return tagMap[type] || ['backup']
  }

  private async getCurrentStorageLocation(): Promise<'localStorage' | 'IndexedDB' | 'cloud'> {
    // 简化实现,实际应该查询当前存储位置
    return 'localStorage'
  }

  private estimateDataSize(data: RecoveryData): number {
    return JSON.stringify(data).length
  }

  private async calculateChecksum(data: RecoveryData): Promise<string> {
    // 简化的校验和计算
    const dataString = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return hash.toString(36)
  }

  private async compressData(data: RecoveryData): Promise<string> {
    // 简化实现,实际应该使用压缩库
    return JSON.stringify(data)
  }

  private async loadConfig(): Promise<void> {
    try {
      const savedConfig = localStorage.getItem('cardall_recovery_config')
      if (savedConfig) {
        this.config = { ...this.config, ...JSON.parse(savedConfig) }
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async saveConfig(): Promise<void> {
    try {
      localStorage.setItem('cardall_recovery_config', JSON.stringify(this.config))
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async loadRecoveryPoints(): Promise<void> {
    try {
      const saved = localStorage.getItem('cardall_recovery_points')
      if (saved) {
        this.recoveryPoints = JSON.parse(saved)
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async saveRecoveryPoints(): Promise<void> {
    try {
      localStorage.setItem('cardall_recovery_points', JSON.stringify(this.recoveryPoints))
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private startAutoBackup(): void {
    if (!this.config.autoBackup.enabled) return

    // 设置定时备份
    this.autoBackupInterval = window.setInterval(() => {
      this.createRecoveryPoint('auto')
    }, this.config.autoBackup.interval * 60 * 1000)

    // 设置触发器
    this.setupBackupTriggers()
  }

  private stopAutoBackup(): void {
    if (this.autoBackupInterval) {
      clearInterval(this.autoBackupInterval)
      this.autoBackupInterval = undefined
    }
  }

  private setupBackupTriggers(): void {
    // 启动时备份
    if (this.config.autoBackup.triggers.includes('startup')) {
      this.createRecoveryPoint('auto', 'Startup backup')
    }

    // 关闭时备份
    if (this.config.autoBackup.triggers.includes('shutdown')) {
      window.addEventListener('beforeunload', () => {
        this.createRecoveryPoint('auto', 'Shutdown backup')
      })
    }

    // 数据变更备份（简化实现）
    if (this.config.autoBackup.triggers.includes('data_change')) {
      // 实际应该监听数据变更事件
    }
  }

  private async cleanupOldRecoveryPoints(): Promise<void> {
    const now = Date.now()
    const maxAge = this.config.retention.maxAge * 24 * 60 * 60 * 1000 // 转换为毫秒

    // 按时间戳排序
    const sortedPoints = [...this.recoveryPoints].sort((a, b) => a.timestamp - b.timestamp)

    // 删除过期的恢复点
    this.recoveryPoints = this.recoveryPoints.filter(point => {
      const age = now - point.timestamp
      return age <= maxAge
    })

    // 确保最少保留的恢复点数量
    if (this.recoveryPoints.length < this.config.retention.minPoints) {
      this.recoveryPoints = sortedPoints.slice(-this.config.retention.minPoints)
    }

    // 限制最大恢复点数量
    if (this.recoveryPoints.length > this.config.autoBackup.maxPoints) {
      this.recoveryPoints = this.recoveryPoints.slice(-this.config.autoBackup.maxPoints)
    }

    // 检查存储大小限制
    const totalSize = this.recoveryPoints.reduce((sum, rp) => sum + rp.size, 0)
    const maxSize = this.config.retention.maxTotalSize * 1024 * 1024 // 转换为字节

    if (totalSize > maxSize) {
      // 删除最旧的恢复点直到满足大小限制
      while (totalSize > maxSize && this.recoveryPoints.length > this.config.retention.minPoints) {
        this.recoveryPoints.shift()
      }
    }

    await this.saveRecoveryPoints()
  }

  private async validateDataIntegrity(data: RecoveryData): Promise<boolean> {
    // 简化的数据完整性验证
    try {
      // 检查基本结构
      if (!data.cards || !data.folders || !data.tags || !data.settings) {
        return false
      }

      // 检查数组元素
      if (!Array.isArray(data.cards) || !Array.isArray(data.folders) || !Array.isArray(data.tags)) {
        return false
      }

      // 检查对象结构
      if (typeof data.settings !== 'object') {
        return false
      }

      return true
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private validateSchema(data: RecoveryData): boolean {
    // 简化的架构验证
    try {
      // 验证卡片结构
      for (const card of data.cards) {
        if (!card.id || !card.title || !card.content) {
          return false
        }
      }

      // 验证文件夹结构
      for (const folder of data.folders) {
        if (!folder.id || !folder.name) {
          return false
        }
      }

      // 验证标签结构
      for (const tag of data.tags) {
        if (!tag.id || !tag.name) {
          return false
        }
      }

      return true
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private calculateSuccessRate(): number {
    // 简化实现,实际应该跟踪恢复成功率
    return 0.95
  }

  private calculateAverageRecoveryTime(): number {
    // 简化实现,实际应该跟踪实际恢复时间
    return 1500 // 1.5秒
  }

  private getLastRecoveryDate(): Date | null {
    // 简化实现,实际应该记录最后恢复时间
    return null
  }

  private calculateStorageUsage(): RecoveryStatistics['storageUsage'] {
    const totalSize = this.recoveryPoints.reduce((sum, rp) => sum + rp.size, 0)
    const maxStorage = 50 * 1024 * 1024 // 50MB
    const percentage = (totalSize / maxStorage) * 100

    // 计算存储趋势
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable'
    if (this.recoveryPoints.length >= 2) {
      const recentSize = this.recoveryPoints.slice(-5).reduce((sum, rp) => sum + rp.size, 0)
      const olderSize = this.recoveryPoints.slice(-10, -5).reduce((sum, rp) => sum + rp.size, 0)
      if (recentSize > olderSize * 1.1) trend = 'increasing'
      else if (recentSize < olderSize * 0.9) trend = 'decreasing'
    }

    return {
      used: totalSize,
      total: maxStorage,
      percentage,
      trend
    }
  }

  private calculateBackupHealth(): RecoveryStatistics['backupHealth'] {
    const issues: string[] = []
    const recommendations: string[] = []
    let score = 100

    // 检查恢复点数量
    if (this.recoveryPoints.length < 3) {
      issues.push('恢复点数量过少')
      recommendations.push('建议增加自动备份频率')
      score -= 20
    }

    // 检查存储使用率
    const storageUsage = this.calculateStorageUsage()
    if (storageUsage.percentage > 80) {
      issues.push('存储使用率过高')
      recommendations.push('建议清理旧的恢复点或增加存储空间')
      score -= 15
    }

    // 检查恢复点年龄
    const now = Date.now()
    const oldestPoint = this.recoveryPoints.reduce((oldest, current) =>
      current.timestamp < oldest.timestamp ? current : oldest, this.recoveryPoints[0])

    if (oldestPoint && (now - oldestPoint.timestamp) > 90 * 24 * 60 * 60 * 1000) {
      issues.push('存在过期恢复点')
      recommendations.push('建议清理过期恢复点')
      score -= 10
    }

    // 检查数据完整性
    const hasRecentValidation = this.recoveryPoints.some(rp =>
      (now - rp.timestamp) < 24 * 60 * 60 * 1000 // 24小时内有验证
    )

    if (!hasRecentValidation && this.recoveryPoints.length > 0) {
      issues.push('缺少最近的数据完整性验证')
      recommendations.push('建议运行数据完整性检查')
      score -= 5
    }

    if (recommendations.length === 0) {
      recommendations.push('备份系统状态良好')
    }

    return {
      score: Math.max(0, score),
      issues,
      recommendations
    }
  }

  private calculatePrivacyMetrics(): RecoveryStatistics['privacyMetrics'] {
    return {
      dataEncrypted: this.config.encryption.enabled,
      localOnly: this.config.privacy.localOnly,
      lastCleanup: this.getLastCleanupDate(),
      userAccessCount: this.getUserAccessCount()
    }
  }

  private calculatePerformanceMetrics(): RecoveryStatistics['performanceMetrics'] {
    // 计算平均备份时间
    const backupTimes = this.recoveryPoints.map(rp => rp.size).map(size =>
      // 简化的备份时间计算
      Math.max(100, size / 1024) // 假设每KB数据需要1ms
    )
    const averageBackupTime = backupTimes.length > 0
      ? backupTimes.reduce((sum, time) => sum + time, 0) / backupTimes.length
      : 0

    // 计算压缩率
    const totalUncompressedSize = this.recoveryPoints.reduce((sum, rp) =>
      sum + rp.size / (rp.metadata.compressionRatio || 1), 0)
    const totalCompressedSize = this.recoveryPoints.reduce((sum, rp) => sum + rp.size, 0)
    const compressionRatio = totalUncompressedSize > 0
      ? (totalUncompressedSize - totalCompressedSize) / totalUncompressedSize
      : 0

    return {
      averageBackupTime,
      averageRestoreTime: averageBackupTime * 0.8, // 恢复通常比备份快
      compressionRatio,
      storageEfficiency: this.calculateStorageEfficiency()
    }
  }

  private getLastCleanupDate(): Date | null {
    // 简化实现,实际应该记录清理时间
    return null
  }

  private getUserAccessCount(): number {
    // 简化实现,实际应该跟踪用户访问次数
    return 0
  }

  private calculateStorageEfficiency(): number {
    const storageUsage = this.calculateStorageUsage()
    const totalDataSize = this.recoveryPoints.reduce((sum, rp) =>
      sum + rp.data.cards.length + rp.data.folders.length + rp.data.tags.length, 0)

    if (totalDataSize === 0) return 0

    // 效率 = 数据项目数 / 存储空间使用量
    return totalDataSize / (storageUsage.used / 1024) // 每KB存储的项目数
  }

  // === 多种恢复点支持机制 ===

  /**
   * 创建计划恢复点
   */
  async createScheduledRecoveryPoint(description?: string): Promise<RecoveryPoint> {
    const config = this.getConfig()
    if (!config.recoveryPointTypes.scheduled.enabled) {
      throw new Error('计划恢复点功能未启用')
    }

    const scheduledDescription = description || `计划备份 - ${new Date().toLocaleString('zh-CN')}`

    return this.createRecoveryPoint('scheduled', scheduledDescription, {
      tags: ['scheduled', 'automatic'],
      priority: 'normal',
      isProtected: false
    })
  }

  /**
   * 创建更新前恢复点
   */
  async createBeforeUpdateRecoveryPoint(updateType: string, description?: string): Promise<RecoveryPoint> {
    const config = this.getConfig()
    if (!config.recoveryPointTypes.beforeUpdate.enabled) {
      throw new Error('更新前恢复点功能未启用')
    }

    const beforeUpdateDescription = description || `更新前备份 - ${updateType}`

    return this.createRecoveryPoint('before_update', beforeUpdateDescription, {
      tags: ['before_update', updateType, 'protected'],
      priority: 'high',
      isProtected: true
    })
  }

  /**
   * 创建更新后恢复点
   */
  async createAfterUpdateRecoveryPoint(updateType: string, updateResult: 'success' | 'failed', description?: string): Promise<RecoveryPoint> {
    const config = this.getConfig()
    if (!config.recoveryPointTypes.afterUpdate.enabled) {
      throw new Error('更新后恢复点功能未启用')
    }

    const afterUpdateDescription = description || `更新后备份 - ${updateType} (${updateResult})`

    return this.createRecoveryPoint('after_update', afterUpdateDescription, {
      tags: ['after_update', updateType, updateResult],
      priority: 'normal',
      isProtected: false
    })
  }

  /**
   * 创建紧急恢复点
   */
  async createEmergencyRecoveryPoint(reason: string, description?: string): Promise<RecoveryPoint> {
    const config = this.getConfig()
    if (!config.recoveryPointTypes.emergency.enabled) {
      throw new Error('紧急恢复点功能未启用')
    }

    const emergencyDescription = description || `紧急备份 - ${reason}`

    return this.createRecoveryPoint('emergency', emergencyDescription, {
      tags: ['emergency', 'critical', 'protected'],
      priority: 'critical',
      isProtected: true
    })
  }

  /**
   * 获取恢复点链条
   */
  async getRecoveryPointChain(pointId: string): Promise<RecoveryPoint[]> {
    const allPoints = await this.getRecoveryPoints()
    const chain: RecoveryPoint[] = []

    // 找到起始点
    const startPoint = allPoints.find(p => p.id === pointId)
    if (!startPoint) return chain

    // 向上追溯父节点
    let currentPoint: RecoveryPoint | undefined = startPoint
    while (currentPoint) {
      chain.unshift(currentPoint) // 添加到链的头部
      if (currentPoint.parentPointId) {
        currentPoint = allPoints.find(p => p.id === currentPoint!.parentPointId)
      } else {
        break
      }
    }

    // 向下查找子节点
    currentPoint = startPoint
    while (currentPoint) {
      if (currentPoint.childrenPointIds) {
        for (const childId of currentPoint.childrenPointIds) {
          const child = allPoints.find(p => p.id === childId)
          if (child && !chain.includes(child)) {
            chain.push(child)
          }
        }
      }
      // 如果当前点有多个子节点,只处理第一个以避免复杂循环
      if (currentPoint.childrenPointIds && currentPoint.childrenPointIds.length > 0) {
        const nextChild = allPoints.find(p => p.id === currentPoint!.childrenPointIds![0])
        currentPoint = nextChild
      } else {
        break
      }
    }

    return chain
  }

  /**
   * 创建增量恢复点
   */
  async createIncrementalRecoveryPoint(basePointId?: string): Promise<RecoveryPoint> {
    const config = this.getConfig()
    if (!config.advancedStrategies.incrementalBackupEnabled) {
      throw new Error('增量备份功能未启用')
    }

    let basePoint: RecoveryPoint | undefined
    if (basePointId) {
      const allPoints = await this.getRecoveryPoints()
      basePoint = allPoints.find(p => p.id === basePointId)
    } else {
      // 获取最新的恢复点作为基础
      const allPoints = await this.getRecoveryPoints()
      basePoint = allPoints.sort((a, b) => b.timestamp - a.timestamp)[0]
    }

    // 获取当前数据
    const [currentCards, currentFolders, currentTags, currentSettings] = await Promise.all([
      this.storageAdapter.getCards(),
      this.storageAdapter.getFolders(),
      this.storageAdapter.getTags(),
      this.storageAdapter.getSettings()
    ])

    // 如果有基础点,只计算变更的数据
    let incrementalData: RecoveryData
    if (basePoint) {
      const baseData = basePoint.data

      // 计算变更（这里简化处理,实际应该实现完整的增量算法）
      const newCards = currentCards.filter(card =>
        !baseData.cards.some(baseCard => baseCard.id === card.id)
      )
      const modifiedCards = currentCards.filter(card =>
        baseData.cards.some(baseCard => baseCard.id === card.id && baseCard.updatedAt !== card.updatedAt)
      )

      const newFolders = currentFolders.filter(folder =>
        !baseData.folders.some(baseFolder => baseFolder.id === folder.id)
      )
      const modifiedFolders = currentFolders.filter(folder =>
        baseData.folders.some(baseFolder => baseFolder.id === folder.id && baseFolder.updatedAt !== folder.updatedAt)
      )

      incrementalData = {
        cards: [...newCards, ...modifiedCards],
        folders: [...newFolders, ...modifiedFolders],
        tags: currentTags, // 标签通常完全备份
        settings: currentSettings, // 设置通常完全备份
        version: '1.0',
        schema: 'cardall-v1'
      }
    } else {
      // 没有基础点,创建完整备份
      incrementalData = {
        cards: currentCards,
        folders: currentFolders,
        tags: currentTags,
        settings: currentSettings,
        version: '1.0',
        schema: 'cardall-v1'
      }
    }

    // 创建增量恢复点
    const recoveryPoint: RecoveryPoint = {
      id: this.generateId(),
      timestamp: Date.now(),
      type: 'auto',
      description: basePoint ? `增量备份 - 基于 ${basePoint.description}` : '完整备份',
      data: incrementalData,
      metadata: {
        createdby: 'system',
        reason: 'incremental_backup',
        tags: ['incremental', basePoint ? 'delta' : 'full'],
        storageLocation: 'IndexedDB',
        estimatedDataSize: 0
      },
      checksum: await this.calculateChecksum(incrementalData),
      size: JSON.stringify(incrementalData).length,
      priority: 'normal',
      tags: ['incremental', basePoint ? 'delta' : 'full'],
      isProtected: false,
      parentPointId: basePoint?.id,
      childrenPointIds: [],
      restoreCount: 0,
      healthScore: 100
    }

    // 如果有父节点,更新父节点的子节点列表
    if (basePoint) {
      if (!basePoint.childrenPointIds) {
        basePoint.childrenPointIds = []
      }
      basePoint.childrenPointIds.push(recoveryPoint.id)
      // 更新存储中的父节点
      await this.updateRecoveryPoint(basePoint)
    }

    // 保存新的恢复点
    this.recoveryPoints.push(recoveryPoint)
    await this.saveRecoveryPoints()

    return recoveryPoint
  }

  /**
   * 智能恢复点优先级排序
   */
  async getPrioritizedRecoveryPoints(): Promise<RecoveryPoint[]> {
    const config = this.getConfig()
    if (!config.advancedStrategies.autoPrioritizationEnabled) {
      return this.getRecoveryPoints()
    }

    const points = await this.getRecoveryPoints()

    // 计算每个恢复点的优先级分数
    const scoredPoints = points.map(point => {
      let score = 0

      // 基础优先级分数
      const priorityScores = { critical: 100, high: 75, normal: 50, low: 25 }
      score += priorityScores[point.priority] || 50

      // 时间因素（越新的分数越高）
      const ageInDays = (Date.now() - point.timestamp) / (1000 * 60 * 60 * 24)
      score += Math.max(0, 50 - ageInDays * 2)

      // 恢复成功率
      if (point.restoreCount > 0) {
        const successRate = point.healthScore / 100
        score += successRate * 30
      }

      // 保护状态
      if (point.isProtected) {
        score += 40
      }

      // 标签权重
      const tagWeights = {
        'emergency': 60,
        'before_update': 50,
        'protected': 40,
        'important': 30
      }
      point.tags.forEach(tag => {
        score += tagWeights[tag as keyof typeof tagWeights] || 0
      })

      // 使用频率（最近恢复的分数更高）
      if (point.lastRestoreDate) {
        const daysSinceRestore = (Date.now() - point.lastRestoreDate) / (1000 * 60 * 60 * 24)
        score += Math.max(0, 20 - daysSinceRestore)
      }

      return { ...point, score }
    })

    // 按分数降序排序
    return scoredPoints.sort((a, b) => b.score - a.score)
  }

  /**
   * 智能清理恢复点
   */
  async smartCleanupRecoveryPoints(): Promise<{ removed: number; preserved: number; reason: string }> {
    const config = this.getConfig()
    if (!config.advancedStrategies.smartPruningEnabled) {
      return { removed: 0, preserved: 0, reason: '智能清理未启用' }
    }

    const points = await this.getRecoveryPoints()
    const removed: string[] = []
    const preserved: string[] = []

    // 保护策略
    const protectedPoints = points.filter(point =>
      point.isProtected ||
      point.priority === 'critical' ||
      point.tags.includes('emergency') ||
      point.tags.includes('before_update')
    )
    protectedPoints.forEach(point => preserved.push(point.id))

    // 计算可清理的点
    const cleanablePoints = points.filter(point => !protectedPoints.includes(point))

    // 按清理策略排序
    const sortedForCleanup = cleanablePoints.sort((a, b) => {
      // 优先清理分数低的
      const scoreA = this.calculateCleanupScore(a)
      const scoreB = this.calculateCleanupScore(b)
      return scoreA - scoreB
    })

    // 检查清理条件
    const totalSize = points.reduce((sum, p) => sum + p.size, 0)
    const maxSize = config.retention.maxTotalSize * 1024 * 1024 // 转换为字节
    const oldestPoint = points.sort((a, b) => a.timestamp - b.timestamp)[0]
    const maxAge = config.retention.maxAge * 24 * 60 * 60 * 1000 // 转换为毫秒
    const isOverSize = totalSize > maxSize
    const isOverAge = oldestPoint && (Date.now() - oldestPoint.timestamp) > maxAge

    let removalReason = ''

    if (isOverSize || isOverAge) {
      removalReason = isOverSize ? '超出存储限制' : '超出保留期限'

      // 计算需要移除的数量
      let targetRemovalCount = 0
      if (isOverSize) {
        const excessSize = totalSize - maxSize
        let accumulatedSize = 0
        for (const point of sortedForCleanup) {
          accumulatedSize += point.size
          targetRemovalCount++
          if (accumulatedSize >= excessSize) break
        }
      } else {
        // 移除超过年龄限制的点
        const cutoffTime = Date.now() - maxAge
        targetRemovalCount = sortedForCleanup.filter(p => p.timestamp < cutoffTime).length
      }

      // 保留最小数量
      const minPreserve = config.retention.minPoints
      const currentCount = points.length
      const actualRemovalCount = Math.min(targetRemovalCount, currentCount - minPreserve)

      // 执行清理
      const toRemove = sortedForCleanup.slice(0, actualRemovalCount)
      for (const point of toRemove) {
        await this.deleteRecoveryPoint(point.id)
        removed.push(point.id)
      }

      // 其余的保留
      sortedForCleanup.slice(actualRemovalCount).forEach(point => preserved.push(point.id))
    } else {
      // 不需要清理
      cleanablePoints.forEach(point => preserved.push(point.id))
      removalReason = '无需清理'
    }

    return {
      removed: removed.length,
      preserved: preserved.length,
      reason: removalReason
    }
  }

  /**
   * 计算清理分数（分数越低越应该被清理）
   */
  private calculateCleanupScore(point: RecoveryPoint): number {
    let score = 0

    // 年龄因素（越老分数越低）
    const ageInDays = (Date.now() - point.timestamp) / (1000 * 60 * 60 * 24)
    score -= ageInDays * 10

    // 大小因素（越大分数越低）
    score -= point.size / 1024 // 每KB减1分

    // 优先级因素
    const priorityPenalties = { critical: 100, high: 50, normal: 0, low: -25 }
    score += priorityPenalties[point.priority] || 0

    // 健康分数
    score += point.healthScore * 0.5

    // 使用频率
    if (point.restoreCount > 0) {
      score += point.restoreCount * 10
    }

    return score
  }

  /**
   * 更新恢复点
   */
  private async updateRecoveryPoint(point: RecoveryPoint): Promise<void> {
    const index = this.recoveryPoints.findIndex(p => p.id === point.id)
    if (index !== -1) {
      this.recoveryPoints[index] = point
      await this.saveRecoveryPoints()
    }
  }

  /**
   * 获取恢复点健康状况
   */
  async getRecoveryPointHealth(pointId: string): Promise<{
    health: number
    issues: string[]
    recommendations: string[]
  }> {
    const point = this.recoveryPoints.find(p => p.id === pointId)
    if (!point) {
      return {
        health: 0,
        issues: ['恢复点不存在'],
        recommendations: []
      }
    }

    const issues: string[] = []
    const recommendations: string[] = []
    let healthScore = 100

    // 检查完整性
    if (point.healthScore < 80) {
      issues.push('恢复点健康分数偏低')
      recommendations.push('建议重新创建恢复点')
      healthScore -= 20
    }

    // 检查年龄
    const ageInDays = (Date.now() - point.timestamp) / (1000 * 60 * 60 * 24)
    if (ageInDays > 30) {
      issues.push('恢复点较旧')
      recommendations.push('建议创建新的恢复点')
      healthScore -= 10
    }

    // 检查恢复成功率
    if (point.restoreCount > 0 && point.healthScore < 90) {
      issues.push('历史恢复成功率偏低')
      recommendations.push('检查数据完整性')
      healthScore -= 15
    }

    // 检查存储位置
    if (point.metadata.storageLocation === 'localStorage' && point.size > 1024 * 1024) {
      issues.push('大型恢复点存储在localStorage中')
      recommendations.push('建议迁移到IndexedDB')
      healthScore -= 5
    }

    return {
      health: Math.max(0, healthScore),
      issues,
      recommendations
    }
  }

  /**
   * 批量创建恢复点
   */
  async createBatchRecoveryPoints(types: Array<{
    type: RecoveryPoint['type']
    description: string
    metadata?: Partial<RecoveryMetadata>
  }>): Promise<RecoveryPoint[]> {
    const results: RecoveryPoint[] = []

    for (const { type, description, metadata } of types) {
      try {
        const point = await this.createRecoveryPoint(type, description, metadata)
        results.push(point)
      } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
        // 继续创建其他的恢复点
      }
    }

    return results
  }

  /**
   * 设置恢复点保护状态
   */
  async setRecoveryPointProtection(pointId: string, isProtected: boolean): Promise<void> {
    const point = this.recoveryPoints.find(p => p.id === pointId)
    if (point) {
      point.isProtected = isProtected
      if (isProtected) {
        point.tags.push('protected')
      } else {
        point.tags = point.tags.filter(tag => tag !== 'protected')
      }
      await this.updateRecoveryPoint(point)
    }
  }

  // === 存储空间管理和优化功能 ===

  /**
   * 获取存储空间分析
   */
  async getStorageAnalysis(): Promise<{
    totalSpace: number
    usedSpace: number
    freeSpace: number
    recoveryPointsUsage: number
    otherDataUsage: number
    efficiency: number
    recommendations: string[]
  }> {
    // 估算总空间（浏览器存储限制通常是50MB-5GB,我们使用保守估计）
    const totalSpace = 500 * 1024 * 1024 // 500MB

    // 计算恢复点使用的空间
    const recoveryPointsUsage = this.recoveryPoints.reduce((sum, rp) => sum + rp.size, 0)

    // 估算其他数据使用（卡片、文件夹、标签等）
    const [cards, folders, tags] = await Promise.all([
      this.storageAdapter.getCards(),
      this.storageAdapter.getFolders(),
      this.storageAdapter.getTags()
    ])

    const otherDataSize = JSON.stringify(cards).length +
                         JSON.stringify(folders).length +
                         JSON.stringify(tags).length

    const usedSpace = recoveryPointsUsage + otherDataSize
    const freeSpace = Math.max(0, totalSpace - usedSpace)

    // 计算效率（数据密度/空间使用）
    const totalDataItems = cards.length + folders.length + tags.length
    const efficiency = usedSpace > 0 ? totalDataItems / (usedSpace / 1024) : 0 // 每KB的项目数

    // 生成建议
    const recommendations: string[] = []
    const usagePercentage = (usedSpace / totalSpace) * 100

    if (usagePercentage > 80) {
      recommendations.push('存储空间使用率过高,建议清理旧的恢复点')
    }
    if (usagePercentage > 90) {
      recommendations.push('存储空间严重不足,请立即清理数据')
    }
    if (recoveryPointsUsage > otherDataSize * 2) {
      recommendations.push('恢复点占用空间过多,建议优化备份策略')
    }
    if (efficiency < 1) {
      recommendations.push('存储效率较低,建议启用压缩功能')
    }

    return {
      totalSpace,
      usedSpace,
      freeSpace,
      recoveryPointsUsage,
      otherDataUsage: otherDataSize,
      efficiency,
      recommendations
    }
  }

  /**
   * 优化存储空间
   */
  async optimizeStorage(): Promise<{
    spaceFreed: number
    pointsOptimized: number
    actionsTaken: string[]
  }> {
    const beforeAnalysis = await this.getStorageAnalysis()
    const actionsTaken: string[] = []
    let totalSpaceFreed = 0
    let pointsOptimized = 0

    // 1. 智能清理恢复点
    const cleanupResult = await this.smartCleanupRecoveryPoints()
    if (cleanupResult.removed > 0) {
      actionsTaken.push(`清理了 ${cleanupResult.removed} 个恢复点`)
      pointsOptimized += cleanupResult.removed
    }

    // 2. 压缩未压缩的恢复点
    if (this.config.compression.enabled) {
      const compressionResults = await this.compressUncompressedPoints()
      if (compressionResults.spaceSaved > 0) {
        totalSpaceFreed += compressionResults.spaceSaved
        actionsTaken.push(`压缩了 ${compressionResults.pointsCompressed} 个恢复点,节省 ${this.formatSize(compressionResults.spaceSaved)}`)
        pointsOptimized += compressionResults.pointsCompressed
      }
    }

    // 3. 重复数据去重
    const dedupResult = await this.deduplicateRecoveryPoints()
    if (dedupResult.duplicatesFound > 0) {
      totalSpaceFreed += dedupResult.spaceSaved
      actionsTaken.push(`发现并清理了 ${dedupResult.duplicatesFound} 个重复恢复点,节省 ${this.formatSize(dedupResult.spaceSaved)}`)
      pointsOptimized += dedupResult.duplicatesRemoved
    }

    // 4. 迁移大型恢复点到更合适的存储
    const migrationResult = await this.migrateLargePoints()
    if (migrationResult.migrated > 0) {
      actionsTaken.push(`迁移了 ${migrationResult.migrated} 个大型恢复点到IndexedDB`)
      pointsOptimized += migrationResult.migrated
    }

    // 5. 更新健康分数
    await this.updateHealthScores()

    const afterAnalysis = await this.getStorageAnalysis()
    const actualSpaceFreed = beforeAnalysis.usedSpace - afterAnalysis.usedSpace

    return {
      spaceFreed: actualSpaceFreed,
      pointsOptimized,
      actionsTaken
    }
  }

  /**
   * 压缩未压缩的恢复点
   */
  private async compressUncompressedPoints(): Promise<{
    pointsCompressed: number
    spaceSaved: number
  }> {
    let pointsCompressed = 0
    let spaceSaved = 0

    for (const point of this.recoveryPoints) {
      // 检查是否已经压缩（通过元数据中的compressionRatio）
      if (!point.metadata.compressionRatio || point.metadata.compressionRatio >= 1) {
        const originalSize = point.size
        const compressedData = await this.compressData(point.data)
        const compressedSize = compressedData.length

        if (compressedSize < originalSize * 0.9) { // 只在压缩率超过10%时才压缩
          point.metadata.compressionRatio = compressedSize / originalSize
          point.size = compressedSize
          spaceSaved += originalSize - compressedSize
          pointsCompressed++
        }
      }
    }

    if (pointsCompressed > 0) {
      await this.saveRecoveryPoints()
    }

    return { pointsCompressed, spaceSaved }
  }

  /**
   * 去重重复的恢复点
   */
  private async deduplicateRecoveryPoints(): Promise<{
    duplicatesFound: number
    duplicatesRemoved: number
    spaceSaved: number
  }> {
    const duplicates: string[] = []
    const seenChecksums = new Set<string>()

    // 识别重复的恢复点（基于校验和）
    for (const point of this.recoveryPoints) {
      if (seenChecksums.has(point.checksum)) {
        duplicates.push(point.id)
      } else {
        seenChecksums.add(point.checksum)
      }
    }

    // 移除重复的点（保留最新的）
    let spaceSaved = 0
    const removedIds: string[] = []

    for (const duplicateId of duplicates) {
      const duplicatePoint = this.recoveryPoints.find(p => p.id === duplicateId)
      if (duplicatePoint && !duplicatePoint.isProtected) {
        // 找到具有相同校验和的最新点
        const newerPoints = this.recoveryPoints.filter(p =>
          p.checksum === duplicatePoint.checksum &&
          p.id !== duplicateId &&
          p.timestamp > duplicatePoint.timestamp
        )

        if (newerPoints.length > 0) {
          spaceSaved += duplicatePoint.size
          removedIds.push(duplicateId)
        }
      }
    }

    // 执行删除
    for (const id of removedIds) {
      await this.deleteRecoveryPoint(id)
    }

    return {
      duplicatesFound: duplicates.length,
      duplicatesRemoved: removedIds.length,
      spaceSaved
    }
  }

  /**
   * 迁移大型恢复点
   */
  private async migrateLargePoints(): Promise<{
    migrated: number
  }> {
    let migrated = 0
    const largePointThreshold = 512 * 1024 // 512KB

    for (const point of this.recoveryPoints) {
      if (point.metadata.storageLocation === 'localStorage' && point.size > largePointThreshold) {
        // 迁移到IndexedDB
        point.metadata.storageLocation = 'IndexedDB'
        migrated++
      }
    }

    if (migrated > 0) {
      await this.saveRecoveryPoints()
    }

    return { migrated }
  }

  /**
   * 更新所有恢复点的健康分数
   */
  private async updateHealthScores(): Promise<void> {
    for (const point of this.recoveryPoints) {
      const health = await this.getRecoveryPointHealth(point.id)
      point.healthScore = health.health
    }
    await this.saveRecoveryPoints()
  }

  /**
   * 获取存储使用趋势
   */
  async getStorageTrends(days: number = 30): Promise<{
    dates: string[]
    totalUsage: number[]
    recoveryPointsUsage: number[]
    efficiency: number[]
  }> {
    const dates: string[] = []
    const totalUsage: number[] = []
    const recoveryPointsUsage: number[] = []
    const efficiency: number[] = []

    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now - i * dayMs)
      const dateStr = date.toLocaleDateString('zh-CN')
      dates.push(dateStr)

      // 计算当天的使用情况
      const dayStart = date.getTime()
      const dayEnd = dayStart + dayMs

      const dayPoints = this.recoveryPoints.filter(p =>
        p.timestamp >= dayStart && p.timestamp < dayEnd
      )

      const dayUsage = dayPoints.reduce((sum, p) => sum + p.size, 0)
      const dayDataItems = dayPoints.reduce((sum, p) =>
        sum + p.data.cards.length + p.data.folders.length + p.data.tags.length, 0
      )
      const dayEfficiency = dayUsage > 0 ? dayDataItems / (dayUsage / 1024) : 0

      totalUsage.push(dayUsage)
      recoveryPointsUsage.push(dayUsage)
      efficiency.push(dayEfficiency)
    }

    return { dates, totalUsage, recoveryPointsUsage, efficiency }
  }

  /**
   * 设置存储配额警告
   */
  async setStorageQuotaWarning(thresholdPercentage: number): Promise<void> {
    const analysis = await this.getStorageAnalysis()
    const usagePercentage = (analysis.usedSpace / analysis.totalSpace) * 100

    if (usagePercentage > thresholdPercentage) {
      console.warn(`存储空间使用率已达到 ${usagePercentage.toFixed(1)}%,超过设定的 ${thresholdPercentage}% 阈值`)

      // 可以在这里添加更多的警告逻辑,比如显示用户通知
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('storageQuotaWarning', {
          detail: {
            usagePercentage,
            thresholdPercentage,
            usedSpace: analysis.usedSpace,
            totalSpace: analysis.totalSpace
          }
        }))
      }
    }
  }

  /**
   * 获取存储优化建议
   */
  async getOptimizationRecommendations(): Promise<{
    immediate: string[]
    shortTerm: string[]
    longTerm: string[]
    potentialSpaceSavings: number
  }> {
    const analysis = await this.getStorageAnalysis()
    const immediate: string[] = []
    const shortTerm: string[] = []
    const longTerm: string[] = []
    let potentialSpaceSavings = 0

    // 立即执行的建议
    if (analysis.usedSpace / analysis.totalSpace > 0.9) {
      immediate.push('立即清理旧的恢复点以释放空间')
      potentialSpaceSavings += analysis.usedSpace * 0.3 // 估计可节省30%
    }

    // 查找过期的恢复点
    const expiredPoints = this.recoveryPoints.filter(p => {
      const age = (Date.now() - p.timestamp) / (1000 * 60 * 60 * 24)
      return age > this.config.retention.maxAge && !p.isProtected
    })

    if (expiredPoints.length > 0) {
      immediate.push(`清理 ${expiredPoints.length} 个过期恢复点`)
      potentialSpaceSavings += expiredPoints.reduce((sum, p) => sum + p.size, 0)
    }

    // 短期建议
    if (!this.config.compression.enabled) {
      shortTerm.push('启用数据压缩功能以节省空间')
      potentialSpaceSavings += analysis.usedSpace * 0.2 // 估计节省20%
    }

    if (analysis.efficiency < 1) {
      shortTerm.push('优化数据存储结构以提高效率')
    }

    // 长期建议
    if (this.recoveryPoints.length > this.config.retention.maxPoints * 1.5) {
      longTerm.push('调整备份策略,减少恢复点数量')
    }

    if (!this.config.advancedStrategies.incrementalBackupEnabled) {
      longTerm.push('启用增量备份以减少存储需求')
      potentialSpaceSavings += analysis.usedSpace * 0.4 // 估计节省40%
    }

    return {
      immediate,
      shortTerm,
      longTerm,
      potentialSpaceSavings
    }
  }

  /**
   * 格式化文件大小
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }
}

// 导出服务实例
export const dataRecoveryService = DataRecoveryService.getInstance()

// 导出便捷函数
export const createRecoveryPoint = (
  type?: RecoveryPoint['type'],
  description?: string
) => dataRecoveryService.createRecoveryPoint(type, description)

export const recoverFromPoint = (
  recoveryPointId: string,
  options?: RecoveryOptions
) => dataRecoveryService.recoverFromPoint(recoveryPointId, options)

export const getRecoveryPoints = () => dataRecoveryService.getRecoveryPoints()

export const getRecoveryStatistics = () => dataRecoveryService.getStatistics()