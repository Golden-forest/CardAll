/**
 * 数据完整性检查器配置
 *
 * 提供默认配置和预设配置选项
 */

import { IntegrityCheckConfig, ScheduledCheck, IntegrityCheckType, EntityType } from './data-integrity-checker'

// ============================================================================
// 默认配置
// ============================================================================

export const DEFAULT_INTEGRITY_CONFIG: IntegrityCheckConfig = {
  // 基础配置
  enabled: true,
  autoStart: true,
  checkInterval: 3600000, // 1小时
  batchSize: 50,
  timeout: 300000, // 5分钟

  // 检查类型
  enableHashCheck: true,
  enableMetadataCheck: true,
  enableReferenceCheck: true,
  enableStructureCheck: true,
  enableConsistencyCheck: true,

  // 自动修复
  enableAutoFix: true,
  autoFixThreshold: 'warning' as any,
  requireConfirmationFor: ['delete_local', 'delete_remote', 'sync_remote_to_local'],

  // 报告配置
  enableDetailedReports: true,
  reportRetentionDays: 30,
  notificationEnabled: true,

  // 性能配置
  maxConcurrentChecks: 3,
  checkPriority: 'normal',
  throttleNetworkRequests: true
}

// ============================================================================
// 开发环境配置
// ============================================================================

export const DEVELOPMENT_INTEGRITY_CONFIG: Partial<IntegrityCheckConfig> = {
  enabled: true,
  autoStart: false,
  checkInterval: 600000, // 10分钟
  batchSize: 20,
  timeout: 120000, // 2分钟

  enableAutoFix: true,
  autoFixThreshold: 'info' as any,

  enableDetailedReports: true,
  enableDebugLogging: true,

  maxConcurrentChecks: 1,
  checkPriority: 'low'
}

// ============================================================================
// 生产环境配置
// ============================================================================

export const PRODUCTION_INTEGRITY_CONFIG: Partial<IntegrityCheckConfig> = {
  enabled: true,
  autoStart: true,
  checkInterval: 7200000, // 2小时
  batchSize: 100,
  timeout: 600000, // 10分钟

  enableAutoFix: true,
  autoFixThreshold: 'warning' as any,
  requireConfirmationFor: ['delete_local', 'delete_remote', 'sync_remote_to_local', 'sync_local_to_remote'],

  enableDetailedReports: true,
  reportRetentionDays: 90,

  maxConcurrentChecks: 5,
  checkPriority: 'normal',
  throttleNetworkRequests: true
}

// ============================================================================
// 测试环境配置
// ============================================================================

export const TEST_INTEGRITY_CONFIG: Partial<IntegrityCheckConfig> = {
  enabled: true,
  autoStart: false,
  checkInterval: 30000, // 30秒
  batchSize: 10,
  timeout: 60000, // 1分钟

  enableAutoFix: false,
  enableDetailedReports: true,
  notificationEnabled: false,

  maxConcurrentChecks: 1,
  checkPriority: 'low',
  throttleNetworkRequests: false
}

// ============================================================================
// 预设定期检查配置
// ============================================================================

export const PRESET_SCHEDULED_CHECKS: Omit<ScheduledCheck, 'id'>[] = [
  {
    name: '每日完整检查',
    enabled: true,
    schedule: '0 2 * * *', // 每天凌晨2点
    checkTypes: [
      IntegrityCheckType.HASH,
      IntegrityCheckType.METADATA,
      IntegrityCheckType.REFERENCE,
      IntegrityCheckType.STRUCTURE,
      IntegrityCheckType.CONSISTENCY
    ],
    entityTypes: [EntityType.CARD, EntityType.FOLDER, EntityType.TAG],
    autoFix: true,
    notificationSettings: {
      enabled: true,
      onIssue: true,
      onCompletion: false,
      onFailure: true
    }
  },
  {
    name: '每小时快速检查',
    enabled: true,
    schedule: '0 * * * *', // 每小时
    checkTypes: [IntegrityCheckType.HASH],
    entityTypes: [EntityType.CARD],
    autoFix: false,
    notificationSettings: {
      enabled: true,
      onIssue: true,
      onCompletion: false,
      onFailure: false
    }
  },
  {
    name: '每周深度检查',
    enabled: true,
    schedule: '0 3 * * 0', // 每周日凌晨3点
    checkTypes: [
      IntegrityCheckType.HASH,
      IntegrityCheckType.METADATA,
      IntegrityCheckType.REFERENCE,
      IntegrityCheckType.STRUCTURE,
      IntegrityCheckType.CONSISTENCY
    ],
    entityTypes: [EntityType.CARD, EntityType.FOLDER, EntityType.TAG],
    autoFix: false,
    notificationSettings: {
      enabled: true,
      onIssue: true,
      onCompletion: true,
      onFailure: true
    }
  },
  {
    name: '引用完整性检查',
    enabled: true,
    schedule: '30 */6 * * *', // 每6小时30分
    checkTypes: [IntegrityCheckType.REFERENCE],
    entityTypes: [EntityType.CARD, EntityType.FOLDER, EntityType.TAG],
    autoFix: true,
    notificationSettings: {
      enabled: true,
      onIssue: true,
      onCompletion: false,
      onFailure: true
    }
  },
  {
    name: '元数据一致性检查',
    enabled: true,
    schedule: '15 */4 * * *', // 每4小时15分
    checkTypes: [IntegrityCheckType.METADATA],
    entityTypes: [EntityType.CARD, EntityType.FOLDER, EntityType.TAG],
    autoFix: true,
    notificationSettings: {
      enabled: true,
      onIssue: true,
      onCompletion: false,
      onFailure: false
    }
  }
]

// ============================================================================
// 环境检测和配置选择
// ============================================================================

export function getIntegrityConfigForEnvironment(env: 'development' | 'production' | 'test' = 'development'): IntegrityCheckConfig {
  const baseConfig = { ...DEFAULT_INTEGRITY_CONFIG }

  switch (env) {
    case 'development':
      return { ...baseConfig, ...DEVELOPMENT_INTEGRITY_CONFIG }
    case 'production':
      return { ...baseConfig, ...PRODUCTION_INTEGRITY_CONFIG }
    case 'test':
      return { ...baseConfig, ...TEST_INTEGRITY_CONFIG }
    default:
      return baseConfig
  }
}

export function detectEnvironment(): 'development' | 'production' | 'test' {
  // 检测当前环境
  if (import.meta.env?.MODE === 'test') {
    return 'test'
  } else if (import.meta.env?.PROD) {
    return 'production'
  } else {
    return 'development'
  }
}

export function getAutoIntegrityConfig(): IntegrityCheckConfig {
  const env = detectEnvironment()
  return getIntegrityConfigForEnvironment(env)
}

// ============================================================================
// 配置验证
// ============================================================================

export function validateIntegrityConfig(config: Partial<IntegrityCheckConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // 验证基础配置
  if (config.checkInterval !== undefined && config.checkInterval < 60000) {
    errors.push('检查间隔不能少于1分钟')
  }

  if (config.batchSize !== undefined && (config.batchSize < 1 || config.batchSize > 1000)) {
    errors.push('批处理大小必须在1-1000之间')
  }

  if (config.timeout !== undefined && config.timeout < 30000) {
    errors.push('超时时间不能少于30秒')
  }

  // 验证自动修复配置
  if (config.enableAutoFix && config.autoFixThreshold === undefined) {
    errors.push('启用自动修复时必须设置自动修复阈值')
  }

  // 验证性能配置
  if (config.maxConcurrentChecks !== undefined && (config.maxConcurrentChecks < 1 || config.maxConcurrentChecks > 10)) {
    errors.push('最大并发检查数必须在1-10之间')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// ============================================================================
// 配置迁移
// ============================================================================

export interface LegacyIntegrityConfig {
  // 旧版本配置字段
  enabled?: boolean
  autoStart?: boolean
  checkInterval?: number
  autoFix?: boolean
  notifications?: boolean
}

export function migrateLegacyConfig(legacy: LegacyIntegrityConfig): Partial<IntegrityCheckConfig> {
  const migrated: Partial<IntegrityCheckConfig> = {}

  // 基础字段映射
  if (legacy.enabled !== undefined) migrated.enabled = legacy.enabled
  if (legacy.autoStart !== undefined) migrated.autoStart = legacy.autoStart
  if (legacy.checkInterval !== undefined) migrated.checkInterval = legacy.checkInterval

  // 自动修复字段映射
  if (legacy.autoFix !== undefined) {
    migrated.enableAutoFix = legacy.autoFix
    migrated.autoFixThreshold = 'warning' as any
  }

  // 通知字段映射
  if (legacy.notifications !== undefined) {
    migrated.notificationEnabled = legacy.notifications
  }

  // 添加默认值
  return {
    ...DEFAULT_INTEGRITY_CONFIG,
    ...migrated
  }
}

// ============================================================================
// 配置持久化
// ============================================================================

export const INTEGRITY_CONFIG_STORAGE_KEY = 'cardall_integrity_config'

export function saveIntegrityConfig(config: IntegrityCheckConfig): void {
  try {
    localStorage.setItem(INTEGRITY_CONFIG_STORAGE_KEY, JSON.stringify(config))
  } catch (error) {
    console.error('保存完整性配置失败:', error)
  }
}

export function loadIntegrityConfig(): IntegrityCheckConfig | null {
  try {
    const stored = localStorage.getItem(INTEGRITY_CONFIG_STORAGE_KEY)
    if (stored) {
      const config = JSON.parse(stored) as IntegrityCheckConfig
      const validation = validateIntegrityConfig(config)

      if (validation.valid) {
        return config
      } else {
        console.warn('加载的配置无效，使用默认配置:', validation.errors)
        return null
      }
    }
  } catch (error) {
    console.error('加载完整性配置失败:', error)
  }

  return null
}

export function getOrInitIntegrityConfig(): IntegrityCheckConfig {
  const stored = loadIntegrityConfig()
  if (stored) {
    return stored
  }

  const defaultConfig = getAutoIntegrityConfig()
  saveIntegrityConfig(defaultConfig)
  return defaultConfig
}

// ============================================================================
// 导出配置管理器
// ============================================================================

export class IntegrityConfigManager {
  private config: IntegrityCheckConfig

  constructor(config?: Partial<IntegrityCheckConfig>) {
    this.config = {
      ...getAutoIntegrityConfig(),
      ...config
    }
  }

  getConfig(): IntegrityCheckConfig {
    return { ...this.config }
  }

  updateConfig(updates: Partial<IntegrityCheckConfig>): void {
    const validation = validateIntegrityConfig(updates)
    if (!validation.valid) {
      throw new Error(`配置验证失败: ${validation.errors.join(', ')}`)
    }

    this.config = { ...this.config, ...updates }
    this.saveConfig()
  }

  resetToDefaults(): void {
    this.config = getAutoIntegrityConfig()
    this.saveConfig()
  }

  resetToEnvironmentDefaults(env?: 'development' | 'production' | 'test'): void {
    this.config = getIntegrityConfigForEnvironment(env)
    this.saveConfig()
  }

  saveConfig(): void {
    saveIntegrityConfig(this.config)
  }

  exportConfig(): string {
    return JSON.stringify(this.config, null, 2)
  }

  importConfig(configJson: string): void {
    try {
      const imported = JSON.parse(configJson) as Partial<IntegrityCheckConfig>
      this.updateConfig(imported)
    } catch (error) {
      throw new Error(`导入配置失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }
}

// ============================================================================
// 预设配置模板
// ============================================================================

export const INTEGRITY_CONFIG_PRESETS = {
  // 保守配置：优先数据安全
  conservative: {
    enableAutoFix: false,
    autoFixThreshold: 'critical' as any,
    requireConfirmationFor: [
      'delete_local',
      'delete_remote',
      'sync_remote_to_local',
      'sync_local_to_remote',
      'update_metadata',
      'repair_reference'
    ],
    checkInterval: 1800000, // 30分钟
    enableDetailedReports: true,
    notificationEnabled: true
  } as Partial<IntegrityCheckConfig>,

  // 平衡配置：平衡自动化和安全性
  balanced: {
    enableAutoFix: true,
    autoFixThreshold: 'warning' as any,
    requireConfirmationFor: ['delete_local', 'delete_remote', 'sync_remote_to_local'],
    checkInterval: 3600000, // 1小时
    enableDetailedReports: true,
    notificationEnabled: true
  } as Partial<IntegrityCheckConfig>,

  // 激进配置：最大化自动化
  aggressive: {
    enableAutoFix: true,
    autoFixThreshold: 'info' as any,
    requireConfirmationFor: ['delete_remote'],
    checkInterval: 1800000, // 30分钟
    enableDetailedReports: false,
    notificationEnabled: false
  } as Partial<IntegrityCheckConfig>,

  // 轻量配置：最小资源占用
  lightweight: {
    enableHashCheck: true,
    enableMetadataCheck: false,
    enableReferenceCheck: false,
    enableStructureCheck: false,
    enableConsistencyCheck: false,
    enableAutoFix: true,
    autoFixThreshold: 'warning' as any,
    checkInterval: 7200000, // 2小时
    batchSize: 20,
    maxConcurrentChecks: 1,
    enableDetailedReports: false
  } as Partial<IntegrityCheckConfig>
}

export function getPresetConfig(preset: keyof typeof INTEGRITY_CONFIG_PRESETS): IntegrityCheckConfig {
  return {
    ...DEFAULT_INTEGRITY_CONFIG,
    ...INTEGRITY_CONFIG_PRESETS[preset]
  }
}