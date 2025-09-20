/**
 * 冲突UI服务
 * 提供UI层与同步服务之间的接口，处理UI特定的逻辑
 */

import { unifiedSyncService } from '@/services/core/sync/unified-sync.service'
import type {
  ConflictBase,
  CardConflict,
  FolderConflict,
  TagConflict,
  ConflictResolution,
  ConflictSuggestion
} from '@/types/conflict'
import type {
  UnifiedConflict,
  ConflictResolution as UnifiedConflictResolution
} from '@/services/sync/conflict-resolution-engine/unified-conflict-resolution-engine'

// ============================================================================
// UI服务接口定义
// ============================================================================

export interface ConflictUIService {
  // 冲突管理
  getConflicts(): Promise<(CardConflict | FolderConflict | TagConflict)[]>
  getConflictById(id: string): Promise<CardConflict | FolderConflict | TagConflict | null>
  resolveConflict(id: string, resolution: ConflictResolution): Promise<boolean>
  batchResolveConflicts(ids: string[], resolution: ConflictResolution): Promise<{
    success: number
    failed: number
    errors: string[]
  }>
  ignoreConflict(id: string): Promise<boolean>
  autoResolveConflicts(): Promise<number>

  // 冲突检测
  detectNewConflicts(): Promise<(CardConflict | FolderConflict | TagConflict)[]>
  refreshConflicts(): Promise<void>

  // 统计和状态
  getConflictStats(): Promise<ConflictStats>
  getSyncStatus(): Promise<SyncStatus>

  // 冲突详情和建议
  getConflictDetails(id: string): Promise<ConflictDetails | null>
  getSuggestions(id: string): Promise<ConflictSuggestion[]>
  getConflictHistory(id: string): Promise<ConflictHistoryItem[]>

  // 批量操作
  exportConflicts(format: 'json' | 'csv'): Promise<string>
  importConflicts(data: string): Promise<ImportResult>

  // 用户体验优化
  getConflictPreview(id: string): Promise<ConflictPreview | null>
  getResolutionPreview(conflictId: string, resolutionType: string): Promise<ResolutionPreview | null>
}

export interface ConflictStats {
  totalConflicts: number
  resolvedConflicts: number
  pendingConflicts: number
  conflictsByType: Record<string, number>
  conflictsBySeverity: Record<string, number>
  averageResolutionTime: number
  autoResolveRate: number
  userResolveRate: number
}

export interface SyncStatus {
  isSyncing: boolean
  isOnline: boolean
  lastSyncTime: Date | null
  pendingOperations: number
  syncProgress: number
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor'
}

export interface ConflictDetails {
  conflict: CardConflict | FolderConflict | TagConflict
  syncDetails: UnifiedConflict | null
  suggestions: ConflictSuggestion[]
  affectedEntities: AffectedEntity[]
  resolutionHistory: ResolutionHistory[]
  estimatedResolutionTime: number
  complexity: 'simple' | 'medium' | 'complex'
}

export interface AffectedEntity {
  id: string
  type: 'card' | 'folder' | 'tag'
  name: string
  impact: 'high' | 'medium' | 'low'
  description: string
}

export interface ResolutionHistory {
  timestamp: Date
  action: 'detected' | 'resolved' | 'ignored' | 'auto_resolved'
  user?: string
  device?: string
  details?: any
}

export interface ConflictHistoryItem {
  id: string
  timestamp: Date
  type: string
  severity: string
  status: string
  resolution?: string
  resolutionTime?: number
}

export interface ImportResult {
  success: boolean
  imported: number
  failed: number
  errors: string[]
}

export interface ConflictPreview {
  id: string
  title: string
  type: string
  severity: string
  description: string
  localSummary: string
  remoteSummary: string
  suggestedAction: string
  estimatedTime: number
}

export interface ResolutionPreview {
  type: string
  title: string
  description: string
  preview: any
  confidence: number
  risks: string[]
  benefits: string[]
  estimatedTime: number
}

// ============================================================================
// 冲突UI服务实现
// ============================================================================

export class ConflictUIServiceImpl implements ConflictUIService {
  private static instance: ConflictUIServiceImpl
  private cache = new Map<string, { data: any; timestamp: number }>()
  private cacheTTL = 30000 // 30秒缓存

  static getInstance(): ConflictUIServiceImpl {
    if (!ConflictUIServiceImpl.instance) {
      ConflictUIServiceImpl.instance = new ConflictUIServiceImpl()
    }
    return ConflictUIServiceImpl.instance
  }

  // ============================================================================
  // 冲突管理
  // ============================================================================

  async getConflicts(): Promise<(CardConflict | FolderConflict | TagConflict)[]> {
    try {
      const syncConflicts = unifiedSyncService.getConflicts()
      return this.convertSyncConflictsToUIConflicts(syncConflicts)
    } catch (error) {
      console.error('Failed to get conflicts:', error)
      throw new Error(`Failed to retrieve conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getConflictById(id: string): Promise<CardConflict | FolderConflict | TagConflict | null> {
    try {
      const syncConflict = unifiedSyncService.getConflict(id)
      if (!syncConflict) return null

      const conflicts = await this.getConflicts()
      return conflicts.find(c => c.id === id) || null
    } catch (error) {
      console.error('Failed to get conflict by ID:', error)
      throw new Error(`Failed to retrieve conflict: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async resolveConflict(id: string, resolution: ConflictResolution): Promise<boolean> {
    try {
      const success = await unifiedSyncService.resolveConflict(
        id,
        resolution.type as 'local' | 'cloud' | 'merge',
        resolution.mergedData
      )

      if (success) {
        this.clearCache()
        return true
      }

      return false
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      throw new Error(`Failed to resolve conflict: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async batchResolveConflicts(ids: string[], resolution: ConflictResolution): Promise<{
    success: number
    failed: number
    errors: string[]
  }> {
    const results = await Promise.allSettled(
      ids.map(id => this.resolveConflict(id, resolution))
    )

    const success = results.filter(r => r.status === 'fulfilled' && r.value).length
    const failed = results.filter(r => r.status === 'rejected').length
    const errors = results
      .filter(r => r.status === 'rejected')
      .map(r => (r as PromiseRejectedResult).reason.message || 'Unknown error')

    return { success, failed, errors }
  }

  async ignoreConflict(id: string): Promise<boolean> {
    try {
      // 在实际实现中，这里需要调用同步服务的忽略API
      // 目前先模拟成功
      this.clearCache()
      return true
    } catch (error) {
      console.error('Failed to ignore conflict:', error)
      return false
    }
  }

  async autoResolveConflicts(): Promise<number> {
    try {
      const resolvedCount = await unifiedSyncService.autoResolveConflicts()
      this.clearCache()
      return resolvedCount
    } catch (error) {
      console.error('Failed to auto-resolve conflicts:', error)
      throw new Error(`Failed to auto-resolve conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ============================================================================
  // 冲突检测
  // ============================================================================

  async detectNewConflicts(): Promise<(CardConflict | FolderConflict | TagConflict)[]> {
    try {
      const syncResult = await unifiedSyncService.sync({
        type: 'incremental',
        direction: 'bidirectional'
      })

      const conflicts = await this.getConflicts()
      const newConflicts = conflicts.filter(c => c.status === 'pending')

      this.clearCache()
      return newConflicts
    } catch (error) {
      console.error('Failed to detect new conflicts:', error)
      throw new Error(`Failed to detect conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async refreshConflicts(): Promise<void> {
    try {
      await this.detectNewConflicts()
    } catch (error) {
      console.error('Failed to refresh conflicts:', error)
      throw new Error(`Failed to refresh conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ============================================================================
  // 统计和状态
  // ============================================================================

  async getConflictStats(): Promise<ConflictStats> {
    const cacheKey = 'conflict-stats'
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    try {
      const conflicts = await this.getConflicts()
      const stats = unifiedSyncService.getStats()

      const conflictStats: ConflictStats = {
        totalConflicts: conflicts.length,
        resolvedConflicts: conflicts.filter(c => c.status === 'resolved').length,
        pendingConflicts: conflicts.filter(c => c.status === 'pending').length,
        conflictsByType: this.groupConflictsByType(conflicts),
        conflictsBySeverity: this.groupConflictsBySeverity(conflicts),
        averageResolutionTime: this.calculateAverageResolutionTime(conflicts),
        autoResolveRate: stats.conflicts.autoResolved / Math.max(stats.conflicts.total, 1),
        userResolveRate: stats.conflicts.manualResolved / Math.max(stats.conflicts.total, 1)
      }

      this.setCache(cacheKey, conflictStats)
      return conflictStats
    } catch (error) {
      console.error('Failed to get conflict stats:', error)
      throw new Error(`Failed to get stats: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const status = unifiedSyncService.getStatus()
      const networkStatus = status.networkStatus

      return {
        isSyncing: status.isSyncing,
        isOnline: networkStatus?.online || false,
        lastSyncTime: status.lastSync,
        pendingOperations: status.pendingOperations,
        syncProgress: this.calculateSyncProgress(status),
        networkQuality: this.assessNetworkQuality(networkStatus)
      }
    } catch (error) {
      console.error('Failed to get sync status:', error)
      throw new Error(`Failed to get sync status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ============================================================================
  // 冲突详情和建议
  // ============================================================================

  async getConflictDetails(id: string): Promise<ConflictDetails | null> {
    try {
      const conflict = await this.getConflictById(id)
      if (!conflict) return null

      const syncConflict = unifiedSyncService.getConflict(id)
      const suggestions = await this.getSuggestions(id)
      const affectedEntities = this.getAffectedEntities(conflict)
      const resolutionHistory = this.getResolutionHistory(conflict)
      const estimatedResolutionTime = this.estimateResolutionTime(conflict)
      const complexity = this.assessConflictComplexity(conflict)

      return {
        conflict,
        syncDetails: syncConflict || null,
        suggestions,
        affectedEntities,
        resolutionHistory,
        estimatedResolutionTime,
        complexity
      }
    } catch (error) {
      console.error('Failed to get conflict details:', error)
      throw new Error(`Failed to get conflict details: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getSuggestions(id: string): Promise<ConflictSuggestion[]> {
    try {
      const conflict = await this.getConflictById(id)
      if (!conflict) return []

      const syncConflict = unifiedSyncService.getConflict(id)
      const syncSuggestions = syncConflict?.suggestions || []

      return syncSuggestions.map((s: any) => ({
        type: s.type,
        confidence: s.confidence,
        reason: s.reasoning || s.reason,
        preview: s.preview
      }))
    } catch (error) {
      console.error('Failed to get suggestions:', error)
      return []
    }
  }

  async getConflictHistory(id: string): Promise<ConflictHistoryItem[]> {
    // 模拟冲突历史记录
    return [
      {
        id: `${id}-1`,
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        type: 'card_content',
        severity: 'medium',
        status: 'pending'
      }
    ]
  }

  // ============================================================================
  // 批量操作
  // ============================================================================

  async exportConflicts(format: 'json' | 'csv'): Promise<string> {
    try {
      const conflicts = await this.getConflicts()

      if (format === 'json') {
        return JSON.stringify(conflicts, null, 2)
      } else {
        return this.convertToCSV(conflicts)
      }
    } catch (error) {
      console.error('Failed to export conflicts:', error)
      throw new Error(`Failed to export conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async importConflicts(data: string): Promise<ImportResult> {
    try {
      // 实现冲突导入逻辑
      return {
        success: true,
        imported: 0,
        failed: 0,
        errors: []
      }
    } catch (error) {
      console.error('Failed to import conflicts:', error)
      return {
        success: false,
        imported: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  // ============================================================================
  // 用户体验优化
  // ============================================================================

  async getConflictPreview(id: string): Promise<ConflictPreview | null> {
    try {
      const conflict = await this.getConflictById(id)
      if (!conflict) return null

      const suggestions = await this.getSuggestions(id)
      const bestSuggestion = suggestions[0]

      return {
        id: conflict.id,
        title: this.getConflictTitle(conflict),
        type: conflict.type,
        severity: conflict.severity,
        description: this.getConflictDescription(conflict),
        localSummary: this.getEntitySummary(conflict.entityType, conflict.localVersion),
        remoteSummary: this.getEntitySummary(conflict.entityType, conflict.remoteVersion),
        suggestedAction: bestSuggestion?.reason || '需要手动解决',
        estimatedTime: this.estimateResolutionTime(conflict)
      }
    } catch (error) {
      console.error('Failed to get conflict preview:', error)
      return null
    }
  }

  async getResolutionPreview(conflictId: string, resolutionType: string): Promise<ResolutionPreview | null> {
    try {
      const conflict = await this.getConflictById(conflictId)
      if (!conflict) return null

      const preview = this.generateResolutionPreview(conflict, resolutionType)

      return {
        type: resolutionType,
        title: preview.title,
        description: preview.description,
        preview: preview.data,
        confidence: preview.confidence,
        risks: preview.risks,
        benefits: preview.benefits,
        estimatedTime: preview.estimatedTime
      }
    } catch (error) {
      console.error('Failed to get resolution preview:', error)
      return null
    }
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  private convertSyncConflictsToUIConflicts(syncConflicts: any[]): (CardConflict | FolderConflict | TagConflict)[] {
    return syncConflicts.map(syncConflict => {
      const baseConflict = {
        id: syncConflict.id,
        type: this.mapConflictType(syncConflict.conflictType),
        entityType: syncConflict.entityType,
        entityId: syncConflict.entityId,
        timestamp: syncConflict.detectedAt || new Date(),
        sourceDevice: syncConflict.sourceDevice || 'Unknown',
        severity: syncConflict.severity,
        status: this.mapConflictStatus(syncConflict.status),
        createdAt: syncConflict.detectedAt || new Date(),
        resolvedAt: syncConflict.resolvedAt,
        resolvedBy: syncConflict.resolvedBy,
        resolution: syncConflict.resolution ? this.mapConflictResolution(syncConflict.resolution) : undefined
      }

      switch (syncConflict.entityType) {
        case 'card':
          return {
            ...baseConflict,
            type: 'card_content',
            localVersion: syncConflict.localData,
            remoteVersion: syncConflict.cloudData,
            conflictFields: syncConflict.conflictFields || [],
            suggestions: []
          } as CardConflict

        case 'folder':
          return {
            ...baseConflict,
            type: 'folder_name',
            localVersion: syncConflict.localData,
            remoteVersion: syncConflict.cloudData,
            affectedCards: syncConflict.conflictDetails?.affectedEntities || []
          } as FolderConflict

        case 'tag':
          return {
            ...baseConflict,
            type: 'tag_rename',
            localVersion: syncConflict.localData,
            remoteVersion: syncConflict.cloudData,
            affectedCards: syncConflict.conflictDetails?.affectedEntities || []
          } as TagConflict

        default:
          throw new Error(`Unknown entity type: ${syncConflict.entityType}`)
      }
    })
  }

  private mapConflictType(syncType: string): string {
    const typeMap: Record<string, string> = {
      'content': 'card_content',
      'version': 'card_content',
      'structure': 'folder_structure',
      'delete': 'tag_delete',
      'field': 'card_content'
    }
    return typeMap[syncType] || 'card_content'
  }

  private mapConflictStatus(syncStatus: string): any {
    const statusMap: Record<string, any> = {
      'pending': 'pending',
      'resolving': 'reviewing',
      'resolved': 'resolved',
      'manual_required': 'pending'
    }
    return statusMap[syncStatus] || 'pending'
  }

  private mapConflictResolution(syncResolution: any): ConflictResolution {
    return {
      type: syncResolution.type,
      mergedData: syncResolution.mergedData,
      reason: syncResolution.reasoning,
      manualChanges: syncResolution.manualChanges
    }
  }

  private groupConflictsByType(conflicts: any[]): Record<string, number> {
    return conflicts.reduce((acc, conflict) => {
      acc[conflict.type] = (acc[conflict.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  private groupConflictsBySeverity(conflicts: any[]): Record<string, number> {
    return conflicts.reduce((acc, conflict) => {
      acc[conflict.severity] = (acc[conflict.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  private calculateAverageResolutionTime(conflicts: any[]): number {
    const resolvedConflicts = conflicts.filter(c => c.status === 'resolved' && c.resolvedAt)
    if (resolvedConflicts.length === 0) return 0

    const totalTime = resolvedConflicts.reduce((sum, conflict) => {
      return sum + (conflict.resolvedAt.getTime() - conflict.createdAt.getTime())
    }, 0)

    return totalTime / resolvedConflicts.length
  }

  private calculateSyncProgress(status: any): number {
    if (!status.currentSession) return 0
    const session = status.currentSession
    return session.stats.totalOperations > 0
      ? (session.stats.completedOperations / session.stats.totalOperations) * 100
      : 0
  }

  private assessNetworkQuality(networkStatus: any): 'excellent' | 'good' | 'fair' | 'poor' {
    if (!networkStatus) return 'poor'

    const { bandwidth, latency, stability } = networkStatus
    if (bandwidth > 1000000 && latency < 100 && stability > 0.9) return 'excellent'
    if (bandwidth > 500000 && latency < 300 && stability > 0.8) return 'good'
    if (bandwidth > 100000 && latency < 1000 && stability > 0.6) return 'fair'
    return 'poor'
  }

  private getAffectedEntities(conflict: any): AffectedEntity[] {
    // 实现受影响实体的逻辑
    return []
  }

  private getResolutionHistory(conflict: any): ResolutionHistory[] {
    // 实现解决历史逻辑
    return []
  }

  private estimateResolutionTime(conflict: any): number {
    // 基于冲突类型和复杂度估算解决时间
    const baseTime = {
      'card_content': 30,
      'folder_name': 15,
      'tag_rename': 10
    }
    return baseTime[conflict.type as keyof typeof baseTime] || 30
  }

  private assessConflictComplexity(conflict: any): 'simple' | 'medium' | 'complex' {
    // 评估冲突复杂度
    const fieldCount = conflict.conflictFields?.length || 0
    if (fieldCount <= 2) return 'simple'
    if (fieldCount <= 5) return 'medium'
    return 'complex'
  }

  private getConflictTitle(conflict: any): string {
    switch (conflict.entityType) {
      case 'card':
        return conflict.localVersion.content.frontContent.title
      case 'folder':
        return conflict.localVersion.name
      case 'tag':
        return conflict.localVersion.name
      default:
        return '未知冲突'
    }
  }

  private getConflictDescription(conflict: any): string {
    switch (conflict.type) {
      case 'card_content':
        return '卡片内容在多设备上被同时编辑'
      case 'folder_name':
        return '文件夹名称与远程版本不一致'
      case 'tag_rename':
        return '标签重命名冲突'
      default:
        return '数据版本不一致'
    }
  }

  private getEntitySummary(entityType: string, version: any): string {
    switch (entityType) {
      case 'card':
        return `${version.content.frontContent.title} - ${version.content.frontContent.text.substring(0, 50)}...`
      case 'folder':
        return `文件夹: ${version.name} (${version.cardIds.length} 张卡片)`
      case 'tag':
        return `标签: ${version.name} (${version.count} 次使用)`
      default:
        return '未知实体'
    }
  }

  private generateResolutionPreview(conflict: any, resolutionType: string) {
    // 生成解决预览
    return {
      title: `${resolutionType === 'keep_local' ? '保留本地' : resolutionType === 'keep_remote' ? '保留远程' : '合并'}版本`,
      description: `应用${resolutionType}解决方案`,
      data: conflict.localVersion,
      confidence: 0.8,
      risks: [],
      benefits: ['解决冲突'],
      estimatedTime: 30
    }
  }

  private convertToCSV(conflicts: any[]): string {
    // 将冲突数据转换为CSV格式
    const headers = ['ID', 'Type', 'Entity', 'Severity', 'Status', 'Created']
    const rows = conflicts.map(c => [
      c.id,
      c.type,
      c.entityType,
      c.severity,
      c.status,
      c.createdAt.toISOString()
    ])

    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  private clearCache(): void {
    this.cache.clear()
  }
}

// ============================================================================
// 导出便捷实例
// ============================================================================

export const conflictUIService = ConflictUIServiceImpl.getInstance()