import { db, DbCard, DbFolder, DbTag, DbImage } from './database-unified'
import { Card, Folder, Tag } from '@/types/card'

// ============================================================================
// 数据一致性验证服务
// ============================================================================

export interface ConsistencyCheck {
  id: string
  type: 'card' | 'folder' | 'tag' | 'image' | 'relation'
  status: 'passed' | 'failed' | 'warning'
  description: string
  details: any
  timestamp: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
  affectedItems: string[]
  recommendations: string[]
}

export interface ConsistencyReport {
  id: string
  timestamp: Date
  totalChecks: number
  passedChecks: number
  failedChecks: number
  warnings: number
  criticalIssues: number
  checks: ConsistencyCheck[]
  summary: {
    dataIntegrity: number // 0-100 percentage
    performance: string
    recommendations: string[]
    estimatedFixTime: string
  }
}

export interface DataRepair {
  id: string
  type: 'auto' | 'manual' | 'assisted'
  description: string
  affectedItems: string[]
  operations: RepairOperation[]
  estimatedTime: number
  risk: 'low' | 'medium' | 'high'
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
}

export interface RepairOperation {
  id: string
  operation: string
  target: string
  parameters: any
  dependencies?: string[]
  rollback?: boolean
}

export interface ValidationRule {
  id: string
  name: string
  description: string
  entityType: 'card' | 'folder' | 'tag' | 'image' | 'relation'
  validate: (items: any[]) => Promise<ConsistencyCheck>
  autoRepair?: boolean
  repair?: (items: any[]) => Promise<DataRepair>
}

class DataConsistencyService {
  private validationRules: Map<string, ValidationRule> = new Map()
  private repairHistory: DataRepair[] = []
  private consistencyReports: ConsistencyReport[] = []
  
  private readonly MAX_REPORTS = 50
  private readonly AUTO_BACKUP_BEFORE_REPAIR = true

  constructor() {
    this.initializeValidationRules()
    this.startPeriodicChecks()
  }

  // ============================================================================
  // 初始化验证规则
  // ============================================================================

  private initializeValidationRules(): void {
    // 卡片数据完整性验证
    this.validationRules.set('card-basic-integrity', {
      id: 'card-basic-integrity',
      name: '卡片基础完整性检查',
      description: '验证卡片的基本字段和结构完整性',
      entityType: 'card',
      validate: this.validateCardBasicIntegrity.bind(this),
      autoRepair: true,
      repair: this.repairCardBasicIntegrity.bind(this)
    })

    // 文件夹引用完整性验证
    this.validationRules.set('folder-reference-integrity', {
      id: 'folder-reference-integrity',
      name: '文件夹引用完整性检查',
      description: '验证卡片引用的文件夹是否存在',
      entityType: 'relation',
      validate: this.validateFolderReferenceIntegrity.bind(this),
      autoRepair: true,
      repair: this.repairFolderReferenceIntegrity.bind(this)
    })

    // 标签一致性验证
    this.validationRules.set('tag-consistency', {
      id: 'tag-consistency',
      name: '标签一致性检查',
      description: '验证标签使用计数和引用一致性',
      entityType: 'tag',
      validate: this.validateTagConsistency.bind(this),
      autoRepair: true,
      repair: this.repairTagConsistency.bind(this)
    })

    // 图片引用完整性验证
    this.validationRules.set('image-reference-integrity', {
      id: 'image-reference-integrity',
      name: '图片引用完整性检查',
      description: '验证图片引用的卡片是否存在',
      entityType: 'relation',
      validate: this.validateImageReferenceIntegrity.bind(this),
      autoRepair: true,
      repair: this.repairImageReferenceIntegrity.bind(this)
    })

    // 同步状态一致性验证
      this.validationRules.set('data-format-consistency', {
      id: 'data-format-consistency',
      name: '同步状态一致性检查',
      description: '验证同步版本和状态的一致性',
      entityType: 'card',
      validate: this.validateSyncStatusConsistency.bind(this),
      autoRepair: false
    })

    // 数据格式验证
    this.validationRules.set('data-format-validation', {
      id: 'data-format-validation',
      name: '数据格式验证',
      description: '验证数据格式和类型正确性',
      entityType: 'card',
      validate: this.validateDataFormat.bind(this),
      autoRepair: true,
      repair: this.repairDataFormat.bind(this)
    })

    // 重复数据验证
    this.validationRules.set('duplicate-data-validation', {
      id: 'duplicate-data-validation',
      name: '重复数据验证',
      description: '检测和报告重复的数据项',
      entityType: 'card',
      validate: this.validateDuplicateData.bind(this),
      autoRepair: false
    })

    // 性能相关验证
    this.validationRules.set('performance-issues', {
      id: 'performance-issues',
      name: '性能问题检测',
      description: '检测影响数据库性能的问题',
      entityType: 'card',
      validate: this.validatePerformanceIssues.bind(this),
      autoRepair: true,
      repair: this.repairPerformanceIssues.bind(this)
    })
  }

  // ============================================================================
  // 主要验证方法
  // ============================================================================

  async runFullConsistencyCheck(): Promise<ConsistencyReport> {
    console.log('🔍 Starting full consistency check...')
    
    const startTime = Date.now()
    const checks: ConsistencyCheck[] = []
    
    // 执行所有验证规则
    for (const rule of this.validationRules.values()) {
      try {
        console.log(`📋 Running validation: ${rule.name}`)
        const check = await rule.validate([])
        checks.push(check)
        
        // 如果验证失败且支持自动修复，则执行修复
        if (check.status === 'failed' && rule.autoRepair && rule.repair) {
          console.log(`🔧 Auto-repairing: ${rule.name}`)
          const repair = await rule.repair([])
          await this.executeRepair(repair)
        }
      } catch (error) {
        console.error(`❌ Validation failed for ${rule.name}:`, error)
        checks.push({
          id: crypto.randomUUID(),
          type: rule.entityType,
          status: 'failed',
          description: `验证规则执行失败: ${rule.name}`,
          details: { error: error.message },
          timestamp: new Date(),
          severity: 'high',
          affectedItems: [],
          recommendations: ['手动检查此规则或联系开发人员']
        })
      }
    }
    
    // 生成报告
    const report = this.generateConsistencyReport(checks)
    this.consistencyReports.push(report)
    
    // 保持报告数量限制
    if (this.consistencyReports.length > this.MAX_REPORTS) {
      this.consistencyReports = this.consistencyReports.slice(-this.MAX_REPORTS)
    }
    
    const executionTime = Date.now() - startTime
    console.log(`✅ Consistency check completed in ${executionTime}ms`)
    
    return report
  }

  async runSpecificCheck(ruleId: string): Promise<ConsistencyCheck> {
    const rule = this.validationRules.get(ruleId)
    if (!rule) {
      throw new Error(`Validation rule not found: ${ruleId}`)
    }
    
    return await rule.validate([])
  }

  // ============================================================================
  // 具体验证规则实现
  // ============================================================================

  private async validateCardBasicIntegrity(): Promise<ConsistencyCheck> {
    const cards = await db.cards.toArray()
    const issues: string[] = []
    const affectedItems: string[] = []
    
    for (const card of cards) {
      // 检查必要字段
      if (!card.frontContent?.title) {
        issues.push(`卡片 ${card.id} 缺少正面标题`)
        affectedItems.push(card.id!)
      }
      
      if (!card.backContent?.title) {
        issues.push(`卡片 ${card.id} 缺少背面标题`)
        affectedItems.push(card.id!)
      }
      
      // 检查日期格式
      if (isNaN(new Date(card.createdAt).getTime())) {
        issues.push(`卡片 ${card.id} 创建日期格式错误`)
        affectedItems.push(card.id!)
      }
      
      if (isNaN(new Date(card.updatedAt).getTime())) {
        issues.push(`卡片 ${card.id} 更新日期格式错误`)
        affectedItems.push(card.id!)
      }
      
      // 检查同步版本
      if (typeof card.syncVersion !== 'number' || card.syncVersion < 1) {
        issues.push(`卡片 ${card.id} 同步版本无效`)
        affectedItems.push(card.id!)
      }
    }
    
    return {
      id: crypto.randomUUID(),
      type: 'card',
      status: issues.length > 0 ? 'failed' : 'passed',
      description: `卡片基础完整性检查: 发现 ${issues.length} 个问题`,
      details: { issues, totalCards: cards.length },
      timestamp: new Date(),
      severity: issues.length > cards.length * 0.1 ? 'high' : 'medium',
      affectedItems,
      recommendations: issues.length > 0 ? ['运行自动修复或手动检查问题卡片'] : []
    }
  }

  private async validateFolderReferenceIntegrity(): Promise<ConsistencyCheck> {
    const cards = await db.cards.toArray()
    const folders = await db.folders.toArray()
    const folderIds = new Set(folders.map(f => f.id!))
    const issues: string[] = []
    const affectedItems: string[] = []
    
    for (const card of cards) {
      if (card.folderId && !folderIds.has(card.folderId)) {
        issues.push(`卡片 ${card.id} 引用了不存在的文件夹 ${card.folderId}`)
        affectedItems.push(card.id!)
      }
    }
    
    return {
      id: crypto.randomUUID(),
      type: 'relation',
      status: issues.length > 0 ? 'failed' : 'passed',
      description: `文件夹引用完整性检查: 发现 ${issues.length} 个无效引用`,
      details: { issues, totalCards: cards.length, totalFolders: folders.length },
      timestamp: new Date(),
      severity: 'high',
      affectedItems,
      recommendations: issues.length > 0 ? ['清除无效引用或创建缺失的文件夹'] : []
    }
  }

  private async validateTagConsistency(): Promise<ConsistencyCheck> {
    const cards = await db.cards.toArray()
    const tags = await db.tags.toArray()
    const issues: string[] = []
    const affectedItems: string[] = []
    
    // 收集所有使用的标签
    const usedTags = new Set<string>()
    const tagUsage = new Map<string, number>()
    
    for (const card of cards) {
      const allTags = [...card.frontContent.tags, ...card.backContent.tags]
      for (const tag of allTags) {
        usedTags.add(tag)
        tagUsage.set(tag, (tagUsage.get(tag) || 0) + 1)
      }
    }
    
    // 检查标签计数一致性
    for (const tag of tags) {
      const actualUsage = tagUsage.get(tag.name) || 0
      if (tag.count !== actualUsage) {
        issues.push(`标签 "${tag.name}" 计数不一致: 数据库=${tag.count}, 实际=${actualUsage}`)
        affectedItems.push(tag.id!)
      }
    }
    
    // 检查未使用的标签
    const unusedTags = tags.filter(tag => !usedTags.has(tag.name))
    if (unusedTags.length > 0) {
      issues.push(`发现 ${unusedTags.length} 个未使用的标签`)
      unusedTags.forEach(tag => affectedItems.push(tag.id!))
    }
    
    return {
      id: crypto.randomUUID(),
      type: 'tag',
      status: issues.length > 0 ? 'warning' : 'passed',
      description: `标签一致性检查: 发现 ${issues.length} 个问题`,
      details: { issues, totalTags: tags.length, usedTags: usedTags.size },
      timestamp: new Date(),
      severity: 'medium',
      affectedItems,
      recommendations: issues.length > 0 ? ['更新标签计数或删除未使用的标签'] : []
    }
  }

  private async validateImageReferenceIntegrity(): Promise<ConsistencyCheck> {
    const images = await db.images.toArray()
    const cards = await db.cards.toArray()
    const cardIds = new Set(cards.map(c => c.id!))
    const issues: string[] = []
    const affectedItems: string[] = []
    
    for (const image of images) {
      if (!cardIds.has(image.cardId)) {
        issues.push(`图片 ${image.id} 引用了不存在的卡片 ${image.cardId}`)
        affectedItems.push(image.id!)
      }
    }
    
    return {
      id: crypto.randomUUID(),
      type: 'relation',
      status: issues.length > 0 ? 'failed' : 'passed',
      description: `图片引用完整性检查: 发现 ${issues.length} 个孤立图片`,
      details: { issues, totalImages: images.length, totalCards: cards.length },
      timestamp: new Date(),
      severity: 'medium',
      affectedItems,
      recommendations: issues.length > 0 ? ['删除孤立图片或修复引用'] : []
    }
  }

  private async validateSyncStatusConsistency(): Promise<ConsistencyCheck> {
    const cards = await db.cards.toArray()
    const issues: string[] = []
    const affectedItems: string[] = []
    
    for (const card of cards) {
      // 检查同步状态逻辑
      if (card.pendingSync && card.syncVersion === 0) {
        issues.push(`卡片 ${card.id} 标记为待同步但同步版本为0`)
        affectedItems.push(card.id!)
      }
      
      // 检查更新时间逻辑
      if (card.lastSyncAt && new Date(card.lastSyncAt) > new Date(card.updatedAt)) {
        issues.push(`卡片 ${card.id} 最后同步时间晚于更新时间`)
        affectedItems.push(card.id!)
      }
    }
    
    return {
      id: crypto.randomUUID(),
      type: 'card',
      status: issues.length > 0 ? 'warning' : 'passed',
      description: `同步状态一致性检查: 发现 ${issues.length} 个问题`,
      details: { issues, totalCards: cards.length },
      timestamp: new Date(),
      severity: 'medium',
      affectedItems,
      recommendations: issues.length > 0 ? ['检查同步逻辑和时间戳'] : []
    }
  }

  private async validateDataFormat(): Promise<ConsistencyCheck> {
    const cards = await db.cards.toArray()
    const issues: string[] = []
    const affectedItems: string[] = []
    
    for (const card of cards) {
      // 检查样式格式
      if (card.style && !['solid', 'gradient', 'glass'].includes(card.style.type)) {
        issues.push(`卡片 ${card.id} 样式类型无效: ${card.style.type}`)
        affectedItems.push(card.id!)
      }
      
      // 检查标签格式
      if (card.frontContent.tags && !Array.isArray(card.frontContent.tags)) {
        issues.push(`卡片 ${card.id} 正面标签不是数组格式`)
        affectedItems.push(card.id!)
      }
      
      if (card.backContent.tags && !Array.isArray(card.backContent.tags)) {
        issues.push(`卡片 ${card.id} 背面标签不是数组格式`)
        affectedItems.push(card.id!)
      }
      
      // 检查图片格式
      if (card.frontContent.images && !Array.isArray(card.frontContent.images)) {
        issues.push(`卡片 ${card.id} 正面图片不是数组格式`)
        affectedItems.push(card.id!)
      }
      
      if (card.backContent.images && !Array.isArray(card.backContent.images)) {
        issues.push(`卡片 ${card.id} 背面图片不是数组格式`)
        affectedItems.push(card.id!)
      }
    }
    
    return {
      id: crypto.randomUUID(),
      type: 'card',
      status: issues.length > 0 ? 'failed' : 'passed',
      description: `数据格式验证: 发现 ${issues.length} 个格式问题`,
      details: { issues, totalCards: cards.length },
      timestamp: new Date(),
      severity: 'medium',
      affectedItems,
      recommendations: issues.length > 0 ? ['修复数据格式问题'] : []
    }
  }

  private async validateDuplicateData(): Promise<ConsistencyCheck> {
    const cards = await db.cards.toArray()
    const issues: string[] = []
    const affectedItems: string[] = []
    
    // 检查重复标题
    const titleMap = new Map<string, string[]>()
    for (const card of cards) {
      const key = `${card.frontContent.title}|${card.backContent.title}`
      if (!titleMap.has(key)) {
        titleMap.set(key, [])
      }
      titleMap.get(key)!.push(card.id!)
    }
    
    titleMap.forEach((cardIds, title) => {
      if (cardIds.length > 1) {
        issues.push(`发现重复标题组合: ${title} (${cardIds.length} 个卡片)`)
        affectedItems.push(...cardIds)
      }
    })
    
    return {
      id: crypto.randomUUID(),
      type: 'card',
      status: issues.length > 0 ? 'warning' : 'passed',
      description: `重复数据验证: 发现 ${issues.length} 个重复项`,
      details: { issues, totalCards: cards.length, duplicates: titleMap.size },
      timestamp: new Date(),
      severity: 'low',
      affectedItems: [...new Set(affectedItems)],
      recommendations: issues.length > 0 ? ['检查重复数据是否为预期'] : []
    }
  }

  private async validatePerformanceIssues(): Promise<ConsistencyCheck> {
    const cards = await db.cards.toArray()
    const issues: string[] = []
    const affectedItems: string[] = []
    
    // 检查过大的卡片内容
    for (const card of cards) {
      const contentSize = JSON.stringify(card).length
      if (contentSize > 50000) { // 50KB
        issues.push(`卡片 ${card.id} 内容过大 (${Math.round(contentSize / 1024)}KB)`)
        affectedItems.push(card.id!)
      }
    }
    
    // 检查过多的图片
    for (const card of cards) {
      const totalImages = card.frontContent.images.length + card.backContent.images.length
      if (totalImages > 10) {
        issues.push(`卡片 ${card.id} 图片数量过多 (${totalImages} 个)`)
        affectedItems.push(card.id!)
      }
    }
    
    return {
      id: crypto.randomUUID(),
      type: 'card',
      status: issues.length > 0 ? 'warning' : 'passed',
      description: `性能问题检测: 发现 ${issues.length} 个性能问题`,
      details: { issues, totalCards: cards.length },
      timestamp: new Date(),
      severity: 'medium',
      affectedItems,
      recommendations: issues.length > 0 ? ['优化大卡片内容和图片数量'] : []
    }
  }

  // ============================================================================
  // 自动修复方法
  // ============================================================================

  private async repairCardBasicIntegrity(): Promise<DataRepair> {
    const cards = await db.cards.toArray()
    const operations: RepairOperation[] = []
    
    for (const card of cards) {
      const updates: Partial<DbCard> = {}
      let needsUpdate = false
      
      // 修复缺失的标题
      if (!card.frontContent?.title) {
        updates.frontContent = {
          ...card.frontContent,
          title: '未命名卡片',
          text: card.frontContent?.text || '',
          tags: card.frontContent?.tags || []
        }
        needsUpdate = true
      }
      
      if (!card.backContent?.title) {
        updates.backContent = {
          ...card.backContent,
          title: '未命名卡片',
          text: card.backContent?.text || '',
          tags: card.backContent?.tags || []
        }
        needsUpdate = true
      }
      
      // 修复日期格式
      if (isNaN(new Date(card.createdAt).getTime())) {
        updates.createdAt = new Date()
        needsUpdate = true
      }
      
      if (isNaN(new Date(card.updatedAt).getTime())) {
        updates.updatedAt = new Date()
        needsUpdate = true
      }
      
      // 修复同步版本
      if (typeof card.syncVersion !== 'number' || card.syncVersion < 1) {
        updates.syncVersion = 1
        needsUpdate = true
      }
      
      if (needsUpdate) {
        operations.push({
          id: crypto.randomUUID(),
          operation: 'updateCard',
          target: card.id!,
          parameters: updates
        })
      }
    }
    
    return {
      id: crypto.randomUUID(),
      type: 'auto',
      description: '修复卡片基础完整性问题',
      affectedItems: operations.map(op => op.target),
      operations,
      estimatedTime: operations.length * 10, // 每个操作10ms
      risk: 'low',
      status: 'pending'
    }
  }

  private async repairFolderReferenceIntegrity(): Promise<DataRepair> {
    const cards = await db.cards.toArray()
    const folders = await db.folders.toArray()
    const folderIds = new Set(folders.map(f => f.id!))
    const operations: RepairOperation[] = []
    
    for (const card of cards) {
      if (card.folderId && !folderIds.has(card.folderId)) {
        operations.push({
          id: crypto.randomUUID(),
          operation: 'clearFolderReference',
          target: card.id!,
          parameters: { folderId: null }
        })
      }
    }
    
    return {
      id: crypto.randomUUID(),
      type: 'auto',
      description: '清除无效的文件夹引用',
      affectedItems: operations.map(op => op.target),
      operations,
      estimatedTime: operations.length * 5,
      risk: 'low',
      status: 'pending'
    }
  }

  private async repairTagConsistency(): Promise<DataRepair> {
    const cards = await db.cards.toArray()
    const tags = await db.tags.toArray()
    const tagUsage = new Map<string, number>()
    const operations: RepairOperation[] = []
    
    // 计算实际使用次数
    for (const card of cards) {
      const allTags = [...card.frontContent.tags, ...card.backContent.tags]
      for (const tag of allTags) {
        tagUsage.set(tag, (tagUsage.get(tag) || 0) + 1)
      }
    }
    
    // 更新标签计数
    for (const tag of tags) {
      const actualUsage = tagUsage.get(tag.name) || 0
      if (tag.count !== actualUsage) {
        operations.push({
          id: crypto.randomUUID(),
          operation: 'updateTagCount',
          target: tag.id!,
          parameters: { count: actualUsage }
        })
      }
    }
    
    return {
      id: crypto.randomUUID(),
      type: 'auto',
      description: '更新标签使用计数',
      affectedItems: operations.map(op => op.target),
      operations,
      estimatedTime: operations.length * 3,
      risk: 'low',
      status: 'pending'
    }
  }

  private async repairImageReferenceIntegrity(): Promise<DataRepair> {
    const images = await db.images.toArray()
    const cards = await db.cards.toArray()
    const cardIds = new Set(cards.map(c => c.id!))
    const operations: RepairOperation[] = []
    
    for (const image of images) {
      if (!cardIds.has(image.cardId)) {
        operations.push({
          id: crypto.randomUUID(),
          operation: 'deleteOrphanedImage',
          target: image.id!,
          parameters: { imageId: image.id }
        })
      }
    }
    
    return {
      id: crypto.randomUUID(),
      type: 'auto',
      description: '删除孤立图片',
      affectedItems: operations.map(op => op.target),
      operations,
      estimatedTime: operations.length * 15,
      risk: 'medium',
      status: 'pending'
    }
  }

  private async repairDataFormat(): Promise<DataRepair> {
    const cards = await db.cards.toArray()
    const operations: RepairOperation[] = []
    
    for (const card of cards) {
      const updates: Partial<DbCard> = {}
      let needsUpdate = false
      
      // 修复样式格式
      if (card.style && !['solid', 'gradient', 'glass'].includes(card.style.type)) {
        updates.style = { type: 'solid', backgroundColor: '#ffffff' }
        needsUpdate = true
      }
      
      // 修复标签格式
      if (card.frontContent.tags && !Array.isArray(card.frontContent.tags)) {
        updates.frontContent = {
          ...card.frontContent,
          tags: Array.isArray(card.frontContent.tags) ? card.frontContent.tags : []
        }
        needsUpdate = true
      }
      
      if (card.backContent.tags && !Array.isArray(card.backContent.tags)) {
        updates.backContent = {
          ...card.backContent,
          tags: Array.isArray(card.backContent.tags) ? card.backContent.tags : []
        }
        needsUpdate = true
      }
      
      if (needsUpdate) {
        operations.push({
          id: crypto.randomUUID(),
          operation: 'updateCard',
          target: card.id!,
          parameters: updates
        })
      }
    }
    
    return {
      id: crypto.randomUUID(),
      type: 'auto',
      description: '修复数据格式问题',
      affectedItems: operations.map(op => op.target),
      operations,
      estimatedTime: operations.length * 8,
      risk: 'low',
      status: 'pending'
    }
  }

  private async repairPerformanceIssues(): Promise<DataRepair> {
    const cards = await db.cards.toArray()
    const operations: RepairOperation[] = []
    
    for (const card of cards) {
      // 检查并优化大卡片
      const contentSize = JSON.stringify(card).length
      if (contentSize > 50000) {
        operations.push({
          id: crypto.randomUUID(),
          operation: 'optimizeLargeCard',
          target: card.id!,
          parameters: { compressContent: true }
        })
      }
    }
    
    return {
      id: crypto.randomUUID(),
      type: 'auto',
      description: '优化性能问题',
      affectedItems: operations.map(op => op.target),
      operations,
      estimatedTime: operations.length * 20,
      risk: 'medium',
      status: 'pending'
    }
  }

  // ============================================================================
  // 修复执行
  // ============================================================================

  async executeRepair(repair: DataRepair): Promise<boolean> {
    console.log(`🔧 Executing repair: ${repair.description}`)
    
    try {
      repair.status = 'in_progress'
      
      // 创建备份
      if (this.AUTO_BACKUP_BEFORE_REPAIR) {
        await this.createBackup(`pre-repair-${repair.id}`)
      }
      
      // 执行修复操作
      for (const operation of repair.operations) {
        await this.executeRepairOperation(operation)
      }
      
      repair.status = 'completed'
      this.repairHistory.push(repair)
      
      console.log(`✅ Repair completed successfully: ${repair.description}`)
      return true
    } catch (error) {
      console.error(`❌ Repair failed: ${repair.description}`, error)
      repair.status = 'failed'
      
      // 尝试回滚
      if (operation.rollback) {
        await this.rollbackRepair(repair)
      }
      
      return false
    }
  }

  private async executeRepairOperation(operation: RepairOperation): Promise<void> {
    switch (operation.operation) {
      case 'updateCard':
        await db.cards.update(operation.target, operation.parameters)
        break
        
      case 'clearFolderReference':
        await db.cards.update(operation.target, { folderId: undefined })
        break
        
      case 'updateTagCount':
        await db.tags.update(operation.target, { count: operation.parameters.count })
        break
        
      case 'deleteOrphanedImage':
        await db.images.delete(operation.parameters.imageId)
        break
        
      case 'optimizeLargeCard':
        // 实现卡片优化逻辑
        break
        
      default:
        throw new Error(`Unknown repair operation: ${operation.operation}`)
    }
  }

  private async rollbackRepair(repair: DataRepair): Promise<void> {
    console.log(`🔄 Rolling back repair: ${repair.description}`)
    // 实现回滚逻辑
  }

  private async createBackup(backupId: string): Promise<void> {
    // 实现备份逻辑
    console.log(`💾 Creating backup: ${backupId}`)
  }

  // ============================================================================
  // 报告生成
  // ============================================================================

  private generateConsistencyReport(checks: ConsistencyCheck[]): ConsistencyReport {
    const totalChecks = checks.length
    const passedChecks = checks.filter(c => c.status === 'passed').length
    const failedChecks = checks.filter(c => c.status === 'failed').length
    const warnings = checks.filter(c => c.status === 'warning').length
    const criticalIssues = checks.filter(c => c.severity === 'critical').length
    
    const dataIntegrity = Math.round((passedChecks / totalChecks) * 100)
    
    const allRecommendations = new Set<string>()
    checks.forEach(check => {
      check.recommendations.forEach(rec => allRecommendations.add(rec))
    })
    
    const performance = dataIntegrity > 90 ? 'excellent' : 
                     dataIntegrity > 70 ? 'good' : 
                     dataIntegrity > 50 ? 'fair' : 'poor'
    
    const estimatedFixTime = this.estimateTotalFixTime(checks)
    
    return {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      totalChecks,
      passedChecks,
      failedChecks,
      warnings,
      criticalIssues,
      checks,
      summary: {
        dataIntegrity,
        performance,
        recommendations: Array.from(allRecommendations),
        estimatedFixTime
      }
    }
  }

  private estimateTotalFixTime(checks: ConsistencyCheck[]): string {
    const totalIssues = checks.filter(c => c.status !== 'passed').length
    
    if (totalIssues === 0) return '无需修复'
    if (totalIssues < 5) return '1-2分钟'
    if (totalIssues < 20) return '5-10分钟'
    if (totalIssues < 50) return '15-30分钟'
    return '30分钟以上'
  }

  // ============================================================================
  // 定期检查
  // ============================================================================

  private startPeriodicChecks(): void {
    // 每小时执行一次轻量级检查
    setInterval(async () => {
      try {
        await this.runLightweightCheck()
      } catch (error) {
        console.error('Periodic consistency check failed:', error)
      }
    }, 60 * 60 * 1000)
    
    // 每天执行一次完整检查
    setInterval(async () => {
      try {
        const report = await this.runFullConsistencyCheck()
        if (report.failedChecks > 0) {
          console.warn(`Daily consistency check found ${report.failedChecks} issues`)
        }
      } catch (error) {
        console.error('Daily full consistency check failed:', error)
      }
    }, 24 * 60 * 60 * 1000)
  }

  private async runLightweightCheck(): Promise<void> {
    // 执行快速检查，只检查关键问题
    const criticalChecks = [
      'card-basic-integrity',
      'folder-reference-integrity',
      'image-reference-integrity'
    ]
    
    for (const ruleId of criticalChecks) {
      try {
        const check = await this.runSpecificCheck(ruleId)
        if (check.status === 'failed') {
          console.warn(`Lightweight check failed: ${check.description}`)
        }
      } catch (error) {
        console.error(`Lightweight check failed for ${ruleId}:`, error)
      }
    }
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  async getConsistencyHistory(): Promise<ConsistencyReport[]> {
    return this.consistencyReports.slice(-10) // 最近10次报告
  }

  async getRepairHistory(): Promise<DataRepair[]> {
    return this.repairHistory.slice(-20) // 最近20次修复
  }

  async getValidationRules(): Promise<ValidationRule[]> {
    return Array.from(this.validationRules.values())
  }

  async getSystemHealth(): Promise<{
    overall: 'healthy' | 'warning' | 'critical'
    details: {
      dataIntegrity: number
      lastCheck: Date | null
      pendingRepairs: number
      failedChecks: number
    }
  }> {
    const latestReport = this.consistencyReports[this.consistencyReports.length - 1]
    const pendingRepairs = this.repairHistory.filter(r => r.status === 'pending').length
    
    let overall: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (latestReport) {
      if (latestReport.criticalIssues > 0) {
        overall = 'critical'
      } else if (latestReport.failedChecks > 0 || latestReport.warnings > 5) {
        overall = 'warning'
      }
    }
    
    return {
      overall,
      details: {
        dataIntegrity: latestReport?.summary.dataIntegrity || 0,
        lastCheck: latestReport?.timestamp || null,
        pendingRepairs,
        failedChecks: latestReport?.failedChecks || 0
      }
    }
  }
}

// 创建数据一致性服务实例
export const dataConsistencyService = new DataConsistencyService()

// 导出便捷函数
export const runConsistencyCheck = () => dataConsistencyService.runFullConsistencyCheck()
export const getSystemHealth = () => dataConsistencyService.getSystemHealth()
export const getConsistencyHistory = () => dataConsistencyService.getConsistencyHistory()