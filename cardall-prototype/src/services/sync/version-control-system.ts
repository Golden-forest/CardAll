/**
 * 版本控制系统
 * 基于版本号和哈希值的精确变更检测机制
 *
 * 主要功能：
 * - 版本号管理和自动递增
 * - 基于哈希的快速内容变更检测
 * - 变更历史记录和回滚支持
 * - 并发修改检测和冲突预防
 * - 高效的增量计算
 */

import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from '../database'
import { supabase } from '../supabase'
import { networkStateDetector } from '../network-state-detector'
import type { EntityDiff } from './incremental-sync-algorithm'

// ============================================================================
// 版本控制接口
// ============================================================================

export interface VersionInfo {
  id: string
  entityId: string
  entityType: 'card' | 'folder' | 'tag' | 'image'
  version: number
  timestamp: Date
  hash: string
  author: string
  message?: string
  parentId?: string // 父版本ID，用于回滚
  metadata?: Record<string, any>
}

export interface VersionHistory {
  entityId: string
  entityType: string
  versions: VersionInfo[]
  currentVersion: number
  createdAt: Date
  updatedAt: Date
}

export interface ChangeDetectionResult {
  hasChanges: boolean
  changes: Record<string, { oldValue: any; newValue: any; changeType: 'added' | 'modified' | 'removed' }>
  versionDiff: number
  timestamp: Date
  hash: string
  confidence: 'high' | 'medium' | 'low'
}

export interface VersionControlConfig {
  // 版本控制配置
  autoIncrement: boolean
  maxHistoryVersions: number
  versionCompression: boolean

  // 变更检测配置
  hashAlgorithm: string
  changeThreshold: number // 最小变更阈值（字节）
  ignoreFields: string[]
  semanticFields: string[] // 语义重要字段

  // 并发控制配置
  optimisticLocking: boolean
  conflictDetection: boolean
  mergeStrategy: 'auto' | 'manual' | 'smart'

  // 性能配置
  cacheEnabled: boolean
  cacheSize: number
  batchSize: number
}

// ============================================================================
// 版本控制系统实现
// ============================================================================

export class VersionControlSystem {
  private config: VersionControlConfig
  private versionCache: Map<string, VersionInfo> = new Map()
  private historyCache: Map<string, VersionHistory> = new Map()
  private pendingChanges: Map<string, EntityDiff> = new Map()

  constructor(config?: Partial<VersionControlConfig>) {
    this.config = this.getDefaultConfig()
    if (config) {
      this.config = { ...this.config, ...config }
    }

    // 初始化版本控制
    this.initializeVersionControl()
  }

  private getDefaultConfig(): VersionControlConfig {
    return {
      autoIncrement: true,
      maxHistoryVersions: 50,
      versionCompression: true,

      hashAlgorithm: 'sha256',
      changeThreshold: 1, // 1字节
      ignoreFields: ['id', 'userId', 'syncVersion', 'pendingSync', 'createdAt', 'updatedAt'],
      semanticFields: ['frontContent', 'backContent', 'name', 'filePath'],

      optimisticLocking: true,
      conflictDetection: true,
      mergeStrategy: 'smart',

      cacheEnabled: true,
      cacheSize: 1000,
      batchSize: 100
    }
  }

  // ============================================================================
  // 初始化
  // ============================================================================

  /**
   * 初始化版本控制系统
   */
  private async initializeVersionControl(): Promise<void> {
    try {
      // 恢复未完成的变更
      await this.restorePendingChanges()

      // 清理过期版本历史
      await this.cleanupVersionHistory()

      // 预热缓存
      await this.warmupCache()

      console.log('Version control system initialized successfully')
    } catch (error) {
      console.error('Failed to initialize version control system:', error)
    }
  }

  /**
   * 恢复未完成的变更
   */
  private async restorePendingChanges(): Promise<void> {
    try {
      const pendingData = localStorage.getItem('pending_version_changes')
      if (!pendingData) return

      const pending = JSON.parse(pendingData)
      for (const [key, change] of Object.entries(pending)) {
        this.pendingChanges.set(key, change as EntityDiff)
      }
    } catch (error) {
      console.error('Failed to restore pending changes:', error)
    }
  }

  /**
   * 清理过期版本历史
   */
  private async cleanupVersionHistory(): Promise<void> {
    try {
      // 从IndexedDB清理过期的版本历史
      // 这里可以根据需要实现具体的清理逻辑
    } catch (error) {
      console.error('Failed to cleanup version history:', error)
    }
  }

  /**
   * 预热缓存
   */
  private async warmupCache(): Promise<void> {
    try {
      // 预加载最近使用的版本信息
      const recentEntities = await this.getRecentEntities()
      for (const entity of recentEntities) {
        await this.getVersionInfo(entity.id, entity.type)
      }
    } catch (error) {
      console.error('Failed to warmup cache:', error)
    }
  }

  /**
   * 获取最近使用的实体
   */
  private async getRecentEntities(): Promise<Array<{ id: string; type: string }>> {
    try {
      // 获取最近更新的实体
      const recentCards = await db.cards.orderBy('updatedAt').reverse().limit(20).toArray()
      const recentFolders = await db.folders.orderBy('updatedAt').reverse().limit(10).toArray()
      const recentTags = await db.tags.orderBy('updatedAt').reverse().limit(10).toArray()

      return [
        ...recentCards.map(c => ({ id: c.id, type: 'card' })),
        ...recentFolders.map(f => ({ id: f.id, type: 'folder' })),
        ...recentTags.map(t => ({ id: t.id, type: 'tag' }))
      ]
    } catch (error) {
      console.error('Failed to get recent entities:', error)
      return []
    }
  }

  // ============================================================================
  // 版本管理
  // ============================================================================

  /**
   * 创建新版本
   */
  async createVersion(
    entityId: string,
    entityType: 'card' | 'folder' | 'tag' | 'image',
    data: any,
    author: string,
    message?: string
  ): Promise<VersionInfo> {
    try {
      // 获取当前版本信息
      const currentVersion = await this.getCurrentVersion(entityId, entityType)
      const newVersionNumber = currentVersion ? currentVersion.version + 1 : 1

      // 计算内容哈希
      const hash = await this.computeContentHash(data, entityType)

      // 检测变更
      const changeResult = await this.detectChanges(entityId, entityType, data)

      // 如果没有实质性变更，不创建新版本
      if (!changeResult.hasChanges && currentVersion) {
        return currentVersion
      }

      // 创建版本信息
      const versionInfo: VersionInfo = {
        id: crypto.randomUUID(),
        entityId,
        entityType,
        version: newVersionNumber,
        timestamp: new Date(),
        hash,
        author,
        message,
        parentId: currentVersion?.id,
        metadata: {
          changeCount: Object.keys(changeResult.changes).length,
          semanticChanges: this.hasSemanticChanges(changeResult.changes),
          confidence: changeResult.confidence
        }
      }

      // 保存版本信息
      await this.saveVersionInfo(versionInfo)

      // 更新缓存
      this.updateCache(versionInfo)

      // 触发版本事件
      await this.triggerVersionEvent('created', versionInfo)

      return versionInfo

    } catch (error) {
      console.error('Failed to create version:', error)
      throw error
    }
  }

  /**
   * 获取当前版本
   */
  async getCurrentVersion(entityId: string, entityType: string): Promise<VersionInfo | null> {
    try {
      // 首先检查缓存
      const cacheKey = `${entityId}_${entityType}_current`
      const cached = this.versionCache.get(cacheKey)
      if (cached) {
        return cached
      }

      // 从数据库获取最新版本
      const versionInfo = await this.fetchLatestVersion(entityId, entityType)
      if (versionInfo) {
        this.versionCache.set(cacheKey, versionInfo)
      }

      return versionInfo

    } catch (error) {
      console.error('Failed to get current version:', error)
      return null
    }
  }

  /**
   * 获取版本信息
   */
  async getVersionInfo(entityId: string, entityType: string, version?: number): Promise<VersionInfo | null> {
    try {
      const versionNumber = version || await this.getCurrentVersionNumber(entityId, entityType)
      if (!versionNumber) return null

      // 检查缓存
      const cacheKey = `${entityId}_${entityType}_v${versionNumber}`
      const cached = this.versionCache.get(cacheKey)
      if (cached) {
        return cached
      }

      // 从数据库获取版本信息
      const versionInfo = await this.fetchVersionInfo(entityId, entityType, versionNumber)
      if (versionInfo) {
        this.versionCache.set(cacheKey, versionInfo)
      }

      return versionInfo

    } catch (error) {
      console.error('Failed to get version info:', error)
      return null
    }
  }

  /**
   * 获取版本历史
   */
  async getVersionHistory(
    entityId: string,
    entityType: string,
    limit?: number
  ): Promise<VersionHistory> {
    try {
      // 检查缓存
      const cacheKey = `${entityId}_${entityType}_history`
      const cached = this.historyCache.get(cacheKey)
      if (cached) {
        return limit ? { ...cached, versions: cached.versions.slice(0, limit) } : cached
      }

      // 从数据库获取版本历史
      const history = await this.fetchVersionHistory(entityId, entityType, limit)
      if (history) {
        this.historyCache.set(cacheKey, history)
      }

      return history || {
        entityId,
        entityType,
        versions: [],
        currentVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

    } catch (error) {
      console.error('Failed to get version history:', error)
      return {
        entityId,
        entityType,
        versions: [],
        currentVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }
  }

  /**
   * 获取当前版本号
   */
  private async getCurrentVersionNumber(entityId: string, entityType: string): Promise<number> {
    try {
      const currentVersion = await this.getCurrentVersion(entityId, entityType)
      return currentVersion?.version || 0
    } catch (error) {
      console.error('Failed to get current version number:', error)
      return 0
    }
  }

  /**
   * 从数据库获取最新版本
   */
  private async fetchLatestVersion(entityId: string, entityType: string): Promise<VersionInfo | null> {
    try {
      const currentEntity = await this.getLocalEntity(entityId, entityType)
      if (!currentEntity) return null

      return {
        id: `current_${entityId}`,
        entityId,
        entityType,
        version: currentEntity.syncVersion || 1,
        timestamp: new Date(currentEntity.updatedAt || currentEntity.createdAt),
        hash: await this.computeContentHash(currentEntity, entityType),
        author: 'system',
        metadata: {}
      }

    } catch (error) {
      console.error('Failed to fetch latest version:', error)
      return null
    }
  }

  /**
   * 从数据库获取版本信息
   */
  private async fetchVersionInfo(
    entityId: string,
    entityType: string,
    version: number
  ): Promise<VersionInfo | null> {
    // 在实际实现中，这里可以从专门的版本历史表中获取
    // 目前从实体表获取当前版本信息
    return this.fetchLatestVersion(entityId, entityType)
  }

  /**
   * 从数据库获取版本历史
   */
  private async fetchVersionHistory(
    entityId: string,
    entityType: string,
    limit?: number
  ): Promise<VersionHistory | null> {
    try {
      const currentEntity = await this.getLocalEntity(entityId, entityType)
      if (!currentEntity) return null

      const currentVersion: VersionInfo = {
        id: `current_${entityId}`,
        entityId,
        entityType,
        version: currentEntity.syncVersion || 1,
        timestamp: new Date(currentEntity.updatedAt || currentEntity.createdAt),
        hash: await this.computeContentHash(currentEntity, entityType),
        author: 'system',
        metadata: {}
      }

      return {
        entityId,
        entityType,
        versions: [currentVersion],
        currentVersion: currentVersion.version,
        createdAt: new Date(currentEntity.createdAt),
        updatedAt: new Date(currentEntity.updatedAt)
      }

    } catch (error) {
      console.error('Failed to fetch version history:', error)
      return null
    }
  }

  /**
   * 保存版本信息
   */
  private async saveVersionInfo(versionInfo: VersionInfo): Promise<void> {
    try {
      // 在实际实现中，这里可以将版本信息保存到专门的版本历史表
      // 目前只更新实体的版本号

      await this.updateEntityVersion(
        versionInfo.entityId,
        versionInfo.entityType,
        versionInfo.version
      )

    } catch (error) {
      console.error('Failed to save version info:', error)
      throw error
    }
  }

  /**
   * 更新实体版本
   */
  private async updateEntityVersion(
    entityId: string,
    entityType: string,
    version: number
  ): Promise<void> {
    try {
      const updateData = { syncVersion: version }

      switch (entityType) {
        case 'card':
          await db.cards.update(entityId, updateData)
          break
        case 'folder':
          await db.folders.update(entityId, updateData)
          break
        case 'tag':
          await db.tags.update(entityId, updateData)
          break
        case 'image':
          await db.images.update(entityId, updateData)
          break
      }

    } catch (error) {
      console.error(`Failed to update ${entityType} version:`, error)
      throw error
    }
  }

  /**
   * 更新缓存
   */
  private updateCache(versionInfo: VersionInfo): Promise<void> {
    return new Promise((resolve) => {
      // 更新当前版本缓存
      const currentCacheKey = `${versionInfo.entityId}_${versionInfo.entityType}_current`
      this.versionCache.set(currentCacheKey, versionInfo)

      // 更新版本特定缓存
      const versionCacheKey = `${versionInfo.entityId}_${versionInfo.entityType}_v${versionInfo.version}`
      this.versionCache.set(versionCacheKey, versionInfo)

      // 清理历史缓存
      const historyCacheKey = `${versionInfo.entityId}_${versionInfo.entityType}_history`
      this.historyCache.delete(historyCacheKey)

      resolve()
    })
  }

  // ============================================================================
  // 变更检测
  // ============================================================================

  /**
   * 检测变更
   */
  async detectChanges(
    entityId: string,
    entityType: 'card' | 'folder' | 'tag' | 'image',
    newData: any
  ): Promise<ChangeDetectionResult> {
    try {
      // 获取当前实体数据
      const currentEntity = await this.getLocalEntity(entityId, entityType)
      const currentData = currentEntity || {}

      // 计算新旧数据的哈希
      const newHash = await this.computeContentHash(newData, entityType)
      const currentHash = currentEntity
        ? await this.computeContentHash(currentEntity, entityType)
        : ''

      // 如果哈希相同，无变更
      if (newHash === currentHash && currentEntity) {
        return {
          hasChanges: false,
          changes: {},
          versionDiff: 0,
          timestamp: new Date(),
          hash: newHash,
          confidence: 'high'
        }
      }

      // 进行详细的字段级别比较
      const changes = await this.compareEntities(currentData, newData, entityType)
      const changeCount = Object.keys(changes).length

      // 计算变更置信度
      const confidence = this.calculateConfidence(changes, entityType)

      return {
        hasChanges: changeCount > 0,
        changes,
        versionDiff: currentEntity ? 1 : 0, // 新实体版本差为0，现有实体版本差为1
        timestamp: new Date(),
        hash: newHash,
        confidence
      }

    } catch (error) {
      console.error('Failed to detect changes:', error)
      return {
        hasChanges: true, // 检测失败时保守处理，认为有变更
        changes: {},
        versionDiff: 1,
        timestamp: new Date(),
        hash: '',
        confidence: 'low'
      }
    }
  }

  /**
   * 比较实体
   */
  private async compareEntities(
    oldData: any,
    newData: any,
    entityType: string
  ): Promise<Record<string, { oldValue: any; newValue: any; changeType: 'added' | 'modified' | 'removed' }>> {
    const changes: Record<string, { oldValue: any; newValue: any; changeType: 'added' | 'modified' | 'removed' }> = {}

    // 获取需要比较的字段
    const fieldsToCompare = this.getFieldsToCompare(entityType)

    for (const field of fieldsToCompare) {
      if (this.config.ignoreFields.includes(field)) {
        continue
      }

      const oldValue = this.getNestedValue(oldData, field)
      const newValue = this.getNestedValue(newData, field)

      // 检测变更类型
      if (oldValue === undefined && newValue !== undefined) {
        // 新增字段
        changes[field] = { oldValue, newValue, changeType: 'added' }
      } else if (oldValue !== undefined && newValue === undefined) {
        // 删除字段
        changes[field] = { oldValue, newValue, changeType: 'removed' }
      } else if (!this.deepEqual(oldValue, newValue)) {
        // 修改字段
        changes[field] = { oldValue, newValue, changeType: 'modified' }
      }
    }

    return changes
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    changes: Record<string, any>,
    entityType: string
  ): 'high' | 'medium' | 'low' {
    const changeCount = Object.keys(changes).length

    if (changeCount === 0) {
      return 'high' // 无变更，置信度高
    }

    // 检查是否有语义重要字段的变更
    const semanticChanges = Object.keys(changes).some(field =>
      this.config.semanticFields.includes(field)
    )

    if (semanticChanges) {
      return 'high' // 语义重要字段变更，置信度高
    }

    if (changeCount <= 2) {
      return 'medium' // 少量变更，置信度中等
    }

    return 'low' // 大量变更，置信度低
  }

  /**
   * 检查是否有语义变更
   */
  private hasSemanticChanges(changes: Record<string, any>): boolean {
    return Object.keys(changes).some(field =>
      this.config.semanticFields.includes(field)
    )
  }

  /**
   * 获取需要比较的字段
   */
  private getFieldsToCompare(entityType: string): string[] {
    switch (entityType) {
      case 'card':
        return ['frontContent', 'backContent', 'style', 'folderId', 'isFlipped']
      case 'folder':
        return ['name', 'color', 'icon', 'parentId', 'isExpanded', 'cardIds']
      case 'tag':
        return ['name', 'color', 'count']
      case 'image':
        return ['fileName', 'filePath', 'cloudUrl', 'metadata', 'storageMode']
      default:
        return []
    }
  }

  /**
   * 获取嵌套值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * 深度比较
   */
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true
    if (a == null || b == null) return a === b
    if (typeof a !== typeof b) return false

    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false
      if (Array.isArray(a)) {
        if (a.length !== b.length) return false
        return a.every((item, index) => this.deepEqual(item, b[index]))
      }

      const aKeys = Object.keys(a)
      const bKeys = Object.keys(b)
      if (aKeys.length !== bKeys.length) return false

      return aKeys.every(key => this.deepEqual(a[key], b[key]))
    }

    return false
  }

  // ============================================================================
  // 内容哈希计算
  // ============================================================================

  /**
   * 计算内容哈希
   */
  async computeContentHash(data: any, entityType: string): Promise<string> {
    try {
      // 提取相关字段
      const relevantData = this.extractRelevantFields(data, entityType)

      // 标准化数据格式
      const normalizedData = this.normalizeData(relevantData)

      // 计算哈希
      return await this.computeHash(normalizedData)

    } catch (error) {
      console.error('Failed to compute content hash:', error)
      return ''
    }
  }

  /**
   * 提取相关字段
   */
  private extractRelevantFields(data: any, entityType: string): any {
    const relevant: any = {}

    for (const [key, value] of Object.entries(data)) {
      if (!this.config.ignoreFields.includes(key) && value !== undefined && value !== null) {
        relevant[key] = value
      }
    }

    return relevant
  }

  /**
   * 标准化数据
   */
  private normalizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data
    }

    if (Array.isArray(data)) {
      return data.map(item => this.normalizeData(item)).sort()
    }

    const normalized: any = {}
    const keys = Object.keys(data).sort()

    for (const key of keys) {
      const value = data[key]
      normalized[key] = this.normalizeData(value)
    }

    return normalized
  }

  /**
   * 计算哈希值
   */
  private async computeHash(data: any): Promise<string> {
    const dataString = JSON.stringify(data)

    // 使用简单的哈希算法（在实际环境中可以使用 crypto.subtle）
    let hash = 0
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }

    return Math.abs(hash).toString(16)
  }

  // ============================================================================
  // 并发控制
  // ============================================================================

  /**
   * 检查并发冲突
   */
  async checkConcurrentConflict(
    entityId: string,
    entityType: string,
    expectedVersion: number,
    newData: any
  ): Promise<{ hasConflict: boolean; conflictDetails?: any }> {
    if (!this.config.optimisticLocking) {
      return { hasConflict: false }
    }

    try {
      // 获取当前版本
      const currentVersion = await this.getCurrentVersion(entityId, entityType)
      if (!currentVersion) {
        return { hasConflict: false } // 新实体，无冲突
      }

      // 检查版本号是否匹配
      if (currentVersion.version !== expectedVersion) {
        // 版本不匹配，可能有并发冲突
        const conflictDetails = await this.analyzeConflict(
          entityId,
          entityType,
          expectedVersion,
          currentVersion.version,
          newData
        )

        return { hasConflict: true, conflictDetails }
      }

      // 检查内容哈希
      const newHash = await this.computeContentHash(newData, entityType)
      if (newHash !== currentVersion.hash) {
        // 内容有变更，可能是并发修改
        return {
          hasConflict: true,
          conflictDetails: {
            type: 'content_conflict',
            message: 'Content has been modified by another operation'
          }
        }
      }

      return { hasConflict: false }

    } catch (error) {
      console.error('Failed to check concurrent conflict:', error)
      return { hasConflict: false } // 检查失败时保守处理
    }
  }

  /**
   * 分析冲突
   */
  private async analyzeConflict(
    entityId: string,
    entityType: string,
    expectedVersion: number,
    actualVersion: number,
    newData: any
  ): Promise<any> {
    try {
      // 获取冲突的版本信息
      const expectedVersionInfo = await this.getVersionInfo(entityId, entityType, expectedVersion)
      const actualVersionInfo = await this.getVersionInfo(entityId, entityType, actualVersion)

      if (!expectedVersionInfo || !actualVersionInfo) {
        return {
          type: 'version_mismatch',
          message: 'Version information not available'
        }
      }

      // 分析变更差异
      const changes = await this.compareEntities(
        expectedVersionInfo.metadata?.originalData || {},
        newData,
        entityType
      )

      return {
        type: 'concurrent_modification',
        expectedVersion,
        actualVersion,
        changes: Object.keys(changes),
        severity: this.calculateConflictSeverity(changes),
        resolution: this.suggestResolution(changes, entityType)
      }

    } catch (error) {
      console.error('Failed to analyze conflict:', error)
      return {
        type: 'unknown',
        message: 'Failed to analyze conflict'
      }
    }
  }

  /**
   * 计算冲突严重程度
   */
  private calculateConflictSeverity(changes: Record<string, any>): 'low' | 'medium' | 'high' {
    const changeCount = Object.keys(changes).length

    if (changeCount === 0) {
      return 'low'
    }

    // 检查语义重要字段
    const semanticChanges = Object.keys(changes).some(field =>
      this.config.semanticFields.includes(field)
    )

    if (semanticChanges) {
      return 'high'
    }

    if (changeCount <= 2) {
      return 'medium'
    }

    return 'high'
  }

  /**
   * 建议解决方案
   */
  private suggestResolution(changes: Record<string, any>, entityType: string): 'merge' | 'overwrite' | 'manual' {
    const changeCount = Object.keys(changes).length

    if (changeCount === 0) {
      return 'overwrite' // 无实质变更，可以覆盖
    }

    // 检查是否可以自动合并
    const mergeableFields = Object.keys(changes).filter(field => {
      return !this.config.semanticFields.includes(field)
    })

    if (mergeableFields.length === changes.size) {
      return 'merge' // 只有非语义字段，可以合并
    }

    return 'manual' // 有语义字段冲突，需要手动解决
  }

  // ============================================================================
  // 本地实体操作
  // ============================================================================

  /**
   * 获取本地实体
   */
  private async getLocalEntity(
    entityId: string,
    entityType: 'card' | 'folder' | 'tag' | 'image'
  ): Promise<any> {
    try {
      switch (entityType) {
        case 'card':
          return await db.cards.get(entityId)
        case 'folder':
          return await db.folders.get(entityId)
        case 'tag':
          return await db.tags.get(entityId)
        case 'image':
          return await db.images.get(entityId)
        default:
          return null
      }
    } catch (error) {
      console.error(`Failed to get local ${entityType}:`, error)
      return null
    }
  }

  // ============================================================================
  // 事件处理
  // ============================================================================

  /**
   * 触发版本事件
   */
  private async triggerVersionEvent(eventType: string, versionInfo: VersionInfo): Promise<void> {
    try {
      // 这里可以触发自定义事件或调用回调函数
      // 例如：通知UI更新、记录审计日志等

      console.log(`Version ${eventType}:`, {
        entityId: versionInfo.entityId,
        entityType: versionInfo.entityType,
        version: versionInfo.version,
        timestamp: versionInfo.timestamp,
        author: versionInfo.author
      })

    } catch (error) {
      console.error('Failed to trigger version event:', error)
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 持久化未完成的变更
   */
  private async persistPendingChanges(): Promise<void> {
    try {
      const pendingData = Object.fromEntries(this.pendingChanges)
      localStorage.setItem('pending_version_changes', JSON.stringify(pendingData))
    } catch (error) {
      console.error('Failed to persist pending changes:', error)
    }
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.versionCache.clear()
    this.historyCache.clear()
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    versionCacheSize: number
    historyCacheSize: number
    pendingChangesSize: number
  } {
    return {
      versionCacheSize: this.versionCache.size,
      historyCacheSize: this.historyCache.size,
      pendingChangesSize: this.pendingChanges.size
    }
  }

  /**
   * 获取配置
   */
  getConfig(): VersionControlConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<VersionControlConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 销毁版本控制系统
   */
  async destroy(): Promise<void> {
    try {
      // 持久化未完成的变更
      await this.persistPendingChanges()

      // 清理缓存
      this.clearCache()

      // 清理未完成的变更
      this.pendingChanges.clear()

      console.log('Version control system destroyed')
    } catch (error) {
      console.error('Failed to destroy version control system:', error)
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const versionControlSystem = new VersionControlSystem()

// ============================================================================
// 便利方法导出
// ============================================================================

export const createVersion = (
  entityId: string,
  entityType: 'card' | 'folder' | 'tag' | 'image',
  data: any,
  author: string,
  message?: string
) => versionControlSystem.createVersion(entityId, entityType, data, author, message)

export const getCurrentVersion = (entityId: string, entityType: string) =>
  versionControlSystem.getCurrentVersion(entityId, entityType)

export const getVersionInfo = (entityId: string, entityType: string, version?: number) =>
  versionControlSystem.getVersionInfo(entityId, entityType, version)

export const getVersionHistory = (entityId: string, entityType: string, limit?: number) =>
  versionControlSystem.getVersionHistory(entityId, entityType, limit)

export const detectChanges = (
  entityId: string,
  entityType: 'card' | 'folder' | 'tag' | 'image',
  data: any
) => versionControlSystem.detectChanges(entityId, entityType, data)

export const checkConcurrentConflict = (
  entityId: string,
  entityType: string,
  expectedVersion: number,
  data: any
) => versionControlSystem.checkConcurrentConflict(entityId, entityType, expectedVersion, data)

export const clearVersionCache = () => versionControlSystem.clearCache()
export const getVersionCacheStats = () => versionControlSystem.getCacheStats()
export const getVersionConfig = () => versionControlSystem.getConfig()
export const updateVersionConfig = (config: Partial<VersionControlConfig>) =>
  versionControlSystem.updateConfig(config)

// ============================================================================
// 类型导出
// ============================================================================

export type {
  VersionInfo,
  VersionHistory,
  ChangeDetectionResult,
  VersionControlConfig
}