import { db, type DbCard, type DbFolder, type DbTag, type DbImage, type { id: string; type: string; data: any }, type AppSettings, type UserSession } from '@/services/database'
import { syncStrategyService } from '@/services/sync-strategy'
import { syncPerformanceOptimizer } from '@/services/sync-performance'
import { networkMonitorService } from '@/services/network-monitor'

// ============================================================================
// 增强持久化管理器 - Phase 3 核心实现
// ============================================================================

// 持久化状态类型
export   // 同步状态
  syncState: {
    lastSyncTime?: Date
    syncVersion: number
    pendingOperations: number
    conflictCount: number
    syncEnabled: boolean
    autoSync: boolean
  }

  // 用户会话状态
  userSession: {
    userId?: string
    deviceId: string
    sessionToken?: string
    isAuthenticated: boolean
    expiresAt?: Date
  }

  // 性能状态
  performanceState: {
    totalOperations: number
    successfulOperations: number
    failedOperations: number
    averageResponseTime: number
    lastOptimizationTime?: Date
  }

  // 系统状态
  systemState: {
    databaseVersion: string
    lastMaintenanceTime?: Date
    healthCheckStatus: 'healthy' | 'warning' | 'error'
    errorCount: number
    lastErrorTime?: Date
  }

  // 元数据
  metadata: {
    createdAt: Date
    updatedAt: Date
    version: string
    checksum: string
  }
}

// 数据一致性检查结果
export // 状态恢复选项
export // 数据备份选项
export // 性能优化选项
export // ============================================================================
// 增强持久化管理器主类
// ============================================================================

export class EnhancedPersistenceManager {
  private static instance: EnhancedPersistenceManager
  private isInitialized = false
  private isRestoring = false
  private currentOperation: string | null = null

  // 状态管理
  private currentState: PersistenceState | null = null
  private stateVersion = 1

  // 一致性检查缓存
  private consistencyCache = new Map<string, ConsistencyCheckResult>()
  private lastConsistencyCheck: Date | null = null

  // 性能监控
  private operationMetrics = new Map<string, {
    count: number
    totalTime: number
    averageTime: number
    lastExecution: Date
  }>()

  // 事件监听器
  private listeners: {
    stateRestored?: (state: PersistenceState) => void
    consistencyChecked?: (results: ConsistencyCheckResult[]) => void
    backupCreated?: (backupId: string) => void
    optimizationCompleted?: (results: any) => void
    errorOccurred?: (error: Error, context: string) => void
  } = {}

  private constructor() {}

  public static getInstance(): EnhancedPersistenceManager {
    if (!EnhancedPersistenceManager.instance) {
      EnhancedPersistenceManager.instance = new EnhancedPersistenceManager()
    }
    return EnhancedPersistenceManager.instance
  }

  // ============================================================================
  // 初始化方法
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      console.log('Initializing EnhancedPersistenceManager...')

      // 初始化数据库连接
      await db.open()

      // 加载持久化状态
      await this.loadPersistedState()

      // 验证数据完整性
      await this.performInitialConsistencyCheck()

      // 设置事件监听器
      this.setupEventListeners()

      // 启动定期维护任务
      this.startMaintenanceTasks()

      this.isInitialized = true
      console.log('EnhancedPersistenceManager initialized successfully')

    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // ============================================================================
  // 状态持久化方法
  // ============================================================================

  /**
   * 保存当前应用状态
   */
  async persistState(state: Partial<PersistenceState>): Promise<void> {
    this.currentOperation = 'persistState'

    try {
      // 合并状态
      this.currentState = this.mergeState(this.currentState || this.getDefaultState(), state)

      // 更新元数据
      this.currentState.metadata.updatedAt = new Date()
      this.currentState.metadata.checksum = this.generateStateChecksum(this.currentState)

      // 保存到IndexedDB
      await this.saveStateToDatabase(this.currentState)

      // 触发状态保存事件
      await this.notifyStateSaved(this.currentState)

      console.log('State persisted successfully')

    } catch (error) {
          console.warn("操作失败:", error)
        } finally {
      this.currentOperation = null
    }
  }

  /**
   * 恢复应用状态
   */
  async restoreState(options: StateRecoveryOptions = {
    scope: 'full',
    validateData: true,
    fixInconsistencies: true,
    rollbackOnError: true,
    createBackup: true,
    timeout: 30000
  }): Promise<PersistenceState> {
    if (this.isRestoring) {
      throw new Error('State restoration already in progress')
    }

    this.isRestoring = true
    this.currentOperation = 'restoreState'

    try {
      console.log('Starting state restoration with options:', options)

      // 创建备份（如果要求）
      if (options.createBackup) {
        await this.createBackup({
          type: 'full',
          includeCards: true,
          includeFolders: true,
          includeTags: true,
          includeImages: false,
          includeSettings: true,
          includeSyncQueue: true,
          compression: true,
          compressionLevel: 6,
          encryption: false,
          storageLocation: 'local'
        })
      }

      // 加载持久化状态
      const savedState = await this.loadStateFromDatabase()

      // 验证状态完整性
      if (options.validateData) {
        const validationResult = await this.validateState(savedState)
        if (!validationResult.isValid) {
          throw new Error(`State validation failed: ${validationResult.errors.join(', ')}`)
        }
      }

      // 执行数据一致性检查
      if (options.fixInconsistencies) {
        const consistencyResults = await this.performFullConsistencyCheck()
        const criticalIssues = consistencyResults.filter(r => r.severity === 'critical' && !r.resolved)

        if (criticalIssues.length > 0) {
          console.warn('Critical consistency issues found:', criticalIssues)
          // 尝试修复关键问题
          await this.fixConsistencyIssues(criticalIssues)
        }
      }

      // 恢复特定范围的状态
      const restoredState = this.restoreStateScope(savedState, options.scope)

      // 更新当前状态
      this.currentState = restoredState

      // 验证恢复后的状态
      await this.verifyStateRestoration(restoredState)

      // 触发状态恢复事件
      await this.notifyStateRestored(restoredState)

      console.log('State restored successfully')
      return restoredState

    } catch (error) {
          console.warn("操作失败:", error)
        }

      await this.notifyError(error as Error, 'restoreState')
      throw error
    } finally {
      this.isRestoring = false
      this.currentOperation = null
    }
  }

  /**
   * 清理持久化状态
   */
  async clearPersistedState(scope: 'full' | 'app-state' | 'sync-state' | 'user-session' | 'performance-state' = 'full'): Promise<void> {
    this.currentOperation = 'clearPersistedState'

    try {
      switch (scope) {
        case 'full':
          await this.clearFullState()
          break
        case 'app-state':
          await this.clearAppState()
          break
        case 'sync-state':
          await this.clearSyncState()
          break
        case 'user-session':
          await this.clearUserSession()
          break
        case 'performance-state':
          await this.clearPerformanceState()
          break
      }

      console.log(`Cleared persisted state: ${scope}`)

    } catch (error) {
          console.warn("操作失败:", error)
        } finally {
      this.currentOperation = null
    }
  }

  // ============================================================================
  // 数据一致性检查方法
  // ============================================================================

  /**
   * 执行完整的一致性检查
   */
  async performFullConsistencyCheck(): Promise<ConsistencyCheckResult[]> {
    this.currentOperation = 'performFullConsistencyCheck'

    try {
      console.log('Performing full consistency check...')

      const results: ConsistencyCheckResult[] = []

      // 实体数量一致性检查
      results.push(...await this.checkEntityCounts())

      // 引用完整性检查
      results.push(...await this.checkReferenceIntegrity())

      // 数据完整性检查
      results.push(...await this.checkDataIntegrity())

      // 同步一致性检查
      results.push(...await this.checkSyncConsistency())

      // 缓存结果
      for (const result of results) {
        this.consistencyCache.set(result.id, result)
      }

      this.lastConsistencyCheck = new Date()

      console.log(`Consistency check completed: ${results.length} checks performed`)

      // 触发一致性检查事件
      await this.notifyConsistencyChecked(results)

      return results

    } catch (error) {
          console.warn("操作失败:", error)
        } finally {
      this.currentOperation = null
    }
  }

  /**
   * 执行快速一致性检查
   */
  async performQuickConsistencyCheck(): Promise<ConsistencyCheckResult[]> {
    this.currentOperation = 'performQuickConsistencyCheck'

    try {
      // 只执行关键检查
      const quickChecks = [
        ...await this.checkEntityCounts(),
        ...await this.checkSyncConsistency()
      ]

      console.log(`Quick consistency check completed: ${quickChecks.length} checks performed`)
      return quickChecks

    } catch (error) {
          console.warn("操作失败:", error)
        } finally {
      this.currentOperation = null
    }
  }

  /**
   * 修复一致性问题
   */
  async fixConsistencyIssues(issues: ConsistencyCheckResult[]): Promise<number> {
    this.currentOperation = 'fixConsistencyIssues'

    try {
      let fixedCount = 0

      for (const issue of issues) {
        if (issue.resolved) continue

        const fixed = await this.fixConsistencyIssue(issue)
        if (fixed) {
          issue.resolved = true
          issue.resolvedAt = new Date()
          this.consistencyCache.set(issue.id, issue)
          fixedCount++
        }
      }

      console.log(`Fixed ${fixedCount} consistency issues`)
      return fixedCount

    } catch (error) {
          console.warn("操作失败:", error)
        } finally {
      this.currentOperation = null
    }
  }

  // ============================================================================
  // 数据备份和恢复方法
  // ============================================================================

  /**
   * 创建数据备份
   */
  async createBackup(options: BackupOptions): Promise<string> {
    this.currentOperation = 'createBackup'

    try {
      console.log('Creating backup with options:', options)

      const backupId = this.generateBackupId()
      const backupData = await this.collectBackupData(options)

      // 压缩数据（如果要求）
      let processedData = backupData
      if (options.compression) {
        processedData = await this.compressData(backupData, options.compressionLevel)
      }

      // 加密数据（如果要求）
      if (options.encryption) {
        processedData = await this.encryptData(processedData)
      }

      // 保存备份
      await this.saveBackup(backupId, processedData, options.storageLocation)

      // 记录备份信息
      await this.recordBackupMetadata(backupId, options, backupData)

      console.log(`Backup created successfully: ${backupId}`)

      // 触发备份创建事件
      await this.notifyBackupCreated(backupId)

      return backupId

    } catch (error) {
          console.warn("操作失败:", error)
        } finally {
      this.currentOperation = null
    }
  }

  /**
   * 从备份恢复数据
   */
  async restoreFromBackup(backupId: string, options: StateRecoveryOptions): Promise<void> {
    this.currentOperation = 'restoreFromBackup'

    try {
      console.log(`Restoring from backup: ${backupId}`)

      // 加载备份数据
      const backupData = await this.loadBackup(backupId)

      // 解密数据（如果需要）
      let processedData = backupData
      if (backupData.encrypted) {
        processedData = await this.decryptData(processedData)
      }

      // 解压数据（如果需要）
      if (backupData.compressed) {
        processedData = await this.decompressData(processedData)
      }

      // 恢复数据
      await this.restoreBackupData(processedData, options)

      console.log(`Backup restored successfully: ${backupId}`)

    } catch (error) {
          console.warn("操作失败:", error)
        } finally {
      this.currentOperation = null
    }
  }

  /**
   * 列出可用备份
   */
  async listBackups(): Promise<Array<{
    id: string
    createdAt: Date
    type: string
    size: number
    storageLocation: string
  }>> {
    try {
      const backups = await db.settings
        .where('key')
        .startsWith('backup_metadata_')
        .toArray()

      return backups.map(backup => ({
        id: backup.key.replace('backup_metadata_', ''),
        createdAt: new Date(backup.value.createdAt),
        type: backup.value.type,
        size: backup.value.size,
        storageLocation: backup.value.storageLocation
      }))

    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // ============================================================================
  // 性能优化方法
  // ============================================================================

  /**
   * 执行性能优化
   */
  async optimizePerformance(options: PerformanceOptimizationOptions): Promise<{
    optimized: boolean
    results: any
    executionTime: number
  }> {
    this.currentOperation = 'optimizePerformance'

    const startTime = Date.now()

    try {
      console.log('Starting performance optimization with options:', options)

      const results: any = {}

      // 重建索引
      if (options.rebuildIndexes) {
        results.indexOptimization = await this.rebuildIndexes()
      }

      // 清理孤立数据
      if (options.cleanupOrphanedData) {
        results.orphanedDataCleanup = await this.cleanupOrphanedData()
      }

      // 清理过期数据
      if (options.cleanupExpiredData) {
        results.expiredDataCleanup = await this.cleanupExpiredData()
      }

      // 清理缓存
      if (options.clearCache) {
        results.cacheCleanup = await this.clearCache()
      }

      // 优化缓存大小
      if (options.optimizeCacheSize) {
        results.cacheOptimization = await this.optimizeCacheSize()
      }

      // 更新统计信息
      if (options.updateStatistics) {
        results.statisticsUpdate = await this.updateStatistics()
      }

      // 碎片整理
      if (options.defragment) {
        results.defragmentation = await this.defragmentDatabase()
      }

      const executionTime = Date.now() - startTime

      console.log(`Performance optimization completed in ${executionTime}ms`)

      // 触发优化完成事件
      await this.notifyOptimizationCompleted({
        results,
        executionTime,
        options
      })

      return {
        optimized: true,
        results,
        executionTime
      }

    } catch (error) {
          console.warn("操作失败:", error)
        } finally {
      this.currentOperation = null
    }
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): any {
    return {
      operationMetrics: Object.fromEntries(this.operationMetrics),
      consistencyChecks: {
        lastCheck: this.lastConsistencyCheck,
        totalChecks: this.consistencyCache.size,
        unresolvedIssues: Array.from(this.consistencyCache.values()).filter(r => !r.resolved).length
      },
      systemState: this.currentState?.systemState,
      performanceState: this.currentState?.performanceState,
      syncState: this.currentState?.syncState
    }
  }

  // ============================================================================
  // 私有方法实现
  // ============================================================================

  private async loadPersistedState(): Promise<void> {
    try {
      const savedState = await db.settings.get('persistence_state')
      if (savedState) {
        this.currentState = savedState.value
        console.log('Loaded persisted state from database')
      } else {
        this.currentState = this.getDefaultState()
        console.log('Created new default state')
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async saveStateToDatabase(state: PersistenceState): Promise<void> {
    await db.settings.put({
      key: 'persistence_state',
      value: state,
      updatedAt: new Date(),
      scope: 'global'
    })
  }

  private async loadStateFromDatabase(): Promise<PersistenceState> {
    const savedState = await db.settings.get('persistence_state')
    if (!savedState) {
      throw new Error('No saved state found')
    }
    return savedState.value
  }

  private mergeState(current: PersistenceState, updates: Partial<PersistenceState>): PersistenceState {
    return {
      appState: { ...current.appState, ...updates.appState },
      syncState: { ...current.syncState, ...updates.syncState },
      userSession: { ...current.userSession, ...updates.userSession },
      performanceState: { ...current.performanceState, ...updates.performanceState },
      systemState: { ...current.systemState, ...updates.systemState },
      metadata: { ...current.metadata, ...updates.metadata, updatedAt: new Date() }
    }
  }

  private getDefaultState(): PersistenceState {
    return {
      appState: {
        lastActivity: new Date(),
        viewMode: 'grid',
        theme: 'light',
        language: 'zh-CN'
      },
      syncState: {
        syncVersion: 1,
        pendingOperations: 0,
        conflictCount: 0,
        syncEnabled: true,
        autoSync: true
      },
      userSession: {
        deviceId: this.generateDeviceId(),
        isAuthenticated: false
      },
      performanceState: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageResponseTime: 0
      },
      systemState: {
        databaseVersion: '3.0.0',
        healthCheckStatus: 'healthy',
        errorCount: 0
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        checksum: ''
      }
    }
  }

  private generateStateChecksum(state: PersistenceState): string {
    // 简单的校验和生成（生产环境应使用更安全的算法）
    const stateString = JSON.stringify(state)
    let hash = 0
    for (let i = 0; i < stateString.length; i++) {
      const char = stateString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash).toString(16)
  }

  private generateDeviceId(): string {
    return `device_${crypto.randomUUID()}`
  }

  private generateBackupId(): string {
    return `backup_${Date.now()}_${crypto.randomUUID()}`
  }

  private async validateState(state: PersistenceState): Promise<{
    isValid: boolean
    errors: string[]
  }> {
    const errors: string[] = []

    // 验证必需字段
    if (!state.metadata.version) {
      errors.push('Missing state version')
    }

    if (!state.metadata.checksum) {
      errors.push('Missing state checksum')
    }

    // 验证校验和
    const calculatedChecksum = this.generateStateChecksum(state)
    if (calculatedChecksum !== state.metadata.checksum) {
      errors.push('State checksum mismatch')
    }

    // 验证时间戳
    if (new Date(state.metadata.updatedAt).getTime() > Date.now()) {
      errors.push('State timestamp is in the future')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  private restoreStateScope(fullState: PersistenceState, scope: StateRecoveryOptions['scope']): PersistenceState {
    switch (scope) {
      case 'app-state':
        return { ...this.getDefaultState(), appState: fullState.appState }
      case 'sync-state':
        return { ...this.getDefaultState(), syncState: fullState.syncState }
      case 'user-session':
        return { ...this.getDefaultState(), userSession: fullState.userSession }
      case 'performance-state':
        return { ...this.getDefaultState(), performanceState: fullState.performanceState }
      case 'full':
      default:
        return fullState
    }
  }

  private async verifyStateRestoration(state: PersistenceState): Promise<void> {
    // 验证状态完整性
    const validationResult = await this.validateState(state)
    if (!validationResult.isValid) {
      throw new Error(`State restoration validation failed: ${validationResult.errors.join(', ')}`)
    }

    // 验证数据库连接
    try {
      await db.tables.toArray()
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async rollbackStateRestoration(): Promise<void> {
    console.log('Rolling back state restoration...')
    // 这里可以实现更复杂的回滚逻辑
    this.currentState = await this.loadStateFromDatabase()
  }

  // ============================================================================
  // 一致性检查实现
  // ============================================================================

  private async checkEntityCounts(): Promise<ConsistencyCheckResult[]> {
    const results: ConsistencyCheckResult[] = []

    try {
      // 检查基本实体计数
      const [cardCount, folderCount, tagCount, imageCount] = await Promise.all([
        db.cards.count(),
        db.folders.count(),
        db.tags.count(),
        db.images.count()
      ])

      results.push({
        id: `entity-count-cards-${Date.now()}`,
        checkType: 'entity-count',
        entityType: 'card',
        status: 'passed',
        severity: 'low',
        message: `Card count: ${cardCount}`,
        details: { count: cardCount },
        timestamp: new Date(),
        resolved: true
      })

      results.push({
        id: `entity-count-folders-${Date.now()}`,
        checkType: 'entity-count',
        entityType: 'folder',
        status: 'passed',
        severity: 'low',
        message: `Folder count: ${folderCount}`,
        details: { count: folderCount },
        timestamp: new Date(),
        resolved: true
      })

      results.push({
        id: `entity-count-tags-${Date.now()}`,
        checkType: 'entity-count',
        entityType: 'tag',
        status: 'passed',
        severity: 'low',
        message: `Tag count: ${tagCount}`,
        details: { count: tagCount },
        timestamp: new Date(),
        resolved: true
      })

      results.push({
        id: `entity-count-images-${Date.now()}`,
        checkType: 'entity-count',
        entityType: 'image',
        status: 'passed',
        severity: 'low',
        message: `Image count: ${imageCount}`,
        details: { count: imageCount },
        timestamp: new Date(),
        resolved: true
      })

    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        checkType: 'entity-count',
        status: 'failed',
        severity: 'high',
        message: `Entity count check failed: ${error}`,
        timestamp: new Date(),
        resolved: false
      })
    }

    return results
  }

  private async checkReferenceIntegrity(): Promise<ConsistencyCheckResult[]> {
    const results: ConsistencyCheckResult[] = []

    try {
      // 检查卡片的文件夹引用
      const cardsWithoutFolders = await db.cards
        .where('folderId')
        .notEqual('')
        .and(card => card.folderId !== undefined && card.folderId !== null)
        .toArray()

      const validFolderIds = await db.folders.toCollection().primaryKeys()
      const invalidFolderReferences = cardsWithoutFolders.filter(card =>
        !validFolderIds.includes(card.folderId!)
      )

      if (invalidFolderReferences.length > 0) {
        results.push({
          id: `reference-integrity-folder-${Date.now()}`,
          checkType: 'reference-integrity',
          status: 'failed',
          severity: 'medium',
          message: `${invalidFolderReferences.length} cards reference non-existent folders`,
          details: { invalidReferences: invalidFolderReferences.map(c => ({ cardId: c.id, folderId: c.folderId })) },
          timestamp: new Date(),
          resolved: false
        })
      }

      // 检查图片的卡片引用
      const imagesWithoutCards = await db.images
        .toArray()

      const validCardIds = await db.cards.toCollection().primaryKeys()
      const invalidCardReferences = imagesWithoutCards.filter(image =>
        !validCardIds.includes(image.cardId)
      )

      if (invalidCardReferences.length > 0) {
        results.push({
          id: `reference-integrity-card-${Date.now()}`,
          checkType: 'reference-integrity',
          status: 'failed',
          severity: 'medium',
          message: `${invalidCardReferences.length} images reference non-existent cards`,
          details: { invalidReferences: invalidCardReferences.map(i => ({ imageId: i.id, cardId: i.cardId })) },
          timestamp: new Date(),
          resolved: false
        })
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        checkType: 'reference-integrity',
        status: 'failed',
        severity: 'high',
        message: `Reference integrity check failed: ${error}`,
        timestamp: new Date(),
        resolved: false
      })
    }

    return results
  }

  private async checkDataIntegrity(): Promise<ConsistencyCheckResult[]> {
    const results: ConsistencyCheckResult[] = []

    try {
      // 检查卡片数据完整性
      const cards = await db.cards.toArray()
      const corruptedCards = cards.filter(card => {
        return !card.frontContent?.title || !card.backContent?.title || !card.id
      })

      if (corruptedCards.length > 0) {
        results.push({
          id: `data-integrity-cards-${Date.now()}`,
          checkType: 'data-integrity',
          entityType: 'card',
          status: 'failed',
          severity: 'high',
          message: `${corruptedCards.length} cards have corrupted data`,
          details: { corruptedCards: corruptedCards.map(c => c.id) },
          timestamp: new Date(),
          resolved: false
        })
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        checkType: 'data-integrity',
        status: 'failed',
        severity: 'high',
        message: `Data integrity check failed: ${error}`,
        timestamp: new Date(),
        resolved: false
      })
    }

    return results
  }

  private async checkSyncConsistency(): Promise<ConsistencyCheckResult[]> {
    const results: ConsistencyCheckResult[] = []

    try {
      // 检查同步队列状态
      const pendingSyncOperations = await db.syncQueue
        .where('pendingSync')
        .equals(true)
        .count()

      if (pendingSyncOperations > 1000) {
        results.push({
          id: `sync-consistency-pending-${Date.now()}`,
          checkType: 'sync-consistency',
          status: 'warning',
          severity: 'medium',
          message: `High number of pending sync operations: ${pendingSyncOperations}`,
          details: { pendingOperations: pendingSyncOperations },
          timestamp: new Date(),
          resolved: false
        })
      }

      // 检查同步版本一致性
      const cards = await db.cards.toArray()
      const versionInconsistencies = cards.filter(card =>
        card.syncVersion === 0 || card.syncVersion > 10000
      )

      if (versionInconsistencies.length > 0) {
        results.push({
          id: `sync-consistency-versions-${Date.now()}`,
          checkType: 'sync-consistency',
          status: 'warning',
          severity: 'low',
          message: `${versionInconsistencies.length} cards have inconsistent sync versions`,
          details: { inconsistentCards: versionInconsistencies.map(c => c.id) },
          timestamp: new Date(),
          resolved: false
        })
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        checkType: 'sync-consistency',
        status: 'failed',
        severity: 'high',
        message: `Sync consistency check failed: ${error}`,
        timestamp: new Date(),
        resolved: false
      })
    }

    return results
  }

  private async fixConsistencyIssue(issue: ConsistencyCheckResult): Promise<boolean> {
    try {
      switch (issue.checkType) {
        case 'reference-integrity':
          return await this.fixReferenceIntegrityIssue(issue)

        case 'data-integrity':
          return await this.fixDataIntegrityIssue(issue)

        case 'sync-consistency':
          return await this.fixSyncConsistencyIssue(issue)

        default:
          console.warn(`Cannot auto-fix issue type: ${issue.checkType}`)
          return false
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
      return false
    }
  }

  private async fixReferenceIntegrityIssue(issue: ConsistencyCheckResult): Promise<boolean> {
    if (issue.details?.invalidReferences) {
      for (const ref of issue.details.invalidReferences) {
        if (ref.cardId && ref.folderId) {
          // 修复无效的文件夹引用
          await db.cards.update(ref.cardId, { folderId: undefined })
        } else if (ref.imageId && ref.cardId) {
          // 删除无效的图片引用
          await db.images.delete(ref.imageId)
        }
      }
      return true
    }
    return false
  }

  private async fixDataIntegrityIssue(issue: ConsistencyCheckResult): Promise<boolean> {
    if (issue.details?.corruptedCards) {
      for (const cardId of issue.details.corruptedCards) {
        // 删除损坏的卡片
        await db.cards.delete(cardId)
      }
      return true
    }
    return false
  }

  private async fixSyncConsistencyIssue(issue: ConsistencyCheckResult): Promise<boolean> {
    if (issue.details?.inconsistentCards) {
      for (const cardId of issue.details.inconsistentCards) {
        // 重置同步版本
        await db.cards.update(cardId, { syncVersion: 1, pendingSync: true })
      }
      return true
    }
    return false
  }

  private async performInitialConsistencyCheck(): Promise<void> {
    try {
      const quickResults = await this.performQuickConsistencyCheck()
      const criticalIssues = quickResults.filter(r => r.severity === 'critical' && r.status === 'failed')

      if (criticalIssues.length > 0) {
        console.warn('Critical consistency issues found during initialization:', criticalIssues)
        await this.fixConsistencyIssues(criticalIssues)
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // ============================================================================
  // 备份和恢复实现
  // ============================================================================

  private async collectBackupData(options: BackupOptions): Promise<any> {
    const backupData: any = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: {}
    }

    // 收集各种数据
    if (options.includeCards) {
      backupData.data.cards = await db.cards.toArray()
    }

    if (options.includeFolders) {
      backupData.data.folders = await db.folders.toArray()
    }

    if (options.includeTags) {
      backupData.data.tags = await db.tags.toArray()
    }

    if (options.includeImages) {
      backupData.data.images = await db.images.toArray()
    }

    if (options.includeSettings) {
      backupData.data.settings = await db.settings.toArray()
    }

    if (options.includeSyncQueue) {
      backupData.data.syncQueue = await db.syncQueue.toArray()
    }

    // 添加元数据
    backupData.metadata = {
      type: options.type,
      compressed: options.compression,
      encrypted: options.encryption,
      storageLocation: options.storageLocation,
      itemCount: Object.values(backupData.data).flat().length
    }

    return backupData
  }

  private async compressData(data: any, compressionLevel: number): Promise<any> {
    // 简化的压缩实现（生产环境应使用实际的压缩库）
    return {
      ...data,
      compressed: true,
      compressionLevel,
      originalSize: JSON.stringify(data).length
    }
  }

  private async encryptData(data: any): Promise<any> {
    // 简化的加密实现（生产环境应使用实际的加密库）
    return {
      ...data,
      encrypted: true
    }
  }

  private async saveBackup(backupId: string, data: any, storageLocation: string): Promise<void> {
    if (storageLocation === 'local' || storageLocation === 'both') {
      // 保存到IndexedDB
      await db.settings.put({
        key: `backup_${backupId}`,
        value: data,
        updatedAt: new Date(),
        scope: 'global'
      })
    }

    // 这里可以添加云存储逻辑
  }

  private async recordBackupMetadata(backupId: string, options: BackupOptions, data: any): Promise<void> {
    const metadata = {
      id: backupId,
      type: options.type,
      createdAt: new Date().toISOString(),
      size: JSON.stringify(data).length,
      compressed: options.compression,
      encrypted: options.encryption,
      storageLocation: options.storageLocation,
      itemCount: data.metadata?.itemCount || 0
    }

    await db.settings.put({
      key: `backup_metadata_${backupId}`,
      value: metadata,
      updatedAt: new Date(),
      scope: 'global'
    })
  }

  private async loadBackup(backupId: string): Promise<any> {
    const backup = await db.settings.get(`backup_${backupId}`)
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`)
    }
    return backup.value
  }

  private async decryptData(data: any): Promise<any> {
    // 简化的解密实现
    return data
  }

  private async decompressData(data: any): Promise<any> {
    // 简化的解压实现
    return data
  }

  private async restoreBackupData(data: any, options: StateRecoveryOptions): Promise<void> {
    // 恢复各种数据类型
    if (data.data?.cards) {
      await db.cards.clear()
      await db.cards.bulkAdd(data.data.cards)
    }

    if (data.data?.folders) {
      await db.folders.clear()
      await db.folders.bulkAdd(data.data.folders)
    }

    if (data.data?.tags) {
      await db.tags.clear()
      await db.tags.bulkAdd(data.data.tags)
    }

    if (data.data?.images) {
      await db.images.clear()
      await db.images.bulkAdd(data.data.images)
    }

    if (data.data?.settings) {
      await db.settings.clear()
      await db.settings.bulkAdd(data.data.settings)
    }

    if (data.data?.syncQueue) {
      await db.syncQueue.clear()
      await db.syncQueue.bulkAdd(data.data.syncQueue)
    }
  }

  // ============================================================================
  // 性能优化实现
  // ============================================================================

  private async rebuildIndexes(): Promise<{ success: boolean; rebuiltIndexes: string[] }> {
    try {
      console.log('Rebuilding database indexes...')

      // 在Dexie中,索引通常在数据库版本升级时自动重建
      // 这里可以执行一些优化操作

      const rebuiltIndexes = ['cards', 'folders', 'tags', 'images', 'syncQueue', 'settings']

      // 清理和重建搜索索引
      await this.rebuildSearchIndexes()

      return { success: true, rebuiltIndexes }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  private async cleanupOrphanedData(): Promise<{ success: boolean; cleanedItems: number }> {
    try {
      console.log('Cleaning up orphaned data...')

      let cleanedItems = 0

      // 清理没有对应卡片的图片
      const validCardIds = await db.cards.toCollection().primaryKeys()
      const orphanedImages = await db.images
        .where('cardId')
        .noneOf(validCardIds as string[])
        .toArray()

      if (orphanedImages.length > 0) {
        await db.images.bulkDelete(orphanedImages.map(img => img.id!))
        cleanedItems += orphanedImages.length
      }

      return { success: true, cleanedItems }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  private async cleanupExpiredData(): Promise<{ success: boolean; cleanedItems: number }> {
    try {
      console.log('Cleaning up expired data...')

      let cleanedItems = 0

      // 清理过期的同步操作
      const expiredDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7天前
      const expiredSyncOperations = await db.syncQueue
        .where('timestamp')
        .below(expiredDate)
        .toArray()

      if (expiredSyncOperations.length > 0) {
        await db.syncQueue.bulkDelete(expiredSyncOperations.map(op => op.id!))
        cleanedItems += expiredSyncOperations.length
      }

      return { success: true, cleanedItems }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  private async clearCache(): Promise<{ success: boolean; clearedItems: number }> {
    try {
      console.log('Clearing cache...')

      const clearedItems = this.consistencyCache.size
      this.consistencyCache.clear()

      return { success: true, clearedItems }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  private async optimizeCacheSize(): Promise<{ success: boolean; optimizedSize: number }> {
    try {
      console.log('Optimizing cache size...')

      // 限制缓存大小为最近的1000条记录
      const maxCacheSize = 1000
      const currentSize = this.consistencyCache.size

      if (currentSize > maxCacheSize) {
        const entries = Array.from(this.consistencyCache.entries())
        entries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime())

        const toRemove = entries.slice(0, currentSize - maxCacheSize)
        for (const [key] of toRemove) {
          this.consistencyCache.delete(key)
        }
      }

      return { success: true, optimizedSize: this.consistencyCache.size }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  private async updateStatistics(): Promise<{ success: boolean; updatedStats: any }> {
    try {
      console.log('Updating database statistics...')

      const stats = await db.getStats()

      // 更新当前状态中的统计信息
      if (this.currentState) {
        this.currentState.systemState.lastMaintenanceTime = new Date()
        this.currentState.systemState.healthCheckStatus = 'healthy'
        await this.persistState(this.currentState)
      }

      return { success: true, updatedStats: stats }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  private async defragmentDatabase(): Promise<{ success: boolean; spaceSaved: number }> {
    try {
      console.log('Defragmenting database...')

      // 在IndexedDB中,碎片整理通常通过删除和重建数据表来实现
      // 这里简化实现

      // 获取数据库大小（简化计算）
      const beforeStats = await db.getStats()

      // 执行清理操作
      await this.cleanupOrphanedData()
      await this.cleanupExpiredData()

      const afterStats = await db.getStats()
      const spaceSaved = beforeStats.totalSize - afterStats.totalSize

      return { success: true, spaceSaved: Math.max(0, spaceSaved) }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  private async rebuildSearchIndexes(): Promise<void> {
    // 重建搜索索引的实现
    const cards = await db.cards.toArray()

    for (const card of cards) {
      const searchVector = this.generateSearchVector(card)
      await db.cards.update(card.id!, { searchVector })
    }
  }

  private generateSearchVector(card: any): string {
    const searchableText = [
      card.frontContent?.title || '',
      card.frontContent?.text || '',
      card.backContent?.title || '',
      card.backContent?.text || '',
      ...(card.frontContent?.tags || []),
      ...(card.backContent?.tags || [])
    ].join(' ').toLowerCase()

    return searchableText
  }

  // ============================================================================
  // 状态清理实现
  // ============================================================================

  private async clearFullState(): Promise<void> {
    await this.clearAppState()
    await this.clearSyncState()
    await this.clearUserSession()
    await this.clearPerformanceState()
  }

  private async clearAppState(): Promise<void> {
    if (this.currentState) {
      this.currentState.appState = this.getDefaultState().appState
      await this.persistState(this.currentState)
    }
  }

  private async clearSyncState(): Promise<void> {
    if (this.currentState) {
      this.currentState.syncState = this.getDefaultState().syncState
      await this.persistState(this.currentState)
    }

    // 清理同步队列
    await db.syncQueue.clear()
  }

  private async clearUserSession(): Promise<void> {
    if (this.currentState) {
      this.currentState.userSession = this.getDefaultState().userSession
      await this.persistState(this.currentState)
    }

    // 清理会话数据
    await db.sessions.clear()
  }

  private async clearPerformanceState(): Promise<void> {
    if (this.currentState) {
      this.currentState.performanceState = this.getDefaultState().performanceState
      await this.persistState(this.currentState)
    }

    // 清理性能指标
    this.operationMetrics.clear()
  }

  // ============================================================================
  // 事件处理和通知
  // ============================================================================

  private setupEventListeners(): void {
    // 监听数据库错误
    db.on('error', (error) => {
      console.error('Database error:', error)
      this.notifyError(error, 'database_error')
    })

    // 监听网络变化
    networkMonitorService.addEventListener((event) => {
      this.handleNetworkChange(event)
    })
  }

  private startMaintenanceTasks(): void {
    // 每小时执行一次快速一致性检查
    setInterval(() => {
      this.performQuickConsistencyCheck().catch(console.error)
    }, 60 * 60 * 1000)

    // 每天执行一次完整一致性检查
    setInterval(() => {
      this.performFullConsistencyCheck().catch(console.error)
    }, 24 * 60 * 60 * 1000)

    // 每周执行一次性能优化
    setInterval(() => {
      this.optimizePerformance({
        rebuildIndexes: false,
        cleanupOrphanedData: true,
        cleanupExpiredData: true,
        clearCache: true,
        optimizeCacheSize: true,
        updateStatistics: true,
        defragment: false
      }).catch(console.error)
    }, 7 * 24 * 60 * 60 * 1000)
  }

  private async handleNetworkChange(event: any): void {
    const networkInfo = event.currentState

    // 根据网络质量调整策略
    if (networkInfo.effectiveType === 'slow-2g' || networkInfo.effectiveType === '2g') {
      console.log('Poor network detected, adjusting persistence strategies')
      // 可以在这里实现网络敏感的持久化策略调整
    }
  }

  private async notifyStateSaved(state: PersistenceState): Promise<void> {
    if (this.listeners.stateRestored) {
      try {
        this.listeners.stateRestored!(state)
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  private async notifyStateRestored(state: PersistenceState): Promise<void> {
    if (this.listeners.stateRestored) {
      try {
        this.listeners.stateRestored!(state)
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  private async notifyConsistencyChecked(results: ConsistencyCheckResult[]): Promise<void> {
    if (this.listeners.consistencyChecked) {
      try {
        this.listeners.consistencyChecked!(results)
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  private async notifyBackupCreated(backupId: string): Promise<void> {
    if (this.listeners.backupCreated) {
      try {
        this.listeners.backupCreated!(backupId)
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  private async notifyOptimizationCompleted(results: any): Promise<void> {
    if (this.listeners.optimizationCompleted) {
      try {
        this.listeners.optimizationCompleted!(results)
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  private async notifyError(error: Error, context: string): Promise<void> {
    if (this.listeners.errorOccurred) {
      try {
        this.listeners.errorOccurred!(error, context)
      }
      catch (error) { console.warn("操作失败:", error) }
    }

    // 记录错误到系统状态
    if (this.currentState) {
      this.currentState.systemState.errorCount++
      this.currentState.systemState.lastErrorTime = new Date()
      this.currentState.systemState.healthCheckStatus = 'error'
      await this.persistState(this.currentState)
    }
  }

  // ============================================================================
  // 公共事件监听器方法
  // ============================================================================

  addEventListener<K extends keyof typeof this.listeners>(
    event: K,
    callback: NonNullable<typeof this.listeners[K]>
  ): void {
    this.listeners[event] = callback as any
  }

  removeEventListener<K extends keyof typeof this.listeners>(
    event: K
  ): void {
    delete this.listeners[event]
  }

  // ============================================================================
  // 获取当前状态
  // ============================================================================

  getCurrentState(): PersistenceState | null {
    return this.currentState
  }

  isInitialized(): boolean {
    return this.isInitialized
  }

  isRestoringState(): boolean {
    return this.isRestoring
  }

  getCurrentOperation(): string | null {
    return this.currentOperation
  }

  // ============================================================================
  // 销毁方法
  // ============================================================================

  async destroy(): Promise<void> {
    try {
      console.log('Destroying EnhancedPersistenceManager...')

      // 清理定时器
      // （需要保存定时器引用以便清理）

      // 清理缓存
      this.consistencyCache.clear()
      this.operationMetrics.clear()

      // 保存最终状态
      if (this.currentState) {
        await this.persistState(this.currentState)
      }

      this.isInitialized = false
      this.currentState = null

      console.log('EnhancedPersistenceManager destroyed successfully')

    } catch (error) {
          console.warn("操作失败:", error)
        }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const enhancedPersistenceManager = EnhancedPersistenceManager.getInstance()

// ============================================================================
// 初始化函数
// ============================================================================

export const initializeEnhancedPersistence = async (): Promise<void> => {
  try {
    await enhancedPersistenceManager.initialize()
    console.log('Enhanced persistence system initialized successfully')
  } catch (error) {
          console.warn("操作失败:", error)
        }
}