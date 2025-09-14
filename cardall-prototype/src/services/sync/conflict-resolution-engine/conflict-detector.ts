// ============================================================================
// 智能冲突检测器 - 统一冲突解决引擎组件
// 支持多种冲突类型的智能检测
// ============================================================================

import {
  type UnifiedConflict,
  type ConflictDetectionRule,
  type ConflictDetectionData,
  type ConflictDetectionResult,
  type ConflictDetails,
  type ConflictContext,
  type ConflictSuggestion
} from './unified-conflict-resolution-engine'
import { db } from '../../database'

export class ConflictDetector {
  private detectionRules: Map<string, ConflictDetectionRule> = new Map()
  private detectionCache: Map<string, { result: ConflictDetectionResult; timestamp: number }> = new Map()
  private stats: {
    totalDetections: number
    successfulDetections: number
    failedDetections: number
    averageDetectionTime: number
    cacheHits: number
    cacheMisses: number
  } = {
    totalDetections: 0,
    successfulDetections: 0,
    failedDetections: 0,
    averageDetectionTime: 0,
    cacheHits: 0,
    cacheMisses: 0
  }

  constructor() {
    this.initializeDetectionRules()
  }

  /**
   * 初始化检测规则
   */
  private initializeDetectionRules(): void {
    // 1. 版本冲突检测规则
    this.detectionRules.set('version-conflict', {
      id: 'version-conflict',
      name: '版本冲突检测',
      description: '检测基于版本号的冲突',
      version: '1.0.0',
      enabled: true,
      priority: 100,
      entityTypes: ['card', 'folder', 'tag', 'image'],
      conflictTypes: ['version'],
      detectionFunction: this.detectVersionConflict.bind(this),
      maxExecutionTime: 1000,
      memoryLimit: 10 * 1024 * 1024, // 10MB
      author: 'System',
      createdAt: new Date(),
      lastModified: new Date()
    })

    // 2. 内容冲突检测规则
    this.detectionRules.set('content-conflict', {
      id: 'content-conflict',
      name: '内容冲突检测',
      description: '检测卡片内容级别的冲突',
      version: '1.0.0',
      enabled: true,
      priority: 90,
      entityTypes: ['card'],
      conflictTypes: ['content'],
      detectionFunction: this.detectContentConflict.bind(this),
      maxExecutionTime: 2000,
      memoryLimit: 20 * 1024 * 1024, // 20MB
      author: 'System',
      createdAt: new Date(),
      lastModified: new Date()
    })

    // 3. 结构冲突检测规则
    this.detectionRules.set('structure-conflict', {
      id: 'structure-conflict',
      name: '结构冲突检测',
      description: '检测数据结构层面的冲突',
      version: '1.0.0',
      enabled: true,
      priority: 80,
      entityTypes: ['card', 'folder', 'tag'],
      conflictTypes: ['structure'],
      detectionFunction: this.detectStructureConflict.bind(this),
      maxExecutionTime: 1500,
      memoryLimit: 15 * 1024 * 1024, // 15MB
      author: 'System',
      createdAt: new Date(),
      lastModified: new Date()
    })

    // 4. 删除冲突检测规则
    this.detectionRules.set('delete-conflict', {
      id: 'delete-conflict',
      name: '删除冲突检测',
      description: '检测删除操作与其他修改的冲突',
      version: '1.0.0',
      enabled: true,
      priority: 95,
      entityTypes: ['card', 'folder', 'tag', 'image'],
      conflictTypes: ['delete'],
      detectionFunction: this.detectDeleteConflict.bind(this),
      maxExecutionTime: 1000,
      memoryLimit: 5 * 1024 * 1024, // 5MB
      author: 'System',
      createdAt: new Date(),
      lastModified: new Date()
    })

    // 5. 字段级冲突检测规则
    this.detectionRules.set('field-conflict', {
      id: 'field-conflict',
      name: '字段级冲突检测',
      description: '检测特定字段的冲突',
      version: '1.0.0',
      enabled: true,
      priority: 85,
      entityTypes: ['card', 'folder', 'tag'],
      conflictTypes: ['field'],
      detectionFunction: this.detectFieldConflict.bind(this),
      maxExecutionTime: 3000,
      memoryLimit: 25 * 1024 * 1024, // 25MB
      author: 'System',
      createdAt: new Date(),
      lastModified: new Date()
    })

    // 6. 引用完整性冲突检测规则
    this.detectionRules.set('reference-conflict', {
      id: 'reference-conflict',
      name: '引用完整性冲突检测',
      description: '检测引用关系完整性冲突',
      version: '1.0.0',
      enabled: true,
      priority: 70,
      entityTypes: ['card', 'folder', 'tag'],
      conflictTypes: ['structure'],
      detectionFunction: this.detectReferenceConflict.bind(this),
      maxExecutionTime: 2000,
      memoryLimit: 10 * 1024 * 1024, // 10MB
      author: 'System',
      createdAt: new Date(),
      lastModified: new Date()
    })
  }

  /**
   * 检测单个实体的冲突
   */
  async detectConflict(
    entity: string,
    entityId: string,
    localData: any,
    cloudData: any,
    context: ConflictContext
  ): Promise<ConflictDetectionResult> {
    const startTime = performance.now()
    this.stats.totalDetections++

    try {
      // 检查缓存
      const cacheKey = this.generateCacheKey(entity, entityId, localData, cloudData)
      const cached = this.detectionCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < 60000) { // 1分钟缓存
        this.stats.cacheHits++
        return cached.result
      }
      this.stats.cacheMisses++

      // 应用所有启用的检测规则
      const applicableRules = Array.from(this.detectionRules.values())
        .filter(rule =>
          rule.enabled &&
          rule.entityTypes.includes(entity as any) &&
          this.isWithinResourceLimits(rule)
        )
        .sort((a, b) => b.priority - a.priority)

      let bestResult: ConflictDetectionResult = {
        hasConflict: false,
        confidence: 0,
        executionTime: 0
      }

      // 并行执行检测规则
      const detectionPromises = applicableRules.map(async (rule) => {
        try {
          const data: ConflictDetectionData = {
            localData,
            cloudData,
            entity,
            entityId,
            context,
            metadata: {
              ruleId: rule.id,
              ruleName: rule.name
            }
          }

          // 超时控制
          const timeoutPromise = new Promise<ConflictDetectionResult>((_, reject) => {
            setTimeout(() => reject(new Error('Detection timeout')), rule.maxExecutionTime)
          })

          const resultPromise = rule.detectionFunction(data)
          const result = await Promise.race([resultPromise, timeoutPromise]) as ConflictDetectionResult

          return { rule, result }
        } catch (error) {
          console.warn(`Detection rule ${rule.id} failed:`, error)
          return {
            rule,
            result: {
              hasConflict: false,
              confidence: 0,
              executionTime: 0,
              details: { error: error.message }
            }
          }
        }
      })

      const results = await Promise.all(detectionPromises)

      // 选择最佳结果
      for (const { rule, result } of results) {
        if (result.hasConflict && result.confidence > bestResult.confidence) {
          bestResult = result
        }
      }

      const executionTime = performance.now() - startTime
      bestResult.executionTime = executionTime

      // 更新统计
      this.stats.successfulDetections++
      this.updateAverageDetectionTime(executionTime)

      // 缓存结果
      this.detectionCache.set(cacheKey, { result: bestResult, timestamp: Date.now() })

      return bestResult

    } catch (error) {
      console.error('Conflict detection failed:', error)
      this.stats.failedDetections++

      return {
        hasConflict: false,
        confidence: 0,
        executionTime: performance.now() - startTime,
        details: { error: error.message }
      }
    }
  }

  /**
   * 批量检测冲突
   */
  async detectMultipleConflicts(
    entities: Array<{
      entity: string
      entityId: string
      localData: any
      cloudData: any
    }>,
    context: ConflictContext
  ): Promise<ConflictDetectionResult[]> {
    // 分批处理以避免内存问题
    const batchSize = 10
    const results: ConflictDetectionResult[] = []

    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(item =>
          this.detectConflict(item.entity, item.entityId, item.localData, item.cloudData, context)
        )
      )
      results.push(...batchResults)

      // 让出事件循环
      if (i + batchSize < entities.length) {
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }

    return results
  }

  // ============================================================================
  // 具体冲突检测规则实现
  // ============================================================================

  /**
   * 版本冲突检测
   */
  private async detectVersionConflict(data: ConflictDetectionData): Promise<ConflictDetectionResult> {
    const { localData, cloudData, entity, entityId } = data

    const localVersion = localData.sync_version || localData.version || 0
    const cloudVersion = cloudData.sync_version || cloudData.version || 0

    if (localVersion === cloudVersion) {
      return { hasConflict: false, confidence: 0, executionTime: 0 }
    }

    const conflict = this.createConflict({
      id: crypto.randomUUID(),
      entity,
      entityId,
      conflictType: 'version',
      severity: this.calculateVersionConflictSeverity(localVersion, cloudVersion),
      localData,
      cloudData,
      localVersion,
      cloudVersion,
      localTimestamp: new Date(localData.updated_at || localData.createdAt),
      cloudTimestamp: new Date(cloudData.updated_at || cloudData.created_at),
      context: data.context,
      details: {
        description: `版本冲突：本地版本 ${localVersion} vs 云端版本 ${cloudVersion}`,
        impact: 'inconsistency',
        affectedEntities: [entityId],
        autoResolveable: true,
        complexityScore: 30
      },
      suggestions: this.generateVersionConflictSuggestions(localData, cloudData, localVersion, cloudVersion)
    })

    return {
      hasConflict: true,
      conflict,
      confidence: 0.9,
      executionTime: 0,
      details: { versionDiff: Math.abs(localVersion - cloudVersion) }
    }
  }

  /**
   * 内容冲突检测
   */
  private async detectContentConflict(data: ConflictDetectionData): Promise<ConflictDetectionResult> {
    const { localData, cloudData, entity, entityId } = data

    if (entity !== 'card' || (!localData.frontContent && !localData.backContent)) {
      return { hasConflict: false, confidence: 0, executionTime: 0 }
    }

    const conflictingFields = this.detectContentConflicts(localData, cloudData)

    if (conflictingFields.length === 0) {
      return { hasConflict: false, confidence: 0, executionTime: 0 }
    }

    const conflict = this.createConflict({
      id: crypto.randomUUID(),
      entity,
      entityId,
      conflictType: 'content',
      severity: this.calculateContentConflictSeverity(conflictingFields),
      localData,
      cloudData,
      localVersion: localData.sync_version || 0,
      cloudVersion: cloudData.sync_version || 0,
      localTimestamp: new Date(localData.updated_at || localData.createdAt),
      cloudTimestamp: new Date(cloudData.updated_at || cloudData.created_at),
      context: data.context,
      conflictFields: conflictingFields,
      details: {
        description: `内容冲突：${conflictingFields.length} 个字段存在差异`,
        impact: 'inconsistency',
        affectedEntities: [entityId],
        autoResolveable: conflictingFields.length <= 3,
        complexityScore: Math.min(100, conflictingFields.length * 20)
      },
      suggestions: this.generateContentConflictSuggestions(localData, cloudData, conflictingFields)
    })

    return {
      hasConflict: true,
      conflict,
      confidence: Math.min(0.9, 0.5 + conflictingFields.length * 0.1),
      executionTime: 0,
      details: { conflictingFields, fieldCount: conflictingFields.length }
    }
  }

  /**
   * 结构冲突检测
   */
  private async detectStructureConflict(data: ConflictDetectionData): Promise<ConflictDetectionResult> {
    const { localData, cloudData, entity, entityId } = data

    const localKeys = new Set(Object.keys(localData))
    const cloudKeys = new Set(Object.keys(cloudData))

    const missingInLocal = [...cloudKeys].filter(key => !localKeys.has(key))
    const missingInCloud = [...localKeys].filter(key => !cloudKeys.has(key))

    if (missingInLocal.length === 0 && missingInCloud.length === 0) {
      return { hasConflict: false, confidence: 0, executionTime: 0 }
    }

    const conflict = this.createConflict({
      id: crypto.randomUUID(),
      entity,
      entityId,
      conflictType: 'structure',
      severity: this.calculateStructureConflictSeverity(missingInLocal, missingInCloud),
      localData,
      cloudData,
      localVersion: localData.sync_version || 0,
      cloudVersion: cloudData.sync_version || 0,
      localTimestamp: new Date(localData.updated_at || localData.createdAt),
      cloudTimestamp: new Date(cloudData.updated_at || cloudData.created_at),
      context: data.context,
      conflictFields: [...missingInLocal, ...missingInCloud],
      details: {
        description: `结构冲突：字段结构不一致`,
        impact: 'structure_break',
        affectedEntities: [entityId],
        autoResolveable: missingInLocal.length + missingInCloud.length <= 2,
        complexityScore: Math.min(100, (missingInLocal.length + missingInCloud.length) * 25)
      },
      suggestions: this.generateStructureConflictSuggestions(localData, cloudData, missingInLocal, missingInCloud)
    })

    return {
      hasConflict: true,
      conflict,
      confidence: 0.8,
      executionTime: 0,
      details: { missingInLocal, missingInCloud, totalDiff: missingInLocal.length + missingInCloud.length }
    }
  }

  /**
   * 删除冲突检测
   */
  private async detectDeleteConflict(data: ConflictDetectionData): Promise<ConflictDetectionResult> {
    const { localData, cloudData, entity, entityId } = data

    const localDeleted = localData.deleted_at || localData.isDeleted
    const cloudDeleted = cloudData.deleted_at || cloudData.isDeleted

    if (localDeleted === cloudDeleted) {
      return { hasConflict: false, confidence: 0, executionTime: 0 }
    }

    const conflict = this.createConflict({
      id: crypto.randomUUID(),
      entity,
      entityId,
      conflictType: 'delete',
      severity: 'high',
      localData,
      cloudData,
      localVersion: localData.sync_version || 0,
      cloudVersion: cloudData.sync_version || 0,
      localTimestamp: new Date(localData.updated_at || localData.createdAt),
      cloudTimestamp: new Date(cloudData.updated_at || cloudData.created_at),
      context: data.context,
      details: {
        description: `删除冲突：一端删除，另一端修改`,
        impact: 'data_loss',
        affectedEntities: [entityId],
        autoResolveable: false,
        complexityScore: 70
      },
      suggestions: this.generateDeleteConflictSuggestions(localData, cloudData, localDeleted, cloudDeleted)
    })

    return {
      hasConflict: true,
      conflict,
      confidence: 0.95,
      executionTime: 0,
      details: { localDeleted, cloudDeleted }
    }
  }

  /**
   * 字段级冲突检测
   */
  private async detectFieldConflict(data: ConflictDetectionData): Promise<ConflictDetectionResult> {
    const { localData, cloudData, entity, entityId } = data

    const fieldConflicts = this.detectSpecificFieldConflicts(localData, cloudData)

    if (fieldConflicts.length === 0) {
      return { hasConflict: false, confidence: 0, executionTime: 0 }
    }

    const conflict = this.createConflict({
      id: crypto.randomUUID(),
      entity,
      entityId,
      conflictType: 'field',
      severity: 'medium',
      localData,
      cloudData,
      localVersion: localData.sync_version || 0,
      cloudVersion: cloudData.sync_version || 0,
      localTimestamp: new Date(localData.updated_at || localData.createdAt),
      cloudTimestamp: new Date(cloudData.updated_at || cloudData.created_at),
      context: data.context,
      conflictFields: fieldConflicts.map(f => f.fieldName),
      details: {
        description: `字段级冲突：${fieldConflicts.length} 个关键字段存在差异`,
        impact: 'inconsistency',
        affectedEntities: [entityId],
        autoResolveable: true,
        complexityScore: Math.min(100, fieldConflicts.length * 15)
      },
      suggestions: this.generateFieldConflictSuggestions(fieldConflicts)
    })

    return {
      hasConflict: true,
      conflict,
      confidence: 0.85,
      executionTime: 0,
      details: { fieldConflicts, conflictCount: fieldConflicts.length }
    }
  }

  /**
   * 引用完整性冲突检测
   */
  private async detectReferenceConflict(data: ConflictDetectionData): Promise<ConflictDetectionResult> {
    const { localData, cloudData, entity, entityId } = data

    const referenceConflicts = await this.detectReferenceIntegrityConflicts(localData, cloudData, entity)

    if (referenceConflicts.length === 0) {
      return { hasConflict: false, confidence: 0, executionTime: 0 }
    }

    const conflict = this.createConflict({
      id: crypto.randomUUID(),
      entity,
      entityId,
      conflictType: 'structure',
      severity: this.calculateReferenceConflictSeverity(referenceConflicts),
      localData,
      cloudData,
      localVersion: localData.sync_version || 0,
      cloudVersion: cloudData.sync_version || 0,
      localTimestamp: new Date(localData.updated_at || localData.createdAt),
      cloudTimestamp: new Date(cloudData.updated_at || cloudData.created_at),
      context: data.context,
      conflictFields: referenceConflicts.map(r => r.referenceField),
      details: {
        description: `引用完整性冲突：${referenceConflicts.length} 个引用关系不匹配`,
        impact: 'structure_break',
        affectedEntities: [...referenceConflicts.map(r => r.affectedEntity), entityId],
        autoResolveable: referenceConflicts.length <= 1,
        complexityScore: Math.min(100, referenceConflicts.length * 30)
      },
      suggestions: this.generateReferenceConflictSuggestions(referenceConflicts)
    })

    return {
      hasConflict: true,
      conflict,
      confidence: 0.8,
      executionTime: 0,
      details: { referenceConflicts, conflictCount: referenceConflicts.length }
    }
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private createConflict(data: {
    id: string
    entity: string
    entityId: string
    conflictType: string
    severity: string
    localData: any
    cloudData: any
    localVersion: number
    cloudVersion: number
    localTimestamp: Date
    cloudTimestamp: Date
    context: ConflictContext
    conflictFields?: string[]
    details: ConflictDetails
    suggestions: ConflictSuggestion[]
  }): UnifiedConflict {
    return {
      id: data.id,
      entityType: data.entity as any,
      entityId: data.entityId,
      conflictType: data.conflictType as any,
      severity: data.severity as any,
      status: 'pending',
      localData: data.localData,
      cloudData: data.cloudData,
      localVersion: data.localVersion,
      cloudVersion: data.cloudVersion,
      localTimestamp: data.localTimestamp,
      cloudTimestamp: data.cloudTimestamp,
      conflictFields: data.conflictFields,
      conflictDetails: data.details,
      suggestions: data.suggestions,
      detectedAt: new Date(),
      sourceDevice: data.context.deviceId,
      context: data.context,
      detectionTime: 0
    }
  }

  private generateCacheKey(entity: string, entityId: string, localData: any, cloudData: any): string {
    const localHash = this.hashObject(localData)
    const cloudHash = this.hashObject(cloudData)
    return `${entity}:${entityId}:${localHash}:${cloudHash}`
  }

  private hashObject(obj: any): string {
    if (obj === undefined || obj === null) {
      return 'null'
    }

    const str = JSON.stringify(obj)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(16)
  }

  private isWithinResourceLimits(rule: ConflictDetectionRule): boolean {
    // 简单的资源限制检查
    return true // 可以根据需要实现更复杂的检查
  }

  private updateAverageDetectionTime(newTime: number): void {
    this.stats.averageDetectionTime =
      (this.stats.averageDetectionTime * (this.stats.successfulDetections - 1) + newTime) /
      this.stats.successfulDetections
  }

  // ============================================================================
  // 冲突严重性计算方法
  // ============================================================================

  private calculateVersionConflictSeverity(localVersion: number, cloudVersion: number): 'low' | 'medium' | 'high' | 'critical' {
    const diff = Math.abs(localVersion - cloudVersion)
    if (diff === 1) return 'low'
    if (diff <= 5) return 'medium'
    if (diff <= 10) return 'high'
    return 'critical'
  }

  private calculateContentConflictSeverity(conflictingFields: string[]): 'low' | 'medium' | 'high' | 'critical' {
    if (conflictingFields.length <= 2) return 'low'
    if (conflictingFields.length <= 5) return 'medium'
    if (conflictingFields.length <= 8) return 'high'
    return 'critical'
  }

  private calculateStructureConflictSeverity(missingInLocal: string[], missingInCloud: string[]): 'low' | 'medium' | 'high' | 'critical' {
    const total = missingInLocal.length + missingInCloud.length
    if (total <= 2) return 'low'
    if (total <= 5) return 'medium'
    if (total <= 8) return 'high'
    return 'critical'
  }

  private calculateReferenceConflictSeverity(conflicts: any[]): 'low' | 'medium' | 'high' | 'critical' {
    if (conflicts.length === 1) return 'medium'
    if (conflicts.length <= 3) return 'high'
    return 'critical'
  }

  // ============================================================================
  // 内容冲突检测方法
  // ============================================================================

  private detectContentConflicts(localData: any, cloudData: any): string[] {
    const conflicts: string[] = []

    // 检测正面内容冲突
    if (localData.frontContent && cloudData.frontContent) {
      const frontConflicts = this.detectContentFieldConflicts(localData.frontContent, cloudData.frontContent, 'frontContent')
      conflicts.push(...frontConflicts)
    }

    // 检测背面内容冲突
    if (localData.backContent && cloudData.backContent) {
      const backConflicts = this.detectContentFieldConflicts(localData.backContent, cloudData.backContent, 'backContent')
      conflicts.push(...backConflicts)
    }

    // 检测样式冲突
    if (localData.style && cloudData.style) {
      const styleConflicts = this.detectStyleConflicts(localData.style, cloudData.style)
      conflicts.push(...styleConflicts)
    }

    return conflicts
  }

  private detectContentFieldConflicts(local: any, cloud: any, prefix: string): string[] {
    const conflicts: string[] = []
    const fields = ['title', 'text', 'tags']

    for (const field of fields) {
      if (!this.deepEqual(local[field], cloud[field])) {
        conflicts.push(`${prefix}.${field}`)
      }
    }

    return conflicts
  }

  private detectStyleConflicts(localStyle: any, cloudStyle: any): string[] {
    const conflicts: string[] = []
    const styleFields = ['backgroundColor', 'textColor', 'borderRadius', 'fontFamily']

    for (const field of styleFields) {
      if (!this.deepEqual(localStyle[field], cloudStyle[field])) {
        conflicts.push(`style.${field}`)
      }
    }

    return conflicts
  }

  private detectSpecificFieldConflicts(localData: any, cloudData: any): Array<{
    fieldName: string
    localValue: any
    cloudValue: any
    conflictType: string
  }> {
    const conflicts: Array<{
      fieldName: string
      localValue: any
      cloudValue: any
      conflictType: string
    }> = []

    // 检测关键字段
    const keyFields = ['folderId', 'name', 'color', 'isDeleted', 'deleted_at']

    for (const field of keyFields) {
      if (localData[field] !== undefined && cloudData[field] !== undefined) {
        if (!this.deepEqual(localData[field], cloudData[field])) {
          conflicts.push({
            fieldName: field,
            localValue: localData[field],
            cloudValue: cloudData[field],
            conflictType: 'value_mismatch'
          })
        }
      }
    }

    return conflicts
  }

  private async detectReferenceIntegrityConflicts(localData: any, cloudData: any, entity: string): Promise<Array<{
    referenceField: string
    affectedEntity: string
    conflictType: string
  }>> {
    const conflicts: Array<{
      referenceField: string
      affectedEntity: string
      conflictType: string
    }> = []

    // 检测文件夹引用
    if (entity === 'card' && (localData.folderId !== cloudData.folderId)) {
      if (localData.folderId || cloudData.folderId) {
        conflicts.push({
          referenceField: 'folderId',
          affectedEntity: 'folder',
          conflictType: 'folder_reference_mismatch'
        })
      }
    }

    // 检测标签引用
    if (localData.tags && cloudData.tags) {
      const localTags = new Set(localData.tags || [])
      const cloudTags = new Set(cloudData.tags || [])

      if (!this.setsEqual(localTags, cloudTags)) {
        conflicts.push({
          referenceField: 'tags',
          affectedEntity: 'tag',
          conflictType: 'tag_reference_mismatch'
        })
      }
    }

    return conflicts
  }

  // ============================================================================
  // 建议生成方法
  // ============================================================================

  private generateVersionConflictSuggestions(localData: any, cloudData: any, localVersion: number, cloudVersion: number): ConflictSuggestion[] {
    const suggestions: ConflictSuggestion[] = []

    const isLocalNewer = localVersion > cloudVersion
    const newerVersion = isLocalNewer ? 'local' : 'cloud'

    suggestions.push({
      id: crypto.randomUUID(),
      type: newerVersion === 'local' ? 'keep_local' : 'keep_cloud',
      title: `保留${newerVersion === 'local' ? '本地' : '云端'}版本`,
      description: `选择版本号较高的${newerVersion === 'local' ? '本地' : '云端'}版本`,
      confidence: 0.8,
      reasoning: `基于版本号优先级，${newerVersion === 'local' ? '本地' : '云端'}版本更新`,
      estimatedTime: 2
    })

    return suggestions
  }

  private generateContentConflictSuggestions(localData: any, cloudData: any, conflictingFields: string[]): ConflictSuggestion[] {
    const suggestions: ConflictSuggestion[] = []

    if (conflictingFields.length <= 3) {
      suggestions.push({
        id: crypto.randomUUID(),
        type: 'merge',
        title: '智能合并',
        description: '智能合并不同字段的内容',
        confidence: 0.7,
        reasoning: '字段数量较少，可以安全合并',
        estimatedTime: 5
      })
    }

    const localTime = new Date(localData.updated_at || localData.createdAt).getTime()
    const cloudTime = new Date(cloudData.updated_at || cloudData.created_at).getTime()
    const newerVersion = localTime > cloudTime ? 'local' : 'cloud'

    suggestions.push({
      id: crypto.randomUUID(),
      type: newerVersion === 'local' ? 'keep_local' : 'keep_cloud',
      title: `保留${newerVersion === 'local' ? '本地' : '云端'}版本`,
      description: `选择修改时间较新的${newerVersion === 'local' ? '本地' : '云端'}版本`,
      confidence: 0.6,
      reasoning: `基于时间戳优先级，${newerVersion === 'local' ? '本地' : '云端'}版本更新`,
      estimatedTime: 2
    })

    return suggestions
  }

  private generateStructureConflictSuggestions(localData: any, cloudData: any, missingInLocal: string[], missingInCloud: string[]): ConflictSuggestion[] {
    const suggestions: ConflictSuggestion[] = []

    suggestions.push({
      id: crypto.randomUUID(),
      type: 'manual',
      title: '手动解决',
      description: '结构冲突需要手动处理字段差异',
      confidence: 0.9,
      reasoning: '结构差异较复杂，建议手动处理以确保数据完整性',
      estimatedTime: 10
    })

    return suggestions
  }

  private generateDeleteConflictSuggestions(localData: any, cloudData: any, localDeleted: boolean, cloudDeleted: boolean): ConflictSuggestion[] {
    const suggestions: ConflictSuggestion[] = []

    if (localDeleted) {
      suggestions.push({
        id: crypto.randomUUID(),
        type: 'keep_local',
        title: '确认删除',
        description: '确认删除操作，同步删除云端数据',
        confidence: 0.8,
        reasoning: '本地已标记删除，建议同步删除状态',
        estimatedTime: 3
      })
    } else {
      suggestions.push({
        id: crypto.randomUUID(),
        type: 'keep_cloud',
        title: '恢复数据',
        description: '云端已删除，恢复本地数据状态',
        confidence: 0.8,
        reasoning: '云端已删除，建议同步删除状态',
        estimatedTime: 3
      })
    }

    return suggestions
  }

  private generateFieldConflictSuggestions(fieldConflicts: any[]): ConflictSuggestion[] {
    const suggestions: ConflictSuggestion[] = []

    suggestions.push({
      id: crypto.randomUUID(),
      type: 'merge',
      title: '字段级合并',
      description: '逐个字段智能合并',
      confidence: 0.8,
      reasoning: '字段级冲突可以精确合并',
      estimatedTime: 8,
      fieldResolutions: fieldConflicts.map(field => ({
        fieldName: field.fieldName,
        resolution: 'merge',
        reasoning: `智能合并${field.fieldName}字段`
      }))
    })

    return suggestions
  }

  private generateReferenceConflictSuggestions(referenceConflicts: any[]): ConflictSuggestion[] {
    const suggestions: ConflictSuggestion[] = []

    suggestions.push({
      id: crypto.randomUUID(),
      type: 'manual',
      title: '手动修复引用',
      description: '引用关系需要手动修复',
      confidence: 0.9,
      reasoning: '引用完整性问题需要仔细处理',
      estimatedTime: 15
    })

    return suggestions
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true
    if (a == null || b == null) return false
    if (typeof a !== typeof b) return false
    if (typeof a === 'object') {
      return JSON.stringify(a) === JSON.stringify(b)
    }
    return false
  }

  private setsEqual(a: Set<any>, b: Set<any>): boolean {
    if (a.size !== b.size) return false
    for (const item of a) {
      if (!b.has(item)) return false
    }
    return true
  }

  /**
   * 获取检测统计信息
   */
  getDetectionStats() {
    return {
      ...this.stats,
      cacheHitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) || 0,
      successRate: this.stats.successfulDetections / this.stats.totalDetections || 0
    }
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.detectionCache.clear()
  }

  /**
   * 添加自定义检测规则
   */
  addDetectionRule(rule: ConflictDetectionRule): void {
    this.detectionRules.set(rule.id, rule)
  }

  /**
   * 移除检测规则
   */
  removeDetectionRule(ruleId: string): void {
    this.detectionRules.delete(ruleId)
  }

  /**
   * 获取所有检测规则
   */
  getDetectionRules(): ConflictDetectionRule[] {
    return Array.from(this.detectionRules.values())
  }

  /**
   * 启用/禁用检测规则
   */
  setDetectionRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.detectionRules.get(ruleId)
    if (rule) {
      rule.enabled = enabled
      rule.lastModified = new Date()
    }
  }
}

// 导出单例实例
export const conflictDetector = new ConflictDetector()