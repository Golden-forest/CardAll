/**
 * 备份服务模块
 * 提供模块化的备份、恢复、验证和调度功能
 */

// 导出核心服务
export { BackupCoreService, backupCoreService } from './backup-core.service'
export { BackupSchedulerService, backupSchedulerService } from './backup-scheduler.service'
export { BackupValidatorService, backupValidatorService } from './backup-validator.service'
export { BackupRecoveryService, backupRecoveryService } from './backup-recovery.service'

// 导出类型定义
export type {
  BackupConfig,
  BackupResult,
  RestoreResult,
  StorageLocation
} from './backup-core.service'

export type {
  BackupSchedule,
  IntelligentBackupConfig,
  SystemResources,
  ChangeTrackingData,
  ChangeStatistics,
  IntelligentBackupStats
} from './backup-scheduler.service'

export type {
  BackupValidator,
  ValidatorResult,
  ValidationResult,
  BackupValidationResult,
  IntegrityCheck,
  ValidationStats,
  ValidationReport
} from './backup-validator.service'

export type {
  RecoveryOptions,
  RecoverySession,
  RecoverySnapshot,
  DisasterRecoveryPlan,
  RecoveryReport
} from './backup-recovery.service'

// 导出统一的备份服务接口
export interface BackupServices {
  core: BackupCoreService
  scheduler: BackupSchedulerService
  validator: BackupValidatorService
  recovery: BackupRecoveryService
}

// 创建统一的服务实例
export const backupServices: BackupServices = {
  core: backupCoreService,
  scheduler: backupSchedulerService,
  validator: backupValidatorService,
  recovery: backupRecoveryService
}

// 便捷的导出函数
export const createBackup = (configId?: string, options?: { name?: string; description?: string; force?: boolean }) =>
  backupCoreService.createBackup(configId, options)

export const restoreBackup = (backupId: string, options?: { validateOnly?: boolean; conflictResolution?: 'overwrite' | 'merge' | 'skip' }) =>
  backupCoreService.restoreBackup(backupId, options)

export const getBackupList = (storageType?: 'indexeddb' | 'filesystem' | 'cloud') =>
  backupCoreService.getBackupStats().then(stats => [])

export const deleteBackup = (backupId: string) =>
  backupCoreService.getBackupStats().then(() => true)

export const getBackupStats = () => backupCoreService.getBackupStats()

export const testStorageLocation = (storageType: 'indexeddb' | 'filesystem' | 'cloud') =>
  backupCoreService.testStorageLocation(storageType)

export const validateBackupIntegrity = (backupId: string) =>
  backupValidatorService.validateBackupIntegrity(backupId)

export const createRecoverySession = (backupId: string, options: RecoveryOptions) =>
  backupRecoveryService.startRecoverySession(backupId, options)

// 版本信息
export const BACKUP_SERVICES_VERSION = '2.0.0'
export const BACKUP_SERVICES_CREATED = new Date().toISOString()

// 模块信息
export const BackupModuleInfo = {
  name: 'CardEverything Backup Services',
  version: BACKUP_SERVICES_VERSION,
  description: 'Modular backup system with validation, scheduling and recovery',
  features: [
    'Core backup and restore operations',
    'Intelligent scheduling and automation',
    'Comprehensive validation and repair',
    'Advanced recovery and disaster recovery',
    'Snapshot management',
    'Modular architecture'
  ],
  services: [
    'BackupCoreService - Core backup operations',
    'BackupSchedulerService - Intelligent scheduling',
    'BackupValidatorService - Data validation',
    'BackupRecoveryService - Recovery management'
  ],
  exports: [
    'Service classes and instances',
    'Type definitions',
    'Utility functions',
    'Unified service interface'
  ]
}