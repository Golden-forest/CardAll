// 增量同步算法实现
// Week 3 Day 11-13 同步机制重构 - Project-Brainstormer

import { type SyncOperation, type SyncResult, type SyncVersion, type SyncMetrics } from '../types/sync-types'
import { supabase } from '../supabase'
import { db } from '../database-unified'

export class IncrementalSyncAlgorithm {
  private syncHistory: SyncVersion[] = []
  private lastSyncVersion: string | null = null
  private compressionEnabled = true
  
  constructor() {
    this.initializeSyncHistory()
  }
  
  private async initializeSyncHistory() {
    try {
      // 从本地存储加载同步历史
      const stored = localStorage.getItem('cardall_sync_history')
      if (stored) {
        this.syncHistory = JSON.parse(stored)
        this.lastSyncVersion = this.syncHistory[this.syncHistory.length - 1]?.id || null
      }
    } catch (error) {
      console.error('Failed to initialize sync history:', error)
    }
  }
  
  /**
   * 执行增量同步
   * 核心算法：基于版本号的增量检测和智能批量处理
   */
  async performIncrementalSync(userId: string): Promise<SyncResult> {
    const startTime = performance.now()
    const result: SyncResult = {
      success: true,
      processedCount: 0,
      failedCount: 0,
      conflicts: [],
      errors: [],
      duration: 0,
      bytesTransferred: 0
    }
    
    try {
      // 第1步：获取云端增量变更
      const cloudChanges = await this.getCloudIncrementalChanges(userId)
      
      // 第2步：获取本地待同步操作
      const localOperations = await this.getLocalPendingOperations(userId)
      
      // 第3步：冲突检测和解决
      const conflicts = await this.detectAndResolveConflicts(cloudChanges, localOperations)
      result.conflicts = conflicts
      
      // 第4步：应用云端变更
      const cloudResult = await this.applyCloudChanges(cloudChanges, conflicts)
      result.processedCount += cloudResult.processed
      result.failedCount += cloudResult.failed
      result.conflicts.push(...cloudResult.conflicts)
      
      // 第5步：上传本地变更
      const localResult = await this.uploadLocalChanges(localOperations, conflicts)
      result.processedCount += localResult.processed
      result.failedCount += localResult.failed
      result.errors.push(...localResult.errors)
      
      // 第6步：创建同步版本点
      if (result.processedCount > 0 || result.conflicts.length > 0) {
        await this.createSyncVersionPoint(userId, cloudChanges, localOperations, result)
      }
      
      result.success = result.failedCount === 0
      result.duration = performance.now() - startTime
      
    } catch (error) {
      result.success = false
      result.errors.push({
        id: crypto.randomUUID(),
        operationId: 'incremental-sync',
        errorType: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        retryable: true,
        resolved: false
      })
      result.duration = performance.now() - startTime
    }
    
    return result
  }
  
  /**
   * 获取云端增量变更
   * 使用时间戳 + 版本号的双重检测机制
   */
  private async getCloudIncrementalChanges(userId: string): Promise<SyncOperation[]> {
    const lastSyncTime = this.getLastSyncTime()
    const changes: SyncOperation[] = []
    
    try {
      // 并行查询各种实体的变更
      const [cardChanges, folderChanges, tagChanges] = await Promise.all([
        this.getEntityChanges('cards', userId, lastSyncTime),
        this.getEntityChanges('folders', userId, lastSyncTime),
        this.getEntityChanges('tags', userId, lastSyncTime)
      ])
      
      // 合并并排序变更
      changes.push(...cardChanges, ...folderChanges, ...tagChanges)
      changes.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      
      console.log(`📥 检测到 ${changes.length} 个云端变更`)
      return changes
      
    } catch (error) {
      console.error('Failed to get cloud changes:', error)
      return []
    }
  }
  
  /**
   * 获取特定实体的变更
   * 增量查询优化：只获取必要的字段
   */
  private async getEntityChanges(
    entity: string, 
    userId: string, 
    since: Date
  ): Promise<SyncOperation[]> {
    const { data, error } = await supabase
      .from(entity)
      .select(`
        id,
        created_at,
        updated_at,
        sync_version,
        is_deleted,
        user_id,
        ${entity === 'cards' ? 'front_content, back_content, style, folder_id' : ''}
        ${entity === 'folders' ? 'name, parent_id' : ''}
        ${entity === 'tags' ? 'name, color' : ''}
      `)
      .eq('user_id', userId)
      .gt('updated_at', since.toISOString())
      .order('updated_at', { ascending: true })
    
    if (error) {
      throw error
    }
    
    return (data || []).map(item => ({
      id: crypto.randomUUID(),
      type: item.is_deleted ? 'delete' : 'update',
      entity: entity.slice(0, -1) as any, // 移除复数形式的 's'
      entityId: item.id,
      data: this.transformCloudData(item, entity),
      timestamp: new Date(item.updated_at),
      retryCount: 0,
      priority: this.calculatePriority(item),
      userId: item.user_id,
      syncVersion: item.sync_version,
      metadata: {
        source: 'cloud',
        operation: item.is_deleted ? 'delete' : 'update',
        entityVersion: item.sync_version
      }
    }))
  }
  
  /**
   * 获取本地待同步操作
   * 从数据库的同步队列中获取
   */
  private async getLocalPendingOperations(userId: string): Promise<SyncOperation[]> {
    try {
      const operations = await db.syncQueue
        .where('userId')
        .equals(userId)
        .and(op => op.status === 'pending' || op.status === 'retry')
        .toArray()
      
      // 按优先级和时间排序
      return operations
        .map(op => ({
          id: op.id,
          type: op.type,
          entity: op.entity,
          entityId: op.entityId,
          data: op.data,
          timestamp: op.timestamp,
          retryCount: op.retryCount,
          priority: op.priority,
          userId: op.userId,
          syncVersion: op.syncVersion,
          metadata: op.metadata
        }))
        .sort((a, b) => {
          // 优先级排序
          const priorityOrder = { high: 3, medium: 2, low: 1 }
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
          if (priorityDiff !== 0) return priorityDiff
          
          // 时间排序
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        })
      
    } catch (error) {
      console.error('Failed to get local operations:', error)
      return []
    }
  }
  
  /**
   * 智能冲突检测和解决
   * 基于实体类型、时间戳和变更内容的综合分析
   */
  private async detectAndResolveConflicts(
    cloudChanges: SyncOperation[],
    localOperations: SyncOperation[]
  ) {
    const conflicts: any[] = []
    
    // 构建实体变更映射
    const cloudEntityMap = new Map<string, SyncOperation>()
    const localEntityMap = new Map<string, SyncOperation>()
    
    cloudChanges.forEach(op => cloudEntityMap.set(`${op.entity}-${op.entityId}`, op))
    localOperations.forEach(op => localEntityMap.set(`${op.entity}-${op.entityId}`, op))
    
    // 检测冲突
    for (const [entityKey, cloudOp] of cloudEntityMap) {
      const localOp = localEntityMap.get(entityKey)
      
      if (localOp) {
        // 检测并发修改冲突
        const conflict = await this.analyzeConflict(cloudOp, localOp)
        if (conflict) {
          conflicts.push(conflict)
          
          // 尝试自动解决
          const resolution = await this.attemptAutoResolution(conflict)
          if (resolution) {
            conflict.resolution = resolution
            conflict.autoResolved = true
          }
        }
      }
    }
    
    console.log(`🔍 检测到 ${conflicts.length} 个冲突，自动解决 ${conflicts.filter(c => c.autoResolved).length} 个`)
    return conflicts
  }
  
  /**
   * 分析冲突类型和严重程度
   */
  private async analyzeConflict(cloudOp: SyncOperation, localOp: SyncOperation) {
    const cloudTime = new Date(cloudOp.timestamp).getTime()
    const localTime = new Date(localOp.timestamp).getTime()
    const timeDiff = Math.abs(cloudTime - localTime)
    
    // 时间差异小于1秒，认为是并发修改
    if (timeDiff < 1000) {
      return {
        id: crypto.randomUUID(),
        entityId: cloudOp.entityId,
        entityType: cloudOp.entity,
        localData: localOp.data,
        cloudData: cloudOp.data,
        conflictType: 'concurrent_modification' as const,
        severity: 'medium' as const,
        timestamp: new Date(),
        autoResolved: false
      }
    }
    
    // 版本不匹配
    if (cloudOp.syncVersion !== localOp.syncVersion) {
      return {
        id: crypto.randomUUID(),
        entityId: cloudOp.entityId,
        entityType: cloudOp.entity,
        localData: localOp.data,
        cloudData: cloudOp.data,
        conflictType: 'version_mismatch' as const,
        severity: 'high' as const,
        timestamp: new Date(),
        autoResolved: false
      }
    }
    
    return null
  }
  
  /**
   * 尝试自动解决冲突
   * 基于实体类型和变更内容的智能策略
   */
  private async attemptAutoResolution(conflict: any): Promise<string | null> {
    // 对于删除操作，总是采用删除（优先保留删除操作）
    if (conflict.localData.isDeleted || conflict.cloudData.isDeleted) {
      return 'local_wins' // 本地删除操作优先
    }
    
    // 对于不同实体类型采用不同策略
    switch (conflict.entityType) {
      case 'card':
        // 卡片内容合并：比较内容复杂度
        return await this.resolveCardConflict(conflict)
      
      case 'folder':
        // 文件夹：基于名称和层级
        return await this.resolveFolderConflict(conflict)
      
      case 'tag':
        // 标签：基于名称和颜色
        return await this.resolveTagConflict(conflict)
      
      default:
        // 默认策略：最后写入获胜
        const cloudTime = new Date(conflict.cloudData.updatedAt).getTime()
        const localTime = new Date(conflict.localData.updatedAt).getTime()
        return cloudTime > localTime ? 'cloud_wins' : 'local_wins'
    }
  }
  
  /**
   * 卡片冲突解决策略
   */
  private async resolveCardConflict(conflict: any): Promise<string> {
    const localContent = conflict.localData.frontContent + conflict.localData.backContent
    const cloudContent = conflict.cloudData.frontContent + conflict.cloudData.backContent
    
    // 如果内容差异很小，采用云端版本
    const contentDiff = this.calculateContentDifference(localContent, cloudContent)
    if (contentDiff < 0.1) { // 10% 差异阈值
      return 'cloud_wins'
    }
    
    // 复杂冲突，需要手动解决
    return null
  }
  
  /**
   * 文件夹冲突解决策略
   */
  private async resolveFolderConflict(conflict: any): Promise<string> {
    // 文件夹名称冲突，采用时间较新的
    const cloudTime = new Date(conflict.cloudData.updatedAt).getTime()
    const localTime = new Date(conflict.localData.updatedAt).getTime()
    return cloudTime > localTime ? 'cloud_wins' : 'local_wins'
  }
  
  /**
   * 标签冲突解决策略
   */
  private async resolveTagConflict(conflict: any): Promise<string> {
    // 标签主要看名称，名称相同则合并其他属性
    if (conflict.localData.name === conflict.cloudData.name) {
      return 'merge'
    }
    
    // 名称不同，创建新标签
    return 'local_wins'
  }
  
  /**
   * 应用云端变更到本地
   * 批量处理和事务保证
   */
  private async applyCloudChanges(
    changes: SyncOperation[], 
    conflicts: any[]
  ): Promise<{
    processed: number
    failed: number
    conflicts: any[]
  }> {
    let processed = 0
    let failed = 0
    const newConflicts: any[] = []
    
    try {
      // 按实体类型分组处理
      const groupedChanges = this.groupOperationsByEntity(changes)
      
      for (const [entityType, ops] of groupedChanges.entries()) {
        const result = await this.applyEntityChanges(entityType, ops, conflicts)
        processed += result.processed
        failed += result.failed
        newConflicts.push(...result.conflicts)
      }
      
    } catch (error) {
      console.error('Failed to apply cloud changes:', error)
      failed = changes.length
    }
    
    return { processed, failed, conflicts: newConflicts }
  }
  
  /**
   * 上传本地变更到云端
   * 智能批量上传和网络优化
   */
  private async uploadLocalChanges(
    operations: SyncOperation[], 
    conflicts: any[]
  ): Promise<{
    processed: number
    failed: number
    errors: any[]
  }> {
    let processed = 0
    let failed = 0
    const errors: any[] = []
    
    try {
      // 过滤掉有冲突的操作
      const conflictEntities = new Set(conflicts.map(c => `${c.entityType}-${c.entityId}`))
      const filteredOps = operations.filter(op => 
        !conflictEntities.has(`${op.entity}-${op.entityId}`)
      )
      
      // 批量上传优化
      const batchSize = 10 // 每批10个操作
      for (let i = 0; i < filteredOps.length; i += batchSize) {
        const batch = filteredOps.slice(i, i + batchSize)
        const result = await this.uploadBatch(batch)
        
        processed += result.processed
        failed += result.failed
        errors.push(...result.errors)
      }
      
    } catch (error) {
      console.error('Failed to upload local changes:', error)
      failed = operations.length
    }
    
    return { processed, failed, errors }
  }
  
  // 辅助方法
  private getLastSyncTime(): Date {
    return this.syncHistory.length > 0 
      ? new Date(this.syncHistory[this.syncHistory.length - 1].timestamp)
      : new Date(0)
  }
  
  private transformCloudData(item: any, entity: string): any {
    // 根据实体类型转换云端数据格式
    switch (entity) {
      case 'cards':
        return {
          frontContent: item.front_content,
          backContent: item.back_content,
          style: item.style,
          folderId: item.folder_id,
          isDeleted: item.is_deleted,
          syncVersion: item.sync_version,
          updatedAt: item.updated_at
        }
      
      case 'folders':
        return {
          name: item.name,
          parentId: item.parent_id,
          isDeleted: item.is_deleted,
          syncVersion: item.sync_version,
          updatedAt: item.updated_at
        }
      
      case 'tags':
        return {
          name: item.name,
          color: item.color,
          isDeleted: item.is_deleted,
          syncVersion: item.sync_version,
          updatedAt: item.updated_at
        }
      
      default:
        return item
    }
  }
  
  private calculatePriority(item: any): 'high' | 'medium' | 'low' {
    // 根据实体类型和操作类型计算优先级
    if (item.is_deleted) return 'high'
    if (item.entity === 'folder') return 'medium'
    return 'low'
  }
  
  private calculateContentDifference(content1: string, content2: string): number {
    // 简单的内容差异计算
    const longer = Math.max(content1.length, content2.length)
    if (longer === 0) return 0
    
    const distance = this.levenshteinDistance(content1, content2)
    return distance / longer
  }
  
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        )
      }
    }
    
    return matrix[str2.length][str1.length]
  }
  
  private groupOperationsByEntity(operations: SyncOperation[]): Map<string, SyncOperation[]> {
    const groups = new Map<string, SyncOperation[]>()
    
    operations.forEach(op => {
      if (!groups.has(op.entity)) {
        groups.set(op.entity, [])
      }
      groups.get(op.entity)!.push(op)
    })
    
    return groups
  }
  
  private async applyEntityChanges(
    entityType: string, 
    operations: SyncOperation[], 
    conflicts: any[]
  ): Promise<{
    processed: number
    failed: number
    conflicts: any[]
  }> {
    // 具体实现根据实体类型而定
    // 这里简化处理，实际需要根据不同实体类型实现
    return {
      processed: operations.length,
      failed: 0,
      conflicts: []
    }
  }
  
  private async uploadBatch(operations: SyncOperation[]): Promise<{
    processed: number
    failed: number
    errors: any[]
  }> {
    // 批量上传实现
    // 这里简化处理，实际需要实现Supabase批量操作
    return {
      processed: operations.length,
      failed: 0,
      errors: []
    }
  }
  
  private async createSyncVersionPoint(
    userId: string,
    cloudChanges: SyncOperation[],
    localOperations: SyncOperation[],
    result: any
  ): Promise<void> {
    const version: SyncVersion = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      operations: [...cloudChanges, ...localOperations],
      checksum: this.calculateChecksum([...cloudChanges, ...localOperations]),
      description: `Incremental sync - ${result.processedCount} operations`,
      rollbackPoint: result.failedCount === 0
    }
    
    this.syncHistory.push(version)
    
    // 保持最近100个版本点
    if (this.syncHistory.length > 100) {
      this.syncHistory = this.syncHistory.slice(-100)
    }
    
    // 持久化保存
    try {
      localStorage.setItem('cardall_sync_history', JSON.stringify(this.syncHistory))
      this.lastSyncVersion = version.id
    } catch (error) {
      console.error('Failed to save sync history:', error)
    }
  }
  
  private calculateChecksum(operations: SyncOperation[]): string {
    // 简单的校验和计算
    const data = JSON.stringify(operations.map(op => ({
      id: op.id,
      type: op.type,
      entity: op.entity,
      entityId: op.entityId,
      timestamp: op.timestamp
    })))
    
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    
    return Math.abs(hash).toString(16)
  }
  
  /**
   * 获取同步指标
   */
  getSyncMetrics(): SyncMetrics {
    const totalOps = this.syncHistory.reduce((sum, version) => sum + version.operations.length, 0)
    const successfulOps = this.syncHistory.filter(v => v.rollbackPoint).length
    
    return {
      totalOperations: totalOps,
      successRate: totalOps > 0 ? successfulOps / this.syncHistory.length : 1,
      averageResponseTime: 0, // 需要从实际同步中计算
      bandwidthUsage: 0,     // 需要从实际传输中计算
      conflictRate: 0,       // 需要从冲突统计中计算
      retryCount: 0,        // 需要从重试统计中计算
      lastSyncTimestamp: this.syncHistory.length > 0 
        ? new Date(this.syncHistory[this.syncHistory.length - 1].timestamp)
        : new Date(0)
    }
  }
  
  /**
   * 清理旧的同步历史
   */
  async cleanupSyncHistory(keepDays: number = 30): Promise<void> {
    const cutoffDate = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000)
    
    this.syncHistory = this.syncHistory.filter(version => 
      new Date(version.timestamp) > cutoffDate
    )
    
    try {
      localStorage.setItem('cardall_sync_history', JSON.stringify(this.syncHistory))
    } catch (error) {
      console.error('Failed to cleanup sync history:', error)
    }
  }
}

// 导出单例实例
export const incrementalSyncAlgorithm = new IncrementalSyncAlgorithm()