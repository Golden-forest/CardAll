// ============================================================================
// 冲突状态管理器 - Phase 1 核心组件
// 解决冲突状态管理问题，提供完整的生命周期管理和持久化支持
// ============================================================================

import { type UnifiedConflict, type ConflictResolution } from './conflict-resolution-engine/unified-conflict-resolution-engine'
import { db } from '../database-unified'
import { eventBus } from '../event-bus'

// ============================================================================
// 冲突状态接口定义
// ============================================================================

export interface ConflictState {
  id: string
  entityType: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  conflictType: 'version' | 'content' | 'structure' | 'delete' | 'field'
  status: 'pending' | 'detecting' | 'resolving' | 'resolved' | 'failed' | 'manual_required'
  severity: 'low' | 'medium' | 'high' | 'critical'

  // 数据版本
  localData: any
  cloudData: any
  localVersion: number
  cloudVersion: number
  localTimestamp: Date
  cloudTimestamp: Date

  // 冲突详情
  conflictFields?: string[]
  detectionTime: number
  resolutionTime?: number

  // 解决信息
  resolution?: ConflictResolution
  resolvedAt?: Date
  resolvedBy?: 'auto' | 'user' | 'system'
  resolutionError?: string

  // 元数据
  detectedAt: Date
  sourceDevice: string
  retryCount: number
  maxRetries: number

  // 持久化信息
  persisted: boolean
  lastPersistedAt?: Date
}

export interface ConflictStateManagerConfig {
  // 持久化配置
  persistence: {
    enabled: boolean
    autoPersist: boolean
    persistInterval: number // 毫秒
    maxRetries: number
    retryDelay: number
  }

  // 状态转换配置
  transitions: {
    allowManualOverride: boolean
    autoResolveThreshold: number
    maxResolutionTime: number
  }

  // 清理配置
  cleanup: {
    resolvedRetentionDays: number
    failedRetentionDays: number
    maxConflicts: number
  }

  // 事件配置
  events: {
    emitStateChanges: boolean
    emitPersistEvents: boolean
    emitResolutionEvents: boolean
  }
}

export interface ConflictStateMetrics {
  totalConflicts: number
  pendingConflicts: number
  resolvedConflicts: number
  failedConflicts: number
  manualRequiredConflicts: number

  averageDetectionTime: number
  averageResolutionTime: number
  successRate: number

  conflictsByType: Record<string, number>
  conflictsByEntity: Record<string, number>
  resolutionsByStrategy: Record<string, number>

  persistenceStats: {
    totalPersisted: number
    persistenceFailures: number
    lastPersistTime: Date | null
  }
}

// ============================================================================
// 冲突状态管理器主类
// ============================================================================

export class ConflictStateManager {
  private states = new Map<string, ConflictState>()
  private config: ConflictStateManagerConfig
  private persistenceInterval?: NodeJS.Timeout
  private isInitialized = false
  private metrics: ConflictStateMetrics

  // 事件监听器
  private stateChangeListeners = new Set<(state: ConflictState) => void>()
  private resolutionListeners = new Set<(state: ConflictState, resolution: ConflictResolution) => void>()
  private errorListeners = new Set<(error: Error, context?: any) => void>()

  constructor(config?: Partial<ConflictStateManagerConfig>) {
    this.config = this.getDefaultConfig(config)
    this.metrics = this.getDefaultMetrics()
  }

  private getDefaultConfig(config?: Partial<ConflictStateManagerConfig>): ConflictStateManagerConfig {
    return {
      persistence: {
        enabled: true,
        autoPersist: true,
        persistInterval: 30000, // 30秒
        maxRetries: 3,
        retryDelay: 5000
      },
      transitions: {
        allowManualOverride: true,
        autoResolveThreshold: 0.8,
        maxResolutionTime: 300000 // 5分钟
      },
      cleanup: {
        resolvedRetentionDays: 7,
        failedRetentionDays: 3,
        maxConflicts: 1000
      },
      events: {
        emitStateChanges: true,
        emitPersistEvents: true,
        emitResolutionEvents: true
      },
      ...config
    }
  }

  private getDefaultMetrics(): ConflictStateMetrics {
    return {
      totalConflicts: 0,
      pendingConflicts: 0,
      resolvedConflicts: 0,
      failedConflicts: 0,
      manualRequiredConflicts: 0,
      averageDetectionTime: 0,
      averageResolutionTime: 0,
      successRate: 0,
      conflictsByType: {},
      conflictsByEntity: {},
      resolutionsByStrategy: {},
      persistenceStats: {
        totalPersisted: 0,
        persistenceFailures: 0,
        lastPersistTime: null
      }
    }
  }

  // ============================================================================
  // 初始化和配置
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // 从持久化存储恢复状态
      await this.restoreStates()

      // 启动自动持久化
      if (this.config.persistence.autoPersist) {
        this.startAutoPersist()
      }

      // 注册全局事件监听器
      this.setupEventListeners()

      this.isInitialized = true
      console.log('ConflictStateManager initialized successfully')
    } catch (error) {
      console.error('Failed to initialize ConflictStateManager:', error)
      throw error
    }
  }

  private setupEventListeners(): void {
    // 监听应用关闭事件
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.persistAllStates().catch(console.error)
      })
    }
  }

  private startAutoPersist(): void {
    if (this.persistenceInterval) {
      clearInterval(this.persistenceInterval)
    }

    this.persistenceInterval = setInterval(async () => {
      try {
        await this.persistAllStates()
      } catch (error) {
        this.handleError(error as Error, { context: 'autoPersist' })
      }
    }, this.config.persistence.persistInterval)
  }

  // ============================================================================
  // 冲突状态管理核心方法
  // ============================================================================

  /**
   * 创建新的冲突状态
   */
  async createConflict(conflict: Omit<ConflictState, 'id' | 'detectedAt' | 'retryCount' | 'persisted'>): Promise<string> {
    const stateId = crypto.randomUUID()
    const state: ConflictState = {
      ...conflict,
      id: stateId,
      detectedAt: new Date(),
      retryCount: 0,
      persisted: false
    }

    this.states.set(stateId, state)
    this.updateMetrics('created', state)

    if (this.config.events.emitStateChanges) {
      this.notifyStateChange(state)
    }

    // 立即持久化重要冲突
    if (state.severity === 'critical' || state.severity === 'high') {
      await this.persistState(stateId)
    }

    return stateId
  }

  /**
   * 更新冲突状态
   */
  async updateConflictState(
    conflictId: string,
    updates: Partial<ConflictState>,
    options?: { skipPersist?: boolean; skipValidation?: boolean }
  ): Promise<boolean> {
    const state = this.states.get(conflictId)
    if (!state) {
      console.warn(`Conflict state not found: ${conflictId}`)
      return false
    }

    // 验证状态转换
    if (!options?.skipValidation && !this.isValidStateTransition(state.status, updates.status)) {
      throw new Error(`Invalid state transition from ${state.status} to ${updates.status}`)
    }

    // 应用更新
    const oldState = { ...state }
    Object.assign(state, updates)

    // 更新指标
    if (oldState.status !== state.status) {
      this.updateMetrics('statusChanged', state, oldState.status)
    }

    if (this.config.events.emitStateChanges) {
      this.notifyStateChange(state)
    }

    // 持久化状态
    if (!options?.skipPersist) {
      await this.persistState(conflictId)
    }

    return true
  }

  /**
   * 解决冲突
   */
  async resolveConflict(
    conflictId: string,
    resolution: ConflictResolution,
    resolvedBy: 'auto' | 'user' | 'system' = 'auto'
  ): Promise<boolean> {
    const state = this.states.get(conflictId)
    if (!state) {
      console.warn(`Conflict state not found: ${conflictId}`)
      return false
    }

    const resolutionTime = performance.now() - state.detectionTime

    const updates: Partial<ConflictState> = {
      status: 'resolved',
      resolution,
      resolvedBy,
      resolvedAt: new Date(),
      resolutionTime,
      persisted: false
    }

    const success = await this.updateConflictState(conflictId, updates)

    if (success && this.config.events.emitResolutionEvents) {
      this.notifyResolutionListeners(state, resolution)
    }

    // 从待解决列表中移除
    this.removeFromPendingList(conflictId)

    return success
  }

  /**
   * 标记冲突解决失败
   */
  async markConflictFailed(
    conflictId: string,
    error: string,
    resolvedBy: 'auto' | 'user' | 'system' = 'auto'
  ): Promise<boolean> {
    const state = this.states.get(conflictId)
    if (!state) {
      console.warn(`Conflict state not found: ${conflictId}`)
      return false
    }

    const updates: Partial<ConflictState> = {
      status: 'failed',
      resolutionError: error,
      resolvedBy,
      resolvedAt: new Date(),
      persisted: false
    }

    return this.updateConflictState(conflictId, updates)
  }

  /**
   * 获取冲突状态
   */
  getConflictState(conflictId: string): ConflictState | undefined {
    return this.states.get(conflictId)
  }

  /**
   * 获取所有冲突状态
   */
  getAllConflictStates(filter?: {
    status?: ConflictState['status']
    entityType?: ConflictState['entityType']
    severity?: ConflictState['severity']
  }): ConflictState[] {
    let states = Array.from(this.states.values())

    if (filter) {
      if (filter.status) {
        states = states.filter(s => s.status === filter.status)
      }
      if (filter.entityType) {
        states = states.filter(s => s.entityType === filter.entityType)
      }
      if (filter.severity) {
        states = states.filter(s => s.severity === filter.severity)
      }
    }

    // 按检测时间排序
    return states.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
  }

  /**
   * 获取待解决的冲突
   */
  getPendingConflicts(): ConflictState[] {
    return this.getAllConflictStates({ status: 'pending' })
  }

  /**
   * 删除冲突状态
   */
  async deleteConflictState(conflictId: string): Promise<boolean> {
    const state = this.states.get(conflictId)
    if (!state) {
      return false
    }

    // 从内存中删除
    this.states.delete(conflictId)

    // 从持久化存储中删除
    await this.removePersistedState(conflictId)

    // 更新指标
    this.updateMetrics('deleted', state)

    return true
  }

  // ============================================================================
  // 状态持久化
  // ============================================================================

  /**
   * 持久化单个冲突状态
   */
  async persistState(conflictId: string): Promise<boolean> {
    if (!this.config.persistence.enabled) {
      return true
    }

    const state = this.states.get(conflictId)
    if (!state) {
      return false
    }

    try {
      const serializedState = this.serializeState(state)

      // 使用IndexedDB存储
      if (db.conflictStates) {
        await db.conflictStates.put({
          id: conflictId,
          state: serializedState,
          timestamp: Date.now()
        })
      }

      // 备份到localStorage（可选）
      if (this.shouldBackupToLocalStorage()) {
        this.backupToLocalStorage(conflictId, serializedState)
      }

      // 更新状态
      state.persisted = true
      state.lastPersistedAt = new Date()

      // 更新持久化统计
      this.metrics.persistenceStats.totalPersisted++
      this.metrics.persistenceStats.lastPersistTime = new Date()

      if (this.config.events.emitPersistEvents) {
        eventBus.emit('conflict-state-persisted', { conflictId, state })
      }

      return true
    } catch (error) {
      this.metrics.persistenceStats.persistenceFailures++
      this.handleError(error as Error, {
        context: 'persistState',
        conflictId
      })
      return false
    }
  }

  /**
   * 持久化所有冲突状态
   */
  async persistAllStates(): Promise<void> {
    if (!this.config.persistence.enabled) {
      return
    }

    const persistPromises = Array.from(this.states.keys()).map(conflictId =>
      this.persistState(conflictId)
    )

    await Promise.allSettled(persistPromises)
  }

  /**
   * 恢复冲突状态
   */
  private async restoreStates(): Promise<void> {
    if (!this.config.persistence.enabled) {
      return
    }

    try {
      // 从IndexedDB恢复
      if (db.conflictStates) {
        const persistedStates = await db.conflictStates.toArray()

        for (const persisted of persistedStates) {
          try {
            const state = this.deserializeState(persisted.state)
            this.states.set(persisted.id, state)
          } catch (error) {
            console.error(`Failed to restore conflict state ${persisted.id}:`, error)
          }
        }
      }

      // 从localStorage备份恢复（如果IndexedDB失败）
      if (this.states.size === 0) {
        await this.restoreFromLocalStorage()
      }

      // 清理过期的持久化数据
      await this.cleanupPersistedStates()

      console.log(`Restored ${this.states.size} conflict states`)
    } catch (error) {
      console.error('Failed to restore conflict states:', error)
    }
  }

  /**
   * 移除持久化的冲突状态
   */
  private async removePersistedState(conflictId: string): Promise<void> {
    try {
      if (db.conflictStates) {
        await db.conflictStates.delete(conflictId)
      }

      // 清理localStorage备份
      localStorage.removeItem(`conflict_state_${conflictId}`)
    } catch (error) {
      console.error(`Failed to remove persisted state ${conflictId}:`, error)
    }
  }

  /**
   * 清理过期的持久化数据
   */
  private async cleanupPersistedStates(): Promise<void> {
    try {
      const now = Date.now()
      const cutoffTime = now - (this.config.cleanup.resolvedRetentionDays * 24 * 60 * 60 * 1000)

      if (db.conflictStates) {
        const expiredStates = await db.conflictStates
          .where('timestamp')
          .below(cutoffTime)
          .toArray()

        for (const expired of expiredStates) {
          await db.conflictStates.delete(expired.id)
        }
      }
    } catch (error) {
      console.error('Failed to cleanup persisted states:', error)
    }
  }

  // ============================================================================
  // 状态转换验证
  // ============================================================================

  private isValidStateTransition(currentStatus: ConflictState['status'], newStatus?: ConflictState['status']): boolean {
    if (!newStatus || newStatus === currentStatus) {
      return true
    }

    const validTransitions: Record<ConflictState['status'], ConflictState['status'][]> = {
      'pending': ['detecting', 'resolving', 'manual_required', 'resolved', 'failed'],
      'detecting': ['resolving', 'manual_required', 'resolved', 'failed'],
      'resolving': ['resolved', 'failed', 'manual_required'],
      'manual_required': ['resolved', 'failed'],
      'resolved': [], // 终态
      'failed': ['pending', 'resolved'] // 可以重试或手动解决
    }

    return validTransitions[currentStatus]?.includes(newStatus) || false
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private serializeState(state: ConflictState): any {
    return {
      ...state,
      detectedAt: state.detectedAt.toISOString(),
      localTimestamp: state.localTimestamp.toISOString(),
      cloudTimestamp: state.cloudTimestamp.toISOString(),
      resolvedAt: state.resolvedAt?.toISOString(),
      lastPersistedAt: state.lastPersistedAt?.toISOString()
    }
  }

  private deserializeState(serialized: any): ConflictState {
    return {
      ...serialized,
      detectedAt: new Date(serialized.detectedAt),
      localTimestamp: new Date(serialized.localTimestamp),
      cloudTimestamp: new Date(serialized.cloudTimestamp),
      resolvedAt: serialized.resolvedAt ? new Date(serialized.resolvedAt) : undefined,
      lastPersistedAt: serialized.lastPersistedAt ? new Date(serialized.lastPersistedAt) : undefined
    }
  }

  private shouldBackupToLocalStorage(): boolean {
    // 在低存储空间时使用localStorage作为备份
    try {
      const testKey = 'test_storage'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }

  private backupToLocalStorage(conflictId: string, state: any): void {
    try {
      localStorage.setItem(`conflict_state_${conflictId}`, JSON.stringify(state))
    } catch (error) {
      console.warn(`Failed to backup conflict state to localStorage: ${error}`)
    }
  }

  private async restoreFromLocalStorage(): Promise<void> {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('conflict_state_')) {
          const conflictId = key.replace('conflict_state_', '')
          const serialized = localStorage.getItem(key)

          if (serialized) {
            try {
              const state = this.deserializeState(JSON.parse(serialized))
              this.states.set(conflictId, state)
            } catch (error) {
              console.error(`Failed to restore conflict state from localStorage: ${error}`)
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to restore from localStorage:', error)
    }
  }

  private removeFromPendingList(conflictId: string): void {
    // 从UI组件的待解决列表中移除
    eventBus.emit('conflict-resolved', { conflictId })
  }

  // ============================================================================
  // 指标管理
  // ============================================================================

  private updateMetrics(
    action: 'created' | 'deleted' | 'statusChanged',
    state: ConflictState,
    oldStatus?: ConflictState['status']
  ): void {
    switch (action) {
      case 'created':
        this.metrics.totalConflicts++
        this.updateConflictsByType(state)
        this.updateConflictsByEntity(state)
        if (state.status === 'pending') {
          this.metrics.pendingConflicts++
        }
        break

      case 'deleted':
        this.metrics.totalConflicts--
        if (state.status === 'pending') {
          this.metrics.pendingConflicts--
        }
        break

      case 'statusChanged':
        if (oldStatus === 'pending') {
          this.metrics.pendingConflicts--
        }
        if (state.status === 'pending') {
          this.metrics.pendingConflicts++
        }
        if (state.status === 'resolved') {
          this.metrics.resolvedConflicts++
          if (state.resolutionTime) {
            this.updateAverageResolutionTime(state.resolutionTime)
          }
          if (state.resolution) {
            this.updateResolutionsByStrategy(state.resolution)
          }
        }
        if (state.status === 'failed') {
          this.metrics.failedConflicts++
        }
        if (state.status === 'manual_required') {
          this.metrics.manualRequiredConflicts++
        }
        break
    }

    // 更新成功率
    const total = this.metrics.resolvedConflicts + this.metrics.failedConflicts
    if (total > 0) {
      this.metrics.successRate = this.metrics.resolvedConflicts / total
    }
  }

  private updateConflictsByType(state: ConflictState): void {
    const type = state.conflictType
    this.metrics.conflictsByType[type] = (this.metrics.conflictsByType[type] || 0) + 1
  }

  private updateConflictsByEntity(state: ConflictState): void {
    const entity = state.entityType
    this.metrics.conflictsByEntity[entity] = (this.metrics.conflictsByEntity[entity] || 0) + 1
  }

  private updateResolutionsByStrategy(resolution: ConflictResolution): void {
    const strategy = resolution.strategy
    this.metrics.resolutionsByStrategy[strategy] = (this.metrics.resolutionsByStrategy[strategy] || 0) + 1
  }

  private updateAverageResolutionTime(newTime: number): void {
    const total = this.metrics.resolvedConflicts
    const current = this.metrics.averageResolutionTime * (total - 1)
    this.metrics.averageResolutionTime = (current + newTime) / total
  }

  // ============================================================================
  // 事件通知
  // ============================================================================

  private notifyStateChange(state: ConflictState): void {
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(state)
      } catch (error) {
        console.error('Error in state change listener:', error)
      }
    })
  }

  private notifyResolutionListeners(state: ConflictState, resolution: ConflictResolution): void {
    this.resolutionListeners.forEach(listener => {
      try {
        listener(state, resolution)
      }
      catch (error) {
        console.error('Error in resolution listener:', error)
      }
    })
  }

  private handleError(error: Error, context?: any): void {
    console.error('ConflictStateManager error:', error, context)

    this.errorListeners.forEach(listener => {
      try {
        listener(error, context)
      } catch (err) {
        console.error('Error in error listener:', err)
      }
    })
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取状态管理器指标
   */
  getMetrics(): ConflictStateMetrics {
    return { ...this.metrics }
  }

  /**
   * 添加状态变化监听器
   */
  onStateChange(callback: (state: ConflictState) => void): () => void {
    this.stateChangeListeners.add(callback)
    return () => this.stateChangeListeners.delete(callback)
  }

  /**
   * 添加解决事件监听器
   */
  onResolution(callback: (state: ConflictState, resolution: ConflictResolution) => void): () => void {
    this.resolutionListeners.add(callback)
    return () => this.resolutionListeners.delete(callback)
  }

  /**
   * 添加错误监听器
   */
  onError(callback: (error: Error, context?: any) => void): () => void {
    this.errorListeners.add(callback)
    return () => this.errorListeners.delete(callback)
  }

  /**
   * 清理资源
   */
  async destroy(): Promise<void> {
    // 停止自动持久化
    if (this.persistenceInterval) {
      clearInterval(this.persistenceInterval)
    }

    // 持久化所有状态
    await this.persistAllStates()

    // 清理监听器
    this.stateChangeListeners.clear()
    this.resolutionListeners.clear()
    this.errorListeners.clear()

    // 清理状态
    this.states.clear()

    this.isInitialized = false
    console.log('ConflictStateManager destroyed')
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const conflictStateManager = new ConflictStateManager()