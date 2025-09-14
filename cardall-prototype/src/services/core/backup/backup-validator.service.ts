/**
 * 备份验证服务
 * 提供备份完整性验证、数据校验和自动修复功能
 */

import { BackupMetadata } from '../data-validator'

// ============================================================================
// 验证系统类型定义
// ============================================================================

export interface BackupValidator {
  id: string
  name: string
  description: string
  priority: number
  category: 'structure' | 'integrity' | 'business' | 'performance'
  validator: (data: any, metadata: BackupMetadata) => Promise<ValidatorResult>
  autoRepair: boolean
  enabled: boolean
}

export interface ValidatorResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  repaired?: boolean
  weight?: number
  details?: any
}

export interface ValidationResult extends ValidatorResult {
  validatorId?: string
  details?: any
  score?: number
}

export interface BackupValidationResult extends ValidationResult {
  details: {
    totalValidators: number
    passedValidators: number
    failedValidators: number
    autoRepairs: number
  }
}

export interface IntegrityCheck {
  id: string
  backupId: string
  timestamp: Date
  result: BackupValidationResult
  configId: string
}

export interface ValidationStats {
  totalChecks: number
  recentChecks: number
  passedChecks: number
  failedChecks: number
  averageScore: number
  lastCheck: Date | null
  criticalBackups: string[]
}

export interface ValidationReport {
  backupId: string
  timestamp: Date
  overallScore: number
  status: 'healthy' | 'warning' | 'critical'
  validators: Array<{
    id: string
    name: string
    status: 'passed' | 'failed' | 'warning'
    score: number
    errors: string[]
    warnings: string[]
    repaired: boolean
  }>
  recommendations: string[]
  summary: {
    totalIssues: number
    criticalIssues: number
    repairedIssues: number
    estimatedRepairTime: number
  }
}

// ============================================================================
// 备份验证服务类
// ============================================================================

export class BackupValidatorService {
  private validators: Map<string, BackupValidator> = new Map()
  private validationHistory: IntegrityCheck[] = []
  private cache: Map<string, { result: BackupValidationResult; timestamp: number }> = new Map()

  constructor() {
    this.initializeBackupValidation()
    this.startPeriodicIntegrityChecks()
  }

  /**
   * 初始化备份验证系统
   */
  private initializeBackupValidation(): void {
    this.registerDefaultValidators()
    this.loadValidationHistory()
  }

  /**
   * 注册默认验证器
   */
  private registerDefaultValidators(): void {
    // 结构验证器
    this.registerValidator('structure-basic', {
      id: 'structure-basic',
      name: '基础结构验证',
      description: '验证备份数据的基本结构和格式',
      priority: 100,
      category: 'structure',
      validator: this.validateBasicStructure.bind(this),
      autoRepair: false,
      enabled: true
    })

    // 完整性验证器
    this.registerValidator('integrity-checksum', {
      id: 'integrity-checksum',
      name: '校验和验证',
      description: '验证数据的校验和是否匹配',
      priority: 90,
      category: 'integrity',
      validator: this.validateChecksum.bind(this),
      autoRepair: false,
      enabled: true
    })

    // 数据关系验证器
    this.registerValidator('integrity-references', {
      id: 'integrity-references',
      name: '引用关系验证',
      description: '验证数据之间的引用关系是否完整',
      priority: 80,
      category: 'integrity',
      validator: this.validateReferences.bind(this),
      autoRepair: true,
      enabled: true
    })

    // 业务规则验证器
    this.registerValidator('business-rules', {
      id: 'business-rules',
      name: '业务规则验证',
      description: '验证数据是否符合业务规则',
      priority: 70,
      category: 'business',
      validator: this.validateBusinessRules.bind(this),
      autoRepair: false,
      enabled: true
    })

    // 性能验证器
    this.registerValidator('performance-size', {
      id: 'performance-size',
      name: '文件大小验证',
      description: '验证备份文件大小是否合理',
      priority: 60,
      category: 'performance',
      validator: this.validateFileSize.bind(this),
      autoRepair: false,
      enabled: true
    })

    // 数据格式验证器
    this.registerValidator('structure-format', {
      id: 'structure-format',
      name: '数据格式验证',
      description: '验证数据格式是否符合预期',
      priority: 85,
      category: 'structure',
      validator: this.validateDataFormat.bind(this),
      autoRepair: true,
      enabled: true
    })

    // 时间戳验证器
    this.registerValidator('integrity-timestamps', {
      id: 'integrity-timestamps',
      name: '时间戳验证',
      description: '验证时间戳的合理性和一致性',
      priority: 75,
      category: 'integrity',
      validator: this.validateTimestamps.bind(this),
      autoRepair: false,
      enabled: true
    })

    // 唯一性验证器
    this.registerValidator('business-uniqueness', {
      id: 'business-uniqueness',
      name: '唯一性验证',
      description: '验证关键数据的唯一性',
      priority: 65,
      category: 'business',
      validator: this.validateUniqueness.bind(this),
      autoRepair: true,
      enabled: true
    })
  }

  /**
   * 注册验证器
   */
  private registerValidator(id: string, validator: BackupValidator): void {
    this.validators.set(id, validator)
  }

  /**
   * 验证备份完整性
   */
  async validateBackupIntegrity(backupId: string): Promise<BackupValidationResult> {
    try {
      // 检查缓存
      const cached = this.cache.get(backupId)
      if (cached && Date.now() - cached.timestamp < 300000) { // 5分钟缓存
        return cached.result
      }

      // 这里应该从实际存储中获取备份数据
      // 现在使用模拟数据
      const backup = await this.loadBackupForValidation(backupId)
      if (!backup) {
        throw new Error(`Backup ${backupId} not found`)
      }

      // 执行所有验证器
      const results: ValidationResult[] = []
      let totalWeight = 0
      let weightedScore = 0

      for (const validator of this.validators.values()) {
        if (!validator.enabled) continue

        try {
          const result = await validator.validator(backup.data, backup.metadata)
          result.validatorId = validator.id
          result.weight = validator.priority
          results.push(result)

          totalWeight += validator.priority
          weightedScore += result.valid ? validator.priority : 0
        } catch (error) {
          console.error(`Validator ${validator.id} failed:`, error)
          results.push({
            validatorId: validator.id,
            valid: false,
            errors: [`Validator error: ${error instanceof Error ? error.message : 'Unknown error'}`],
            warnings: [],
            weight: validator.priority
          })
        }
      }

      // 计算总体得分
      const overallScore = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0
      const passedValidators = results.filter(r => r.valid).length
      const failedValidators = results.filter(r => !r.valid).length

      const validationErrors = results.flatMap(r => r.errors)
      const validationWarnings = results.flatMap(r => r.warnings)

      // 尝试自动修复
      let autoRepairs = 0
      for (const result of results) {
        if (!result.valid && result.validatorId) {
          const validator = this.validators.get(result.validatorId)
          if (validator?.autoRepair) {
            const repairResult = await this.attemptAutoRepair(backupId, validator.id, result)
            if (repairResult.success) {
              autoRepairs++
              result.repaired = true
              result.valid = true // 标记为已修复
            }
          }
        }
      }

      const validationResult: BackupValidationResult = {
        valid: overallScore >= 80, // 80分以上为有效
        errors: validationErrors,
        warnings: validationWarnings,
        score: overallScore,
        details: {
          totalValidators: results.length,
          passedValidators,
          failedValidators,
          autoRepairs
        }
      }

      // 缓存结果
      this.cache.set(backupId, { result: validationResult, timestamp: Date.now() })

      // 记录验证历史
      this.recordValidationCheck(backupId, validationResult, 'system')

      return validationResult

    } catch (error) {
      console.error('Backup validation failed:', error)
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
        details: {
          totalValidators: 0,
          passedValidators: 0,
          failedValidators: 0,
          autoRepairs: 0
        }
      }
    }
  }

  /**
   * 加载备份数据用于验证
   */
  private async loadBackupForValidation(backupId: string): Promise<{
    data: any
    metadata: BackupMetadata
  } | null> {
    try {
      // 这里应该从实际存储中加载备份数据
      // 现在返回模拟数据
      const mockMetadata: BackupMetadata = {
        id: backupId,
        configId: 'default',
        name: 'Mock Backup',
        description: 'Mock backup for validation',
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

      const mockData = {
        cards: [
          {
            id: 'card1',
            title: 'Test Card',
            content: 'Test content',
            front: 'Front content',
            back: 'Back content',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        folders: [
          {
            id: 'folder1',
            name: 'Test Folder',
            color: '#3B82F6',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        tags: [
          {
            id: 'tag1',
            name: 'Test Tag',
            color: '#10B981',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      }

      return { data: mockData, metadata: mockMetadata }
    } catch (error) {
      console.error('Failed to load backup for validation:', error)
      return null
    }
  }

  /**
   * 基础结构验证
   */
  private async validateBasicStructure(data: any, metadata: BackupMetadata): Promise<ValidatorResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // 验证数据对象
    if (!data || typeof data !== 'object') {
      errors.push('Backup data is not an object')
    }

    // 验证必要字段
    const requiredTopLevelFields = ['cards', 'folders', 'tags']
    for (const field of requiredTopLevelFields) {
      if (!data[field]) {
        warnings.push(`Missing optional field: ${field}`)
      } else if (!Array.isArray(data[field])) {
        errors.push(`Field ${field} should be an array`)
      }
    }

    // 验证元数据
    if (!metadata.id) errors.push('Missing backup ID')
    if (!metadata.timestamp) errors.push('Missing backup timestamp')
    if (!metadata.type) errors.push('Missing backup type')

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 校验和验证
   */
  private async validateChecksum(data: any, metadata: BackupMetadata): Promise<ValidatorResult> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // 计算当前数据的校验和
      const currentChecksum = await this.calculateDataChecksum(data)

      if (currentChecksum !== metadata.checksum) {
        errors.push('Checksum mismatch - data may be corrupted')
        warnings.push('Expected: ' + metadata.checksum + ', Actual: ' + currentChecksum)
      }

    } catch (error) {
      errors.push(`Checksum calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 引用关系验证
   */
  private async validateReferences(data: any, metadata: BackupMetadata): Promise<ValidatorResult> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // 验证卡片的文件夹引用
      if (data.cards && Array.isArray(data.cards) && data.folders && Array.isArray(data.folders)) {
        const folderIds = new Set(data.folders.map((f: any) => f.id))
        const orphanedCards = data.cards.filter((card: any) => {
          return card.folderId && !folderIds.has(card.folderId)
        })

        if (orphanedCards.length > 0) {
          errors.push(`Found ${orphanedCards.length} cards with invalid folder references`)
          // 自动修复：移除无效的文件夹引用
          orphanedCards.forEach((card: any) => {
            delete card.folderId
          })
        }
      }

      // 验证卡片的标签引用
      if (data.cards && Array.isArray(data.cards) && data.tags && Array.isArray(data.tags)) {
        const tagIds = new Set(data.tags.map((t: any) => t.id))
        let invalidTagRefs = 0

        data.cards.forEach((card: any) => {
          if (card.tags && Array.isArray(card.tags)) {
            const validTags = card.tags.filter((tagId: string) => tagIds.has(tagId))
            if (validTags.length !== card.tags.length) {
              invalidTagRefs += card.tags.length - validTags.length
              card.tags = validTags // 自动修复：移除无效标签
            }
          }
        })

        if (invalidTagRefs > 0) {
          warnings.push(`Found and repaired ${invalidTagRefs} invalid tag references`)
        }
      }

    } catch (error) {
      errors.push(`Reference validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 业务规则验证
   */
  private async validateBusinessRules(data: any, metadata: BackupMetadata): Promise<ValidatorResult> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // 验证卡片数据
      if (data.cards && Array.isArray(data.cards)) {
        data.cards.forEach((card: any, index: number) => {
          if (!card.title || card.title.trim() === '') {
            errors.push(`Card ${index + 1}: Missing title`)
          }

          if (!card.content && !card.front && !card.back) {
            warnings.push(`Card ${index + 1}: No content found`)
          }

          if (card.createdAt && card.updatedAt) {
            const created = new Date(card.createdAt)
            const updated = new Date(card.updatedAt)
            if (updated < created) {
              errors.push(`Card ${index + 1}: Update time is before creation time`)
            }
          }
        })
      }

      // 验证文件夹数据
      if (data.folders && Array.isArray(data.folders)) {
        data.folders.forEach((folder: any, index: number) => {
          if (!folder.name || folder.name.trim() === '') {
            errors.push(`Folder ${index + 1}: Missing name`)
          }

          if (folder.color && !/^#[0-9A-Fa-f]{6}$/.test(folder.color)) {
            warnings.push(`Folder ${index + 1}: Invalid color format`)
          }
        })
      }

      // 验证标签数据
      if (data.tags && Array.isArray(data.tags)) {
        data.tags.forEach((tag: any, index: number) => {
          if (!tag.name || tag.name.trim() === '') {
            errors.push(`Tag ${index + 1}: Missing name`)
          }

          if (tag.color && !/^#[0-9A-Fa-f]{6}$/.test(tag.color)) {
            warnings.push(`Tag ${index + 1}: Invalid color format`)
          }
        })
      }

    } catch (error) {
      errors.push(`Business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 文件大小验证
   */
  private async validateFileSize(data: any, metadata: BackupMetadata): Promise<ValidatorResult> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // 检查备份大小
      if (metadata.size > 100 * 1024 * 1024) { // 100MB
        warnings.push('Backup size is large (>100MB)')
      }

      if (metadata.size > 500 * 1024 * 1024) { // 500MB
        errors.push('Backup size is too large (>500MB)')
      }

      // 检查压缩率
      const dataSize = JSON.stringify(data).length
      if (metadata.compression && metadata.size > dataSize * 0.9) {
        warnings.push('Poor compression ratio - compression may not be working effectively')
      }

    } catch (error) {
      errors.push(`File size validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 数据格式验证
   */
  private async validateDataFormat(data: any, metadata: BackupMetadata): Promise<ValidatorResult> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // 验证日期格式
      const dateFields = ['createdAt', 'updatedAt']
      const validateDates = (obj: any, path: string) => {
        Object.keys(obj).forEach(key => {
          if (dateFields.includes(key)) {
            const date = new Date(obj[key])
            if (isNaN(date.getTime())) {
              errors.push(`${path}.${key}: Invalid date format`)
            } else {
              // 自动修复：标准化日期格式
              obj[key] = date.toISOString()
            }
          }
        })
      }

      // 验证所有实体
      if (data.cards && Array.isArray(data.cards)) {
        data.cards.forEach((card: any, index: number) => {
          validateDates(card, `cards[${index}]`)
        })
      }

      if (data.folders && Array.isArray(data.folders)) {
        data.folders.forEach((folder: any, index: number) => {
          validateDates(folder, `folders[${index}]`)
        })
      }

      if (data.tags && Array.isArray(data.tags)) {
        data.tags.forEach((tag: any, index: number) => {
          validateDates(tag, `tags[${index}]`)
        })
      }

    } catch (error) {
      errors.push(`Data format validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 时间戳验证
   */
  private async validateTimestamps(data: any, metadata: BackupMetadata): Promise<ValidatorResult> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      const backupTime = metadata.timestamp.getTime()
      const now = Date.now()

      // 检查备份时间是否合理
      if (backupTime > now) {
        errors.push('Backup timestamp is in the future')
      }

      if (backupTime < now - 365 * 24 * 60 * 60 * 1000) { // 一年前
        warnings.push('Backup is very old (>1 year)')
      }

      // 检查数据时间戳的一致性
      const checkEntityTimestamps = (entities: any[], entityType: string) => {
        if (!Array.isArray(entities)) return

        entities.forEach((entity: any, index: number) => {
          if (entity.createdAt && entity.updatedAt) {
            const created = new Date(entity.createdAt).getTime()
            const updated = new Date(entity.updatedAt).getTime()

            if (updated < created) {
              errors.push(`${entityType}[${index}]: Updated before created`)
            }

            if (created > backupTime) {
              warnings.push(`${entityType}[${index}]: Created after backup time`)
            }
          }
        })
      }

      checkEntityTimestamps(data.cards || [], 'cards')
      checkEntityTimestamps(data.folders || [], 'folders')
      checkEntityTimestamps(data.tags || [], 'tags')

    } catch (error) {
      errors.push(`Timestamp validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 唯一性验证
   */
  private async validateUniqueness(data: any, metadata: BackupMetadata): Promise<ValidatorResult> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // 检查ID唯一性
      const checkUniqueIds = (entities: any[], entityType: string) => {
        if (!Array.isArray(entities)) return

        const idMap = new Map<string, number>()
        const duplicates: string[] = []

        entities.forEach((entity: any, index: number) => {
          if (entity.id) {
            if (idMap.has(entity.id)) {
              duplicates.push(entity.id)
              // 自动修复：生成新的ID
              entity.id = `${entityType}_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`
            } else {
              idMap.set(entity.id, index)
            }
          }
        })

        if (duplicates.length > 0) {
          warnings.push(`Found and repaired ${duplicates.length} duplicate ${entityType} IDs`)
        }
      }

      checkUniqueIds(data.cards || [], 'cards')
      checkUniqueIds(data.folders || [], 'folders')
      checkUniqueIds(data.tags || [], 'tags')

      // 检查名称唯一性（在某些实体类型中）
      const checkUniqueNames = (entities: any[], entityType: string) => {
        if (!Array.isArray(entities)) return

        const nameMap = new Map<string, number[]>()
        const duplicates: string[] = []

        entities.forEach((entity: any, index: number) => {
          if (entity.name) {
            const indices = nameMap.get(entity.name) || []
            indices.push(index)
            nameMap.set(entity.name, indices)

            if (indices.length > 1) {
              duplicates.push(entity.name)
            }
          }
        })

        if (duplicates.length > 0) {
          warnings.push(`Found ${duplicates.length} duplicate ${entityType} names`)
        }
      }

      checkUniqueNames(data.folders || [], 'folders')
      checkUniqueNames(data.tags || [], 'tags')

    } catch (error) {
      errors.push(`Uniqueness validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 计算数据校验和
   */
  private async calculateDataChecksum(data: any): Promise<string> {
    const jsonString = JSON.stringify(data)

    // 使用简单的哈希算法
    let hash = 0
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }

    return Math.abs(hash).toString(16)
  }

  /**
   * 尝试自动修复
   */
  private async attemptAutoRepair(
    backupId: string,
    validatorId: string,
    result: ValidatorResult
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 这里应该根据不同的验证器类型执行不同的修复逻辑
      // 现在返回模拟结果
      console.log(`Attempting auto repair for ${backupId} with validator ${validatorId}`)

      // 模拟修复过程
      await new Promise(resolve => setTimeout(resolve, 100))

      return {
        success: true,
        message: `Auto repair completed for ${validatorId}`
      }
    } catch (error) {
      return {
        success: false,
        message: `Auto repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * 记录验证检查
   */
  private recordValidationCheck(backupId: string, result: BackupValidationResult, configId: string): void {
    const check: IntegrityCheck = {
      id: `check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      backupId,
      timestamp: new Date(),
      result,
      configId
    }

    this.validationHistory.push(check)

    // 保持历史记录在合理范围内
    if (this.validationHistory.length > 1000) {
      this.validationHistory = this.validationHistory.slice(-500)
    }

    this.saveValidationHistory()
  }

  /**
   * 保存验证历史
   */
  private saveValidationHistory(): void {
    try {
      localStorage.setItem('cardall-validation-history', JSON.stringify(this.validationHistory))
    } catch (error) {
      console.error('Failed to save validation history:', error)
    }
  }

  /**
   * 加载验证历史
   */
  private loadValidationHistory(): void {
    try {
      const saved = localStorage.getItem('cardall-validation-history')
      if (saved) {
        this.validationHistory = JSON.parse(saved).map((check: any) => ({
          ...check,
          timestamp: new Date(check.timestamp)
        }))
      }
    } catch (error) {
      console.error('Failed to load validation history:', error)
    }
  }

  /**
   * 开始定期完整性检查
   */
  private startPeriodicIntegrityChecks(): void {
    // 每6小时执行一次定期检查
    setInterval(async () => {
      await this.performPeriodicIntegrityCheck()
    }, 6 * 60 * 60 * 1000)
  }

  /**
   * 执行定期完整性检查
   */
  private async performPeriodicIntegrityCheck(): Promise<void> {
    try {
      // 获取最近的备份进行验证
      const recentBackups = this.getRecentBackupsForValidation(5) // 验证最近5个备份

      for (const backupId of recentBackups) {
        try {
          await this.validateBackupIntegrity(backupId)
        } catch (error) {
          console.error(`Periodic validation failed for backup ${backupId}:`, error)
        }
      }

      // 生成完整性报告
      this.generateIntegrityReport(this.validationHistory.slice(-10))

    } catch (error) {
      console.error('Periodic integrity check failed:', error)
    }
  }

  /**
   * 获取最近的备份用于验证
   */
  private getRecentBackupsForValidation(count: number): string[] {
    // 这里应该从实际存储中获取最近的备份列表
    // 现在返回模拟数据
    return [
      'backup_1',
      'backup_2',
      'backup_3',
      'backup_4',
      'backup_5'
    ]
  }

  /**
   * 生成完整性报告
   */
  private generateIntegrityReport(checks: IntegrityCheck[]): void {
    if (checks.length === 0) return

    const totalChecks = checks.length
    const passedChecks = checks.filter(check => check.result.valid).length
    const failedChecks = totalChecks - passedChecks
    const averageScore = checks.reduce((sum, check) => sum + (check.result.score || 0), 0) / totalChecks

    console.log(`Integrity Report: ${passedChecks}/${totalChecks} checks passed (${averageScore.toFixed(1)}% score)`)

    // 如果有失败的检查，发出警告
    if (failedChecks > 0) {
      console.warn(`Found ${failedChecks} failed integrity checks`)
    }
  }

  // ============================================================================
  // 公共接口方法
  // ============================================================================

  /**
   * 获取验证历史
   */
  async getBackupValidationHistory(backupId?: string, limit: number = 50): Promise<IntegrityCheck[]> {
    let filtered = this.validationHistory

    if (backupId) {
      filtered = filtered.filter(check => check.backupId === backupId)
    }

    return filtered.slice(-limit).reverse()
  }

  /**
   * 获取验证统计信息
   */
  getValidationStats(): ValidationStats {
    const now = new Date()
    const recentChecks = this.validationHistory.filter(check =>
      now.getTime() - check.timestamp.getTime() < 24 * 60 * 60 * 1000 // 24小时内
    )

    const passedChecks = this.validationHistory.filter(check => check.result.valid)
    const failedChecks = this.validationHistory.filter(check => !check.result.valid)
    const averageScore = this.validationHistory.length > 0
      ? this.validationHistory.reduce((sum, check) => sum + (check.result.score || 0), 0) / this.validationHistory.length
      : 0

    const criticalBackups = failedChecks
      .filter(check => (check.result.score || 0) < 50)
      .map(check => check.backupId)

    return {
      totalChecks: this.validationHistory.length,
      recentChecks: recentChecks.length,
      passedChecks: passedChecks.length,
      failedChecks: failedChecks.length,
      averageScore,
      lastCheck: this.validationHistory.length > 0 ? this.validationHistory[this.validationHistory.length - 1].timestamp : null,
      criticalBackups: [...new Set(criticalBackups)]
    }
  }

  /**
   * 清除验证缓存
   */
  clearValidationCache(): void {
    this.cache.clear()
  }

  /**
   * 获取验证器列表
   */
  getValidators(): BackupValidator[] {
    return Array.from(this.validators.values())
  }

  /**
   * 更新验证器配置
   */
  updateValidator(validatorId: string, updates: Partial<BackupValidator>): boolean {
    const validator = this.validators.get(validatorId)
    if (!validator) return false

    this.validators.set(validatorId, { ...validator, ...updates })
    return true
  }

  /**
   * 生成验证报告
   */
  async generateValidationReport(backupId: string): Promise<ValidationReport | null> {
    try {
      const result = await this.validateBackupIntegrity(backupId)
      const validators = Array.from(this.validators.values())

      const status = result.score >= 90 ? 'healthy' : result.score >= 70 ? 'warning' : 'critical'

      const validatorResults = validators.map(validator => {
        const validatorResult = result.details // 这里应该包含每个验证器的详细结果
        return {
          id: validator.id,
          name: validator.name,
          status: 'passed' as const, // 简化处理
          score: 100,
          errors: [],
          warnings: [],
          repaired: false
        }
      })

      const recommendations = this.generateRecommendations(result, validatorResults)

      return {
        backupId,
        timestamp: new Date(),
        overallScore: result.score || 0,
        status,
        validators: validatorResults,
        recommendations,
        summary: {
          totalIssues: result.errors.length + result.warnings.length,
          criticalIssues: result.errors.length,
          repairedIssues: result.details.autoRepairs,
          estimatedRepairTime: this.estimateRepairTime(result)
        }
      }
    } catch (error) {
      console.error('Failed to generate validation report:', error)
      return null
    }
  }

  /**
   * 生成修复建议
   */
  private generateRecommendations(result: BackupValidationResult, validatorResults: any[]): string[] {
    const recommendations: string[] = []

    if (result.score < 80) {
      recommendations.push('建议立即创建新的完整备份')
    }

    if (result.errors.length > 0) {
      recommendations.push('发现数据完整性问题，建议检查并修复')
    }

    if (result.warnings.length > 5) {
      recommendations.push('存在多个警告信息，建议优化数据结构')
    }

    return recommendations
  }

  /**
   * 估算修复时间
   */
  private estimateRepairTime(result: BackupValidationResult): number {
    // 简化的修复时间估算
    const baseTime = 5 // 基础时间5分钟
    const errorTime = result.errors.length * 2 // 每个错误2分钟
    const warningTime = result.warnings.length * 0.5 // 每个警告0.5分钟

    return baseTime + errorTime + warningTime
  }
}

// 导出单例实例
export const backupValidatorService = new BackupValidatorService()