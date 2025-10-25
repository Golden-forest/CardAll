/**
 * 备份恢复服务
 * 提供备份恢复、数据重建和灾难恢复功能
 */

import { BackupMetadata } from '../data-validator'

// ============================================================================
// 恢复系统类型定义
// ============================================================================

export interface RecoveryOptions {
  targetLocation: 'current' | 'new' | 'specific'
  conflictResolution: 'overwrite' | 'merge' | 'skip' | 'rename'
  dataSelection: {
    cards: boolean
    folders: boolean
    tags: boolean
    images: boolean
    settings: boolean
    syncQueue: boolean
  }
  validation: {
    enabled: boolean
    strict: boolean
    autoRepair: boolean
  }
  rollback: {
    enabled: boolean
    snapshot: boolean
  }
  progress: {
    showProgress: boolean
    estimateTime: boolean
  }
}

export interface RecoverySession {
  id: string
  backupId: string
  startTime: Date
  status: 'preparing' | 'validating' | 'restoring' | 'completed' | 'failed' | 'cancelled'
  options: RecoveryOptions
  progress: {
    total: number
    completed: number
    currentStep: string
    estimatedTimeRemaining: number
  }
  results: {
    restoredItems: {
      cards: number
      folders: number
      tags: number
      images: number
      settings: number
      syncQueue: number
    }
    conflicts: Array<{
      type: string
      id: string
      action: string
      resolution: string
    }>
    errors: string[]
    warnings: string[]
  }
  snapshot?: {
    id: string
    timestamp: Date
    data: any
  }
  endTime?: Date
  duration?: number
}

export interface RecoverySnapshot {
  id: string
  name: string
  description: string
  timestamp: Date
  data: any
  checksum: string
  size: number
  createdDuring: string // 恢复会话ID
  purpose: 'pre-restore' | 'post-restore' | 'manual'
}

export interface DisasterRecoveryPlan {
  id: string
  name: string
  description: string
  priority: number
  triggers: Array<{
    condition: string
    action: string
  }>
  backupSources: Array<{
    location: string
    priority: number
    autoFailover: boolean
  }>
  recoverySteps: Array<{
    step: number
    action: string
    dependencies: number[]
    estimatedTime: number
    critical: boolean
  }>
  testing: {
    enabled: boolean
    frequency: string
    lastTest: Date | null
    nextTest: Date
  }
  notification: {
    enabled: boolean
    recipients: string[]
    channels: string[]
  }
  lastUsed: Date | null
  successRate: number
}

export interface RecoveryReport {
  sessionId: string
  backupId: string
  startTime: Date
  endTime: Date
  duration: number
  status: 'success' | 'partial' | 'failed'
  summary: {
    totalItems: number
    restoredItems: number
    conflicts: number
    errors: number
    warnings: number
  }
  details: {
    cards: { total: number; restored: number; conflicts: number; errors: number }
    folders: { total: number; restored: number; conflicts: number; errors: number }
    tags: { total: number; restored: number; conflicts: number; errors: number }
    images: { total: number; restored: number; conflicts: number; errors: number }
  }
  performance: {
    totalTime: number
    validationTime: number
    restoreTime: number
    averageSpeed: number // items per second
  }
  recommendations: string[]
}

// ============================================================================
// 备份恢复服务类
// ============================================================================

export class BackupRecoveryService {
  private activeSessions: Map<string, RecoverySession> = new Map()
  private snapshots: Map<string, RecoverySnapshot> = new Map()
  private recoveryPlans: Map<string, DisasterRecoveryPlan> = new Map()

  constructor() {
    this.loadRecoveryData()
    this.initializeRecoveryPlans()
  }

  /**
   * 加载恢复数据
   */
  private loadRecoveryData(): void {
    this.loadSnapshots()
    this.loadRecoveryPlans()
  }

  /**
   * 初始化灾难恢复计划
   */
  private initializeRecoveryPlans(): void {
    // 创建默认的灾难恢复计划
    const defaultPlan: DisasterRecoveryPlan = {
      id: 'default-recovery-plan',
      name: '默认灾难恢复计划',
      description: '标准的数据恢复流程',
      priority: 100,
      triggers: [
        {
          condition: 'data_corruption_detected',
          action: 'initiate_immediate_recovery'
        },
        {
          condition: 'database_failure',
          action: 'switch_to_backup_storage'
        },
        {
          condition: 'sync_conflicts_unresolved',
          action: 'restore_from_last_known_good'
        }
      ],
      backupSources: [
        {
          location: 'local_indexeddb',
          priority: 1,
          autoFailover: true
        },
        {
          location: 'local_filesystem',
          priority: 2,
          autoFailover: true
        },
        {
          location: 'cloud_storage',
          priority: 3,
          autoFailover: false
        }
      ],
      recoverySteps: [
        {
          step: 1,
          action: 'validate_backup_integrity',
          dependencies: [],
          estimatedTime: 2,
          critical: true
        },
        {
          step: 2,
          action: 'create_pre_restore_snapshot',
          dependencies: [1],
          estimatedTime: 1,
          critical: true
        },
        {
          step: 3,
          action: 'restore_core_data',
          dependencies: [2],
          estimatedTime: 5,
          critical: true
        },
        {
          step: 4,
          action: 'validate_restored_data',
          dependencies: [3],
          estimatedTime: 1,
          critical: true
        },
        {
          step: 5,
          action: 'cleanup_and_optimize',
          dependencies: [4],
          estimatedTime: 2,
          critical: false
        }
      ],
      testing: {
        enabled: true,
        frequency: 'monthly',
        lastTest: null,
        nextTest: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      notification: {
        enabled: true,
        recipients: ['admin'],
        channels: ['browser', 'email']
      },
      lastUsed: null,
      successRate: 100
    }

    this.recoveryPlans.set('default-recovery-plan', defaultPlan)
  }

  /**
   * 开始恢复会话
   */
  async startRecoverySession(
    backupId: string,
    options: RecoveryOptions
  ): Promise<RecoverySession> {
    const sessionId = `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const session: RecoverySession = {
      id: sessionId,
      backupId,
      startTime: new Date(),
      status: 'preparing',
      options,
      progress: {
        total: 100, // 总进度
        completed: 0,
        currentStep: '初始化恢复会话',
        estimatedTimeRemaining: 0
      },
      results: {
        restoredItems: {
          cards: 0,
          folders: 0,
          tags: 0,
          images: 0,
          settings: 0,
          syncQueue: 0
        },
        conflicts: [],
        errors: [],
        warnings: []
      }
    }

    this.activeSessions.set(sessionId, session)

    try {
      // 异步执行恢复过程
      this.executeRecoverySession(sessionId)

      return session
    } catch (error) {
      session.status = 'failed'
      session.endTime = new Date()
      session.results.errors.push(error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  /**
   * 执行恢复会话
   */
  private async executeRecoverySession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    if (!session) return

    try {
      // 步骤1: 准备阶段
      await this.performRecoveryStep(session, 'preparing', '准备恢复环境', 10)

      // 步骤2: 验证备份
      if (session.options.validation.enabled) {
        await this.performRecoveryStep(session, 'validating', '验证备份完整性', 20)
        await this.validateBackupForRecovery(session)
      }

      // 步骤3: 创建恢复前快照
      if (session.options.rollback.enabled && session.options.rollback.snapshot) {
        await this.performRecoveryStep(session, 'restoring', '创建恢复前快照', 10)
        await this.createPreRestoreSnapshot(session)
      }

      // 步骤4: 执行数据恢复
      await this.performRecoveryStep(session, 'restoring', '恢复数据', 40)
      await this.restoreData(session)

      // 步骤5: 验证恢复结果
      if (session.options.validation.enabled) {
        await this.performRecoveryStep(session, 'restoring', '验证恢复结果', 15)
        await this.validateRecoveryResult(session)
      }

      // 步骤6: 完成恢复
      await this.performRecoveryStep(session, 'completed', '恢复完成', 5)

      session.status = 'completed'
      session.endTime = new Date()
      session.duration = session.endTime.getTime() - session.startTime.getTime()

      // 创建恢复后快照
      if (session.options.rollback.enabled) {
        await this.createPostRestoreSnapshot(session)
      }

      // 生成恢复报告
      const report = this.generateRecoveryReport(session)
      console.log('Recovery completed:', report)

    } catch (error) {
      console.error('Recovery session failed:', error)
      session.status = 'failed'
      session.endTime = new Date()
      session.duration = session.endTime.getTime() - session.startTime.getTime()
      session.results.errors.push(error instanceof Error ? error.message : 'Unknown error')

      // 尝试回滚
      if (session.options.rollback.enabled && session.snapshot) {
        await this.attemptRollback(session)
      }
    }
  }

  /**
   * 执行恢复步骤
   */
  private async performRecoveryStep(
    session: RecoverySession,
    status: RecoverySession['status'],
    stepName: string,
    progressIncrement: number
  ): Promise<void> {
    session.status = status
    session.progress.currentStep = stepName
    session.progress.completed += progressIncrement

    // 模拟步骤执行时间
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log(`Recovery step completed: ${stepName} (${progressIncrement}%)`)
  }

  /**
   * 验证备份用于恢复
   */
  private async validateBackupForRecovery(session: RecoverySession): Promise<void> {
    try {
      // 这里应该调用实际的验证服务
      // 现在使用模拟验证
      console.log(`Validating backup ${session.backupId} for recovery`)

      // 模拟验证过程
      await new Promise(resolve => setTimeout(resolve, 2000))

      // 检查备份是否存在和完整
      const backup = await this.loadBackupForRecovery(session.backupId)
      if (!backup) {
        throw new Error('Backup not found or corrupted')
      }

      // 如果是严格模式，执行更详细的验证
      if (session.options.validation.strict) {
        await this.performStrictValidation(backup)
      }

    } catch (error) {
      session.results.errors.push(`备份验证失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  /**
   * 加载备份数据用于恢复
   */
  private async loadBackupForRecovery(backupId: string): Promise<{
    data: any
    metadata: BackupMetadata
  } | null> {
    try {
      // 这里应该从实际存储中加载备份数据
      // 现在返回模拟数据
      return {
        data: {
          cards: [],
          folders: [],
          tags: [],
          settings: []
        },
        metadata: {
          id: backupId,
          configId: 'default',
          name: 'Mock Backup',
          timestamp: new Date(),
          type: 'full',
          size: 1024 * 1024,
          checksum: 'mock-checksum',
          compression: true,
          encryption: false,
          include: {
            cards: true,
            folders: true,
            tags: true,
            images: false,
            settings: true,
            syncQueue: true
          },
          deviceId: 'mock-device',
          version: '1.0'
        }
      }
    } catch (error) {
      console.error('Failed to load backup for recovery:', error)
      return null
    }
  }

  /**
   * 执行严格验证
   */
  private async performStrictValidation(backup: { data: any; metadata: BackupMetadata }): Promise<void> {
    // 执行更严格的数据验证
    console.log('Performing strict validation...')

    // 检查数据结构完整性
    if (!backup.data || typeof backup.data !== 'object') {
      throw new Error('Invalid data structure')
    }

    // 检查必要的数据类型
    const requiredTypes = ['cards', 'folders', 'tags']
    for (const type of requiredTypes) {
      if (!Array.isArray(backup.data[type])) {
        throw new Error(`Invalid ${type} data format`)
      }
    }
  }

  /**
   * 创建恢复前快照
   */
  private async createPreRestoreSnapshot(session: RecoverySession): Promise<void> {
    try {
      const snapshotId = `snapshot_pre_${session.id}`
      const snapshotData = await this.captureCurrentState()

      const snapshot: RecoverySnapshot = {
        id: snapshotId,
        name: `Pre-restore snapshot for ${session.backupId}`,
        description: `Created before restoring from backup ${session.backupId}`,
        timestamp: new Date(),
        data: snapshotData,
        checksum: await this.calculateChecksum(snapshotData),
        size: JSON.stringify(snapshotData).length,
        createdDuring: session.id,
        purpose: 'pre-restore'
      }

      this.snapshots.set(snapshotId, snapshot)
      session.snapshot = snapshot

      this.saveSnapshots()
      console.log(`Pre-restore snapshot created: ${snapshotId}`)

    } catch (error) {
      session.results.warnings.push(`无法创建恢复前快照: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 捕获当前状态
   */
  private async captureCurrentState(): Promise<any> {
    // 这里应该从数据库中捕获当前状态
    // 现在返回模拟数据
    return {
      cards: [],
      folders: [],
      tags: [],
      settings: [],
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 计算校验和
   */
  private async calculateChecksum(data: any): Promise<string> {
    const jsonString = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16)
  }

  /**
   * 恢复数据
   */
  private async restoreData(session: RecoverySession): Promise<void> {
    try {
      const backup = await this.loadBackupForRecovery(session.backupId)
      if (!backup) {
        throw new Error('Backup not available for restoration')
      }

      const { data, metadata } = backup

      // 恢复卡片数据
      if (session.options.dataSelection.cards && data.cards) {
        await this.restoreEntityData(session, 'cards', data.cards)
      }

      // 恢复文件夹数据
      if (session.options.dataSelection.folders && data.folders) {
        await this.restoreEntityData(session, 'folders', data.folders)
      }

      // 恢复标签数据
      if (session.options.dataSelection.tags && data.tags) {
        await this.restoreEntityData(session, 'tags', data.tags)
      }

      // 恢复图片数据
      if (session.options.dataSelection.images && data.images) {
        await this.restoreEntityData(session, 'images', data.images)
      }

      // 恢复设置数据
      if (session.options.dataSelection.settings && data.settings) {
        await this.restoreEntityData(session, 'settings', data.settings)
      }

      console.log('Data restoration completed successfully')

    } catch (error) {
      session.results.errors.push(`数据恢复失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  /**
   * 恢复实体数据
   */
  private async restoreEntityData(
    session: RecoverySession,
    entityType: string,
    entities: any[]
  ): Promise<void> {
    try {
      console.log(`Restoring ${entityType}: ${entities.length} items`)

      for (const entity of entities) {
        try {
          await this.restoreSingleEntity(session, entityType, entity)
        } catch (error) {
          session.results.errors.push(`恢复${entityType} ${entity.id}失败: ${error}`)
        }
      }

      session.results.restoredItems[entityType as keyof typeof session.results.restoredItems] = entities.length

    } catch (error) {
      session.results.errors.push(`恢复${entityType}数据失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 恢复单个实体
   */
  private async restoreSingleEntity(
    session: RecoverySession,
    entityType: string,
    entity: any
  ): Promise<void> {
    // 这里应该根据实体类型调用相应的数据库操作
    // 现在使用模拟操作
    console.log(`Restoring ${entityType} ${entity.id}`)

    // 模拟数据库操作
    await new Promise(resolve => setTimeout(resolve, 50))

    // 检查冲突
    const conflict = await this.checkEntityConflict(entityType, entity)
    if (conflict) {
      await this.handleEntityConflict(session, entityType, entity, conflict)
    }
  }

  /**
   * 检查实体冲突
   */
  private async checkEntityConflict(entityType: string, entity: any): Promise<{
    type: string
    existing: any
    conflict: string
  } | null> {
    // 这里应该检查数据库中是否已存在相同ID的实体
    // 现在返回模拟结果
    if (Math.random() < 0.1) { // 10%概率模拟冲突
      return {
        type: entityType,
        existing: { id: entity.id, name: 'Existing entity' },
        conflict: 'Entity with same ID already exists'
      }
    }
    return null
  }

  /**
   * 处理实体冲突
   */
  private async handleEntityConflict(
    session: RecoverySession,
    entityType: string,
    entity: any,
    conflict: any
  ): Promise<void> {
    const resolution = session.options.conflictResolution

    session.results.conflicts.push({
      type: entityType,
      id: entity.id,
      action: resolution,
      resolution: `使用${resolution}策略处理冲突`
    })

    // 根据冲突解决策略处理
    switch (resolution) {
      case 'overwrite':
        // 覆盖现有数据
        console.log(`Overwriting existing ${entityType} ${entity.id}`)
        break
      case 'merge':
        // 合并数据
        console.log(`Merging ${entityType} ${entity.id}`)
        break
      case 'skip':
        // 跳过这个实体
        console.log(`Skipping ${entityType} ${entity.id}`)
        return
      case 'rename':
        // 重命名新实体
        entity.id = `${entity.id}_restored_${Date.now()}`
        console.log(`Renamed ${entityType} to ${entity.id}`)
        break
    }
  }

  /**
   * 验证恢复结果
   */
  private async validateRecoveryResult(session: RecoverySession): Promise<void> {
    try {
      console.log('Validating recovery results...')

      // 验证恢复的数据数量
      const expectedItems = this.calculateExpectedItems(session)
      const actualItems = session.results.restoredItems

      const totalExpected = Object.values(expectedItems).reduce((sum, count) => sum + count, 0)
      const totalActual = Object.values(actualItems).reduce((sum, count) => sum + count, 0)

      if (totalActual < totalExpected * 0.9) { // 少于90%预期数据
        session.results.warnings.push('恢复的数据量少于预期')
      }

      // 验证数据完整性
      await this.validateDataIntegrity(session)

      console.log('Recovery validation completed')

    } catch (error) {
      session.results.errors.push(`恢复结果验证失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 计算预期恢复项目数
   */
  private calculateExpectedItems(session: RecoverySession): Record<string, number> {
    // 这里应该从备份数据中计算预期数量
    // 现在返回模拟数据
    return {
      cards: 10,
      folders: 3,
      tags: 5,
      images: 0,
      settings: 1
    }
  }

  /**
   * 验证数据完整性
   */
  private async validateDataIntegrity(session: RecoverySession): Promise<void> {
    // 执行数据完整性检查
    console.log('Performing data integrity validation...')

    // 模拟验证过程
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 检查是否有明显的数据问题
    if (session.results.errors.length > 5) {
      session.results.warnings.push('发现大量错误，建议检查数据完整性')
    }
  }

  /**
   * 创建恢复后快照
   */
  private async createPostRestoreSnapshot(session: RecoverySession): Promise<void> {
    try {
      const snapshotId = `snapshot_post_${session.id}`
      const snapshotData = await this.captureCurrentState()

      const snapshot: RecoverySnapshot = {
        id: snapshotId,
        name: `Post-restore snapshot for ${session.backupId}`,
        description: `Created after restoring from backup ${session.backupId}`,
        timestamp: new Date(),
        data: snapshotData,
        checksum: await this.calculateChecksum(snapshotData),
        size: JSON.stringify(snapshotData).length,
        createdDuring: session.id,
        purpose: 'post-restore'
      }

      this.snapshots.set(snapshotId, snapshot)
      this.saveSnapshots()

      console.log(`Post-restore snapshot created: ${snapshotId}`)

    } catch (error) {
      session.results.warnings.push(`无法创建恢复后快照: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 尝试回滚
   */
  private async attemptRollback(session: RecoverySession): Promise<void> {
    try {
      if (!session.snapshot) {
        session.results.errors.push('无法回滚：没有可用的快照')
        return
      }

      console.log('Attempting rollback...')

      // 执行回滚操作
      await this.restoreFromSnapshot(session.snapshot.id)

      session.results.warnings.push('已执行回滚操作，恢复到之前的状态')

    } catch (error) {
      session.results.errors.push(`回滚失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 从快照恢复
   */
  private async restoreFromSnapshot(snapshotId: string): Promise<void> {
    const snapshot = this.snapshots.get(snapshotId)
    if (!snapshot) {
      throw new Error('Snapshot not found')
    }

    console.log(`Restoring from snapshot: ${snapshotId}`)

    // 这里应该实现实际的快照恢复逻辑
    // 现在使用模拟操作
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  /**
   * 生成恢复报告
   */
  private generateRecoveryReport(session: RecoverySession): RecoveryReport {
    return {
      sessionId: session.id,
      backupId: session.backupId,
      startTime: session.startTime,
      endTime: session.endTime || new Date(),
      duration: session.duration || 0,
      status: session.status === 'completed' ? 'success' :
             session.status === 'failed' ? 'failed' : 'partial',
      summary: {
        totalItems: Object.values(session.results.restoredItems).reduce((sum, count) => sum + count, 0),
        restoredItems: Object.values(session.results.restoredItems).reduce((sum, count) => sum + count, 0),
        conflicts: session.results.conflicts.length,
        errors: session.results.errors.length,
        warnings: session.results.warnings.length
      },
      details: {
        cards: {
          total: 10,
          restored: session.results.restoredItems.cards,
          conflicts: session.results.conflicts.filter(c => c.type === 'cards').length,
          errors: session.results.errors.filter(e => e.includes('card')).length
        },
        folders: {
          total: 3,
          restored: session.results.restoredItems.folders,
          conflicts: session.results.conflicts.filter(c => c.type === 'folders').length,
          errors: session.results.errors.filter(e => e.includes('folder')).length
        },
        tags: {
          total: 5,
          restored: session.results.restoredItems.tags,
          conflicts: session.results.conflicts.filter(c => c.type === 'tags').length,
          errors: session.results.errors.filter(e => e.includes('tag')).length
        },
        images: {
          total: 0,
          restored: session.results.restoredItems.images,
          conflicts: session.results.conflicts.filter(c => c.type === 'images').length,
          errors: session.results.errors.filter(e => e.includes('image')).length
        }
      },
      performance: {
        totalTime: session.duration || 0,
        validationTime: (session.duration || 0) * 0.2,
        restoreTime: (session.duration || 0) * 0.7,
        averageSpeed: (session.duration || 0) > 0 ?
          Object.values(session.results.restoredItems).reduce((sum, count) => sum + count, 0) / ((session.duration || 0) / 1000) : 0
      },
      recommendations: this.generateRecoveryRecommendations(session)
    }
  }

  /**
   * 生成恢复建议
   */
  private generateRecoveryRecommendations(session: RecoverySession): string[] {
    const recommendations: string[] = []

    if (session.results.errors.length > 0) {
      recommendations.push('建议检查错误日志并解决相关问题')
    }

    if (session.results.conflicts.length > 5) {
      recommendations.push('发现大量冲突，建议在下次恢复前进行数据清理')
    }

    if (session.duration && session.duration > 300000) { // 超过5分钟
      recommendations.push('恢复时间较长，建议优化备份策略')
    }

    if (session.status === 'completed') {
      recommendations.push('恢复成功，建议验证数据完整性')
    }

    return recommendations
  }

  // ============================================================================
  // 快照管理
  // ============================================================================

  /**
   * 保存快照
   */
  private saveSnapshots(): void {
    try {
      const snapshots = Object.fromEntries(this.snapshots)
      localStorage.setItem('cardall-recovery-snapshots', JSON.stringify(snapshots))
    } catch (error) {
      console.error('Failed to save snapshots:', error)
    }
  }

  /**
   * 加载快照
   */
  private loadSnapshots(): void {
    try {
      const saved = localStorage.getItem('cardall-recovery-snapshots')
      if (saved) {
        const snapshots = JSON.parse(saved)
        Object.entries(snapshots).forEach(([id, snapshot]) => {
          this.snapshots.set(id, {
            ...snapshot,
            timestamp: new Date(snapshot.timestamp)
          })
        })
      }
    } catch (error) {
      console.error('Failed to load snapshots:', error)
    }
  }

  // ============================================================================
  // 灾难恢复计划管理
  // ============================================================================

  /**
   * 保存恢复计划
   */
  private saveRecoveryPlans(): void {
    try {
      const plans = Object.fromEntries(this.recoveryPlans)
      localStorage.setItem('cardall-recovery-plans', JSON.stringify(plans))
    } catch (error) {
      console.error('Failed to save recovery plans:', error)
    }
  }

  /**
   * 加载恢复计划
   */
  private loadRecoveryPlans(): void {
    try {
      const saved = localStorage.getItem('cardall-recovery-plans')
      if (saved) {
        const plans = JSON.parse(saved)
        Object.entries(plans).forEach(([id, plan]) => {
          this.recoveryPlans.set(id, {
            ...plan,
            testing: {
              ...plan.testing,
              lastTest: plan.testing.lastTest ? new Date(plan.testing.lastTest) : null,
              nextTest: new Date(plan.testing.nextTest)
            },
            lastUsed: plan.lastUsed ? new Date(plan.lastUsed) : null
          })
        })
      }
    } catch (error) {
      console.error('Failed to load recovery plans:', error)
    }
  }

  // ============================================================================
  // 公共接口方法
  // ============================================================================

  /**
   * 获取恢复会话
   */
  getRecoverySession(sessionId: string): RecoverySession | undefined {
    return this.activeSessions.get(sessionId)
  }

  /**
   * 获取所有恢复会话
   */
  getRecoverySessions(): RecoverySession[] {
    return Array.from(this.activeSessions.values())
  }

  /**
   * 取消恢复会话
   */
  async cancelRecoverySession(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId)
    if (!session) return false

    session.status = 'cancelled'
    session.endTime = new Date()
    session.duration = session.endTime.getTime() - session.startTime.getTime()

    // 尝试回滚
    if (session.options.rollback.enabled && session.snapshot) {
      await this.attemptRollback(session)
    }

    return true
  }

  /**
   * 获取快照
   */
  getSnapshot(snapshotId: string): RecoverySnapshot | undefined {
    return this.snapshots.get(snapshotId)
  }

  /**
   * 获取所有快照
   */
  getSnapshots(): RecoverySnapshot[] {
    return Array.from(this.snapshots.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * 创建手动快照
   */
  async createManualSnapshot(name: string, description?: string): Promise<RecoverySnapshot> {
    const snapshotId = `snapshot_manual_${Date.now()}`
    const snapshotData = await this.captureCurrentState()

    const snapshot: RecoverySnapshot = {
      id: snapshotId,
      name,
      description: description || 'Manual snapshot',
      timestamp: new Date(),
      data: snapshotData,
      checksum: await this.calculateChecksum(snapshotData),
      size: JSON.stringify(snapshotData).length,
      createdDuring: 'manual',
      purpose: 'manual'
    }

    this.snapshots.set(snapshotId, snapshot)
    this.saveSnapshots()

    return snapshot
  }

  /**
   * 删除快照
   */
  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    const snapshot = this.snapshots.get(snapshotId)
    if (!snapshot) return false

    this.snapshots.delete(snapshotId)
    this.saveSnapshots()

    return true
  }

  /**
   * 获取灾难恢复计划
   */
  getRecoveryPlan(planId: string): DisasterRecoveryPlan | undefined {
    return this.recoveryPlans.get(planId)
  }

  /**
   * 获取所有灾难恢复计划
   */
  getRecoveryPlans(): DisasterRecoveryPlan[] {
    return Array.from(this.recoveryPlans.values())
  }

  /**
   * 执行灾难恢复计划
   */
  async executeDisasterRecoveryPlan(planId: string): Promise<boolean> {
    const plan = this.recoveryPlans.get(planId)
    if (!plan) return false

    try {
      console.log(`Executing disaster recovery plan: ${plan.name}`)

      // 按照步骤执行恢复计划
      for (const step of plan.recoverySteps) {
        console.log(`Executing step ${step.step}: ${step.action}`)

        // 检查依赖
        const dependenciesMet = step.dependencies.every(depId =>
          plan.recoverySteps.find(s => s.step === depId)
        )

        if (!dependenciesMet) {
          throw new Error(`Dependencies not met for step ${step.step}`)
        }

        // 执行步骤
        await this.executeRecoveryStepAction(step.action)
      }

      plan.lastUsed = new Date()
      this.saveRecoveryPlans()

      console.log(`Disaster recovery plan executed successfully: ${plan.name}`)
      return true

    } catch (error) {
      console.error(`Disaster recovery plan failed: ${plan.name}`, error)
      return false
    }
  }

  /**
   * 执行恢复步骤动作
   */
  private async executeRecoveryStepAction(action: string): Promise<void> {
    console.log(`Executing recovery action: ${action}`)

    // 根据动作类型执行相应的恢复操作
    switch (action) {
      case 'validate_backup_integrity':
        // 执行备份验证
        await new Promise(resolve => setTimeout(resolve, 2000))
        break
      case 'create_pre_restore_snapshot':
        // 创建快照
        await new Promise(resolve => setTimeout(resolve, 1000))
        break
      case 'restore_core_data':
        // 恢复核心数据
        await new Promise(resolve => setTimeout(resolve, 5000))
        break
      case 'validate_restored_data':
        // 验证恢复的数据
        await new Promise(resolve => setTimeout(resolve, 1000))
        break
      case 'cleanup_and_optimize':
        // 清理和优化
        await new Promise(resolve => setTimeout(resolve, 2000))
        break
      default:
        console.warn(`Unknown recovery action: ${action}`)
    }
  }

  /**
   * 测试灾难恢复计划
   */
  async testDisasterRecoveryPlan(planId: string): Promise<boolean> {
    const plan = this.recoveryPlans.get(planId)
    if (!plan) return false

    try {
      console.log(`Testing disaster recovery plan: ${plan.name}`)

      // 模拟测试过程
      await new Promise(resolve => setTimeout(resolve, 5000))

      plan.testing.lastTest = new Date()
      plan.testing.nextTest = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      this.saveRecoveryPlans()

      console.log(`Disaster recovery plan test completed: ${plan.name}`)
      return true

    } catch (error) {
      console.error(`Disaster recovery plan test failed: ${plan.name}`, error)
      return false
    }
  }
}

// 导出单例实例
export const backupRecoveryService = new BackupRecoveryService()