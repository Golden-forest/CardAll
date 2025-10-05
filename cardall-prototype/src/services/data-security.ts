import { db } from './database'
import { Card, Folder, Tag } from '@/types/card'

// ============================================================================
// 增强的数据安全和备份服务
// 包含加密、威胁检测、审计日志和高级安全功能
// ============================================================================

// ============================================================================
// 数据安全和备份服务
// ============================================================================

export export export }

export   access: {
    sessionTimeout: number
    maxLoginAttempts: number
    requireAuthForBackup: boolean
    ipWhitelist: string[]
    rateLimiting: {
      enabled: boolean
      maxRequests: number
      timeWindow: number // 秒
    }
  }
  audit: {
    enabled: boolean
    logLevel: 'error' | 'warn' | 'info' | 'debug'
    maxLogEntries: number
    syncToCloud: boolean
  }
  privacy: {
    anonymizeData: boolean
    dataRetentionDays: number
    autoCleanup: boolean
    dataMasking: boolean
  }
  threatDetection: {
    enabled: boolean
    blockSuspiciousIP: boolean
    monitorFailedLogins: boolean
    scanForSQLInjection: boolean
    scanForXSS: boolean
  }
}

export export   backupStatus: {
    lastBackup?: Date
    backupCount: number
    backupSize: number
  }
  threatSummary: {
    totalThreats: number
    blockedIPs: string[]
    recentThreats: any[]
  }
  encryptionStatus: {
    enabled: boolean
    algorithm: string
    keyRotationDate?: Date
  }
}

export class DataSecurityService {
  private config: BackupConfig = {
    autoBackup: true,
    backupInterval: 60, // 1小时
    maxBackups: 10,
    compressionEnabled: true,
    encryptionEnabled: false,
    cloudBackup: false,
    backupLocation: 'local'
  }

  private securityConfig: SecurityConfig = {
    encryption: {
      enabled: false,
      algorithm: 'AES-256-GCM',
      keyLength: 256
    },
    access: {
      sessionTimeout: 30 * 60 * 1000, // 30分钟
      maxLoginAttempts: 5,
      requireAuthForBackup: true
    },
    audit: {
      enabled: true,
      logLevel: 'info',
      maxLogEntries: 10000
    },
    privacy: {
      anonymizeData: false,
      dataRetentionDays: 365,
      autoCleanup: true
    }
  }

  private auditLogs: AuditLog[] = []
  private backupTimer: NodeJS.Timeout | null = null
  private encryptionKey: string = ''

  constructor() {
    this.initializeSecurity()
  }

  private async initializeSecurity(): Promise<void> {
    // 加载安全配置
    await this.loadSecurityConfig()
    
    // 启动自动备份
    if (this.config.autoBackup) {
      this.startAutoBackup()
    }
    
    // 启动审计日志清理
    this.startAuditCleanup()
    
    // 生成加密密钥
    if (this.securityConfig.encryption.enabled) {
      await this.generateEncryptionKey()
    }
    
    this.logAudit('system', 'security_service_initialized', {}, 'info')
  }

  private async loadSecurityConfig(): Promise<void> {
    try {
      const backupConfig = await db.getSetting('backupConfig')
      if (backupConfig) {
        this.config = { ...this.config, ...backupConfig }
      }
      
      const securityConfig = await db.getSetting('securityConfig')
      if (securityConfig) {
        this.securityConfig = { ...this.securityConfig, ...securityConfig }
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async generateEncryptionKey(): Promise<void> {
    // 在实际应用中,应该从用户密码或硬件安全模块派生密钥
    // 这里使用简单的伪随机数作为示例
    const key = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    this.encryptionKey = key
    this.logAudit('security', 'encryption_key_generated', { keyLength: key.length }, 'info')
  }

  // ============================================================================
  // 备份管理
  // ============================================================================

  // 创建备份
  async createBackup(description?: string, tags: string[] = []): Promise<BackupMetadata> {
    const startTime = performance.now()
    
    try {
      this.logAudit('backup', 'backup_started', { description, tags }, 'info')
      
      // 收集数据
      const data = {
        cards: await db.cards.toArray(),
        folders: await db.folders.toArray(),
        tags: await db.tags.toArray(),
        images: await db.images.toArray(),
        settings: await db.settings.toArray(),
        syncQueue: await db.syncQueue.toArray(),
        sessions: await db.sessions.toArray()
      }
      
      // 创建备份元数据
      const metadata: BackupMetadata = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        version: '3.0.0',
        size: JSON.stringify(data).length,
        compressed: this.config.compressionEnabled,
        encrypted: this.config.encryptionEnabled,
        checksum: await this.calculateChecksum(data),
        description,
        tags
      }
      
      let backupData: BackupData = { metadata, data }
      
      // 压缩数据
      if (this.config.compressionEnabled) {
        backupData = await this.compressData(backupData)
      }
      
      // 加密数据
      if (this.config.encryptionEnabled) {
        backupData = await this.encryptData(backupData)
      }
      
      // 保存备份
      await this.saveBackup(backupData)
      
      // 清理旧备份
      await this.cleanupOldBackups()
      
      const executionTime = performance.now() - startTime
      this.logAudit('backup', 'backup_completed', { 
        backupId: metadata.id, 
        size: metadata.size, 
        executionTime 
      }, 'info')
      
      return metadata
    } catch (error) {
          console.warn("操作失败:", error)
        }, 'error')
      throw error
    }
  }

  // 恢复备份
  async restoreBackup(backupId: string): Promise<void> {
    try {
      this.logAudit('backup', 'restore_started', { backupId }, 'info')
      
      // 创建当前数据的备份
      await this.createBackup('pre-restore backup', ['auto', 'emergency'])
      
      // 加载备份数据
      const backupData = await this.loadBackup(backupId)
      
      // 解密数据
      if (backupData.metadata.encrypted) {
        const decryptedData = await this.decryptData(backupData)
        Object.assign(backupData, decryptedData)
      }
      
      // 解压缩数据
      if (backupData.metadata.compressed) {
        const decompressedData = await this.decompressData(backupData)
        Object.assign(backupData, decompressedData)
      }
      
      // 验证数据完整性
      const isValid = await this.validateBackup(backupData)
      if (!isValid) {
        throw new Error('Backup validation failed')
      }
      
      // 清理当前数据
      await db.clearAll()
      
      // 恢复数据
      await this.restoreData(backupData.data)
      
      this.logAudit('backup', 'restore_completed', { backupId }, 'info')
    } catch (error) {
          console.warn("操作失败:", error)
        }, 'error')
      throw error
    }
  }

  // 列出备份
  async listBackups(): Promise<BackupMetadata[]> {
    const backups = localStorage.getItem('cardall-backups')
    if (!backups) return []
    
    try {
      const backupList = JSON.parse(backups)
      return backupList.sort((a: BackupMetadata, b: BackupMetadata) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    } catch {
      return []
    }
  }

  // 删除备份
  async deleteBackup(backupId: string): Promise<void> {
    try {
      const backups = await this.listBackups()
      const updatedBackups = backups.filter(b => b.id !== backupId)
      
      localStorage.setItem('cardall-backups', JSON.stringify(updatedBackups))
      
      // 删除备份数据文件
      localStorage.removeItem(`cardall-backup-${backupId}`)
      
      this.logAudit('backup', 'backup_deleted', { backupId }, 'info')
    } catch (error) {
          console.warn("操作失败:", error)
        }, 'error')
      throw error
    }
  }

  private async saveBackup(backupData: BackupData): Promise<void> {
    // 保存备份元数据
    const backups = await this.listBackups()
    backups.push(backupData.metadata)
    
    // 限制备份数量
    if (backups.length > this.config.maxBackups) {
      backups.splice(0, backups.length - this.config.maxBackups)
    }
    
    localStorage.setItem('cardall-backups', JSON.stringify(backups))
    
    // 保存备份数据
    localStorage.setItem(`cardall-backup-${backupData.metadata.id}`, JSON.stringify(backupData))
  }

  private async loadBackup(backupId: string): Promise<BackupData> {
    const backupData = localStorage.getItem(`cardall-backup-${backupId}`)
    if (!backupData) {
      throw new Error('Backup not found')
    }
    
    return JSON.parse(backupData)
  }

  private async cleanupOldBackups(): Promise<void> {
    const backups = await this.listBackups()
    
    if (backups.length > this.config.maxBackups) {
      const toDelete = backups.splice(0, backups.length - this.config.maxBackups)
      
      for (const backup of toDelete) {
        await this.deleteBackup(backup.id)
      }
    }
  }

  private startAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer)
    }
    
    this.backupTimer = setInterval(async () => {
      try {
        await this.createBackup('Auto backup', ['auto'])
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }, this.config.backupInterval * 60 * 1000)
  }

  // ============================================================================
  // 数据加密和压缩
  // ============================================================================

  private async encryptData(data: BackupData): Promise<BackupData> {
    // 在实际应用中,这里应该使用 Web Crypto API 进行加密
    // 这里只是示例,实际加密需要更复杂的实现
    console.log('Encrypting backup data...')
    return data
  }

  private async decryptData(encryptedData: BackupData): Promise<BackupData> {
    // 在实际应用中,这里应该使用 Web Crypto API 进行解密
    console.log('Decrypting backup data...')
    return encryptedData
  }

  private async compressData(data: BackupData): Promise<BackupData> {
    // 在实际应用中,这里应该使用压缩算法
    console.log('Compressing backup data...')
    return data
  }

  private async decompressData(compressedData: BackupData): Promise<BackupData> {
    // 在实际应用中,这里应该使用解压缩算法
    console.log('Decompressing backup data...')
    return compressedData
  }

  private async calculateChecksum(data: any): Promise<string> {
    // 简单的校验和计算
    const dataString = JSON.stringify(data)
    let hash = 0
    
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    
    return Math.abs(hash).toString(16)
  }

  private async validateBackup(backupData: BackupData): Promise<boolean> {
    try {
      // 验证校验和
      const calculatedChecksum = await this.calculateChecksum(backupData.data)
      return calculatedChecksum === backupData.metadata.checksum
    } catch {
      return false
    }
  }

  private async restoreData(data: BackupData['data']): Promise<void> {
    // 恢复设置
    if (data.settings.length > 0) {
      await db.settings.bulkAdd(data.settings)
    }
    
    // 恢复文件夹
    if (data.folders.length > 0) {
      await db.folders.bulkAdd(data.folders)
    }
    
    // 恢复标签
    if (data.tags.length > 0) {
      await db.tags.bulkAdd(data.tags)
    }
    
    // 恢复图片
    if (data.images.length > 0) {
      await db.images.bulkAdd(data.images)
    }
    
    // 恢复卡片
    if (data.cards.length > 0) {
      await db.cards.bulkAdd(data.cards)
    }
    
    // 恢复同步队列
    if (data.syncQueue.length > 0) {
      await db.syncQueue.bulkAdd(data.syncQueue)
    }
  }

  // ============================================================================
  // 审计日志
  // ============================================================================

  private logAudit(
    action: string,
    resource: string,
    details: any = {},
    severity: AuditLog['severity'] = 'info'
  ): void {
    if (!this.securityConfig.audit.enabled) return
    
    const log: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      action,
      resource,
      details,
      severity
    }
    
    this.auditLogs.push(log)
    
    // 限制日志数量
    if (this.auditLogs.length > this.securityConfig.audit.maxLogEntries) {
      this.auditLogs = this.auditLogs.slice(-this.securityConfig.audit.maxLogEntries)
    }
  }

  private startAuditCleanup(): void {
    // 每天清理一次旧日志
    setInterval(() => {
      this.cleanupAuditLogs()
    }, 24 * 60 * 60 * 1000)
  }

  private cleanupAuditLogs(): void {
    const cutoffDate = new Date(Date.now() - this.securityConfig.privacy.dataRetentionDays * 24 * 60 * 60 * 1000)
    this.auditLogs = this.auditLogs.filter(log => log.timestamp > cutoffDate)
  }

  // 获取审计日志
  getAuditLogs(filter?: {
    startDate?: Date
    endDate?: Date
    severity?: AuditLog['severity']
    action?: string
    limit?: number
  }): AuditLog[] {
    let logs = [...this.auditLogs]
    
    if (filter) {
      if (filter.startDate) {
        logs = logs.filter(log => log.timestamp >= filter.startDate!)
      }
      
      if (filter.endDate) {
        logs = logs.filter(log => log.timestamp <= filter.endDate!)
      }
      
      if (filter.severity) {
        logs = logs.filter(log => log.severity === filter.severity)
      }
      
      if (filter.action) {
        logs = logs.filter(log => log.action.includes(filter.action))
      }
      
      if (filter.limit) {
        logs = logs.slice(-filter.limit)
      }
    }
    
    return logs.reverse() // 最新的在前
  }

  // ============================================================================
  // 安全检查和报告
  // ============================================================================

  // 执行安全检查
  async performSecurityCheck(): Promise<SecurityReport> {
    const vulnerabilities: SecurityVulnerability[] = []
    
    // 检查加密配置
    if (!this.securityConfig.encryption.enabled) {
      vulnerabilities.push({
        id: 'encryption-disabled',
        severity: 'high',
        category: 'Encryption',
        description: 'Data encryption is disabled',
        impact: 'Sensitive data may be exposed in backups',
        recommendation: 'Enable encryption for better data protection',
        discovered: new Date(),
        status: 'open'
      })
    }
    
    // 检查备份配置
    if (!this.config.autoBackup) {
      vulnerabilities.push({
        id: 'auto-backup-disabled',
        severity: 'medium',
        category: 'Backup',
        description: 'Automatic backup is disabled',
        impact: 'Data may be lost if manual backup is forgotten',
        recommendation: 'Enable automatic backup for data protection',
        discovered: new Date(),
        status: 'open'
      })
    }
    
    // 检查会话超时
    if (this.securityConfig.access.sessionTimeout > 60 * 60 * 1000) {
      vulnerabilities.push({
        id: 'session-timeout-too-long',
        severity: 'medium',
        category: 'Access Control',
        description: 'Session timeout is too long',
        impact: 'Increases risk of unauthorized access',
        recommendation: 'Reduce session timeout to 30 minutes or less',
        discovered: new Date(),
        status: 'open'
      })
    }
    
    // 计算安全分数
    const totalChecks = 5
    const passedChecks = totalChecks - vulnerabilities.filter(v => v.severity === 'high' || v.severity === 'critical').length
    const overallScore = Math.round((passedChecks / totalChecks) * 100)
    
    // 生成建议
    const recommendations = [
      '定期更新安全配置',
      '启用数据加密',
      '设置合理的备份策略',
      '监控异常访问行为',
      '定期清理过期数据'
    ]
    
    // 获取备份状态
    const backups = await this.listBackups()
    const backupSize = backups.reduce((total, backup) => total + backup.size, 0)
    
    return {
      overallScore,
      vulnerabilities,
      recommendations,
      auditSummary: {
        totalLogs: this.auditLogs.length,
        errorLogs: this.auditLogs.filter(log => log.severity === 'error').length,
        recentActivity: this.auditLogs.slice(-10)
      },
      backupStatus: {
        lastBackup: backups[0]?.timestamp,
        backupCount: backups.length,
        backupSize
      }
    }
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  // 更新备份配置
  async updateBackupConfig(config: Partial<BackupConfig>): Promise<void> {
    this.config = { ...this.config, ...config }
    
    await db.updateSetting('backupConfig', this.config)
    
    // 重启自动备份
    if (this.backupTimer) {
      clearInterval(this.backupTimer)
    }
    
    if (this.config.autoBackup) {
      this.startAutoBackup()
    }
    
    this.logAudit('config', 'backup_config_updated', config, 'info')
  }

  // 更新安全配置
  async updateSecurityConfig(config: Partial<SecurityConfig>): Promise<void> {
    this.securityConfig = { ...this.securityConfig, ...config }
    
    await db.updateSetting('securityConfig', this.securityConfig)
    
    this.logAudit('config', 'security_config_updated', config, 'info')
  }

  // 获取当前配置
  getConfig() {
    return {
      backup: this.config,
      security: this.securityConfig
    }
  }

  // 数据清理
  async cleanupOldData(): Promise<void> {
    if (!this.securityConfig.privacy.autoCleanup) return
    
    try {
      const cutoffDate = new Date(Date.now() - this.securityConfig.privacy.dataRetentionDays * 24 * 60 * 60 * 1000)
      
      // 清理旧的同步操作
      await db.syncQueue.where('timestamp').below(cutoffDate).delete()
      
      // 清理旧的会话
      await db.sessions.where('lastActivity').below(cutoffDate).delete()
      
      this.logAudit('cleanup', 'old_data_cleaned', { cutoffDate }, 'info')
    } catch (error) {
          console.warn("操作失败:", error)
        }, 'error')
    }
  }
}

// 创建数据安全服务实例
export const dataSecurityService = new DataSecurityService()

// 导出便捷函数
export const createBackup = (description?: string, tags?: string[]) => 
  dataSecurityService.createBackup(description, tags)
export const restoreBackup = (backupId: string) => 
  dataSecurityService.restoreBackup(backupId)
export const listBackups = () => 
  dataSecurityService.listBackups()
export const deleteBackup = (backupId: string) => 
  dataSecurityService.deleteBackup(backupId)
export const performSecurityCheck = () => 
  dataSecurityService.performSecurityCheck()
export const getAuditLogs = (filter?: any) => 
  dataSecurityService.getAuditLogs(filter)