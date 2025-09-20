// ============================================================================
// 统一冲突解决引擎 - W3-T003
// 整合现有冲突解决逻辑，提供统一的冲突检测和解决接口
// Week 3 Day 11-13: 同步服务架构重构
// ============================================================================

import { type DbCard, type DbFolder, type DbTag, type DbImage } from '../../database-unified'
import { type ConflictInfo as BasicConflictInfo } from '../../optimized-cloud-sync'
import { type CardConflict, type FolderConflict, type TagConflict, type ConflictStats } from '../../types/conflict'
import { db } from '../../database-unified'

// ============================================================================
// 统一冲突类型定义
// ============================================================================

export interface UnifiedConflict {
  id: string
  entityType: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  conflictType: 'version' | 'content' | 'structure' | 'delete' | 'field'
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'resolving' | 'resolved' | 'manual_required'

  // 数据版本
  localData: any
  cloudData: any
  localVersion: number
  cloudVersion: number
  localTimestamp: Date
  cloudTimestamp: Date

  // 冲突详情
  conflictFields?: string[]
  conflictDetails?: ConflictDetails
  suggestions: ConflictSuggestion[]

  // 解决信息
  resolution?: ConflictResolution
  resolvedAt?: Date
  resolvedBy?: 'auto' | 'user' | 'system'

  // 元数据
  detectedAt: Date
  sourceDevice: string
  context: ConflictContext

  // 性能指标
  detectionTime: number
  resolutionTime?: number
}

export interface ConflictDetails {
  description: string
  impact: 'data_loss' | 'inconsistency' | 'duplicate' | 'structure_break'
  affectedEntities: string[]
  autoResolveable: boolean
  complexityScore: number // 0-100
}

export interface ConflictSuggestion {
  id: string
  type: 'keep_local' | 'keep_cloud' | 'merge' | 'manual'
  title: string
  description: string
  confidence: number // 0-1
  reasoning: string
  estimatedTime: number // 秒
  risks?: string[]
  preview?: any

  // 合并建议详情
  mergeStrategy?: MergeStrategy
  fieldResolutions?: FieldResolution[]
}

export interface MergeStrategy {
  approach: 'smart' | 'timestamp' | 'content' | 'semantic' | 'user_preference'
  algorithm: string
  confidence: number
  requiresUserConfirmation: boolean
}

export interface FieldResolution {
  fieldName: string
  resolution: 'local' | 'cloud' | 'merge' | 'custom'
  value?: any
  reasoning: string
}

export interface ConflictResolution {
  type: 'keep_local' | 'keep_cloud' | 'merge' | 'manual'
  strategy: string
  mergedData?: any
  manualChanges?: FieldResolution[]
  reasoning: string
  success: boolean
  timestamp: Date
}

export interface ConflictContext {
  userId: string
  deviceId: string
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor'
  timeOfDay: 'peak' | 'normal' | 'off-peak'
  userActivity: 'active' | 'inactive' | 'away'
  syncHistory: SyncHistory
  userPreferences: UserConflictPreferences
}

export interface SyncHistory {
  totalConflicts: number
  resolvedConflicts: number
  averageResolutionTime: number
  commonStrategies: Record<string, number>
  conflictPatterns: ConflictPattern[]
}

export interface ConflictPattern {
  pattern: string
  frequency: number
  successRate: number
  lastSeen: Date
}

export interface UserConflictPreferences {
  defaultResolution: 'local' | 'cloud' | 'merge' | 'ask'
  entityPreferences: Record<string, string>
  autoResolveThreshold: number // 0-1
  notificationPreference: 'immediate' | 'batch' | 'none'
  preferredStrategies: string[]
}

// ============================================================================
// 冲突检测规则接口
// ============================================================================

export interface ConflictDetectionRule {
  id: string
  name: string
  description: string
  version: string
  enabled: boolean
  priority: number

  // 适用条件
  entityTypes: ('card' | 'folder' | 'tag' | 'image')[]
  conflictTypes: ('version' | 'content' | 'structure' | 'delete' | 'field')[]

  // 检测逻辑
  detectionFunction: (data: ConflictDetectionData) => Promise<ConflictDetectionResult>

  // 性能配置
  maxExecutionTime: number
  memoryLimit: number

  // 元数据
  author: string
  createdAt: Date
  lastModified: Date
}

export interface ConflictDetectionData {
  localData: any
  cloudData: any
  entity: string
  entityId: string
  context: ConflictContext
  metadata?: any
}

export interface ConflictDetectionResult {
  hasConflict: boolean
  conflict?: UnifiedConflict
  confidence: number
  executionTime: number
  details?: any
}

// ============================================================================
// 冲突解决策略接口
// ============================================================================

export interface ConflictResolutionStrategy {
  id: string
  name: string
  description: string
  version: string
  enabled: boolean
  priority: number

  // 适用条件
  entityTypes: ('card' | 'folder' | 'tag' | 'image')[]
  conflictTypes: ('version' | 'content' | 'structure' | 'delete' | 'field')[]
  minConfidence: number
  maxComplexity: number

  // 解决逻辑
  resolutionFunction: (data: ConflictResolutionData) => Promise<ConflictResolutionResult>

  // 性能配置
  maxExecutionTime: number
  memoryLimit: number

  // 元数据
  author: string
  createdAt: Date
  lastModified: Date
  successRate: number
  usageCount: number
}

export interface ConflictResolutionData {
  conflict: UnifiedConflict
  context: ConflictContext
  availableStrategies: string[]
  userDecision?: UserDecision
}

export interface UserDecision {
  type: 'accept' | 'reject' | 'modify'
  suggestionId?: string
  customChanges?: FieldResolution[]
  reasoning?: string
}

export interface ConflictResolutionResult {
  success: boolean
  resolution?: ConflictResolution
  executionTime: number
  confidence: number
  fallbackUsed?: boolean
  error?: string
}

// ============================================================================
// 引擎配置接口
// ============================================================================

export interface ConflictEngineConfig {
  // 检测配置
  detection: {
    enabled: boolean
    parallelDetection: boolean
    maxDetectionRules: number
    detectionTimeout: number
    enableML: boolean
  }

  // 解决配置
  resolution: {
    enabled: boolean
    autoResolveEnabled: boolean
    autoResolveThreshold: number
    maxResolutionStrategies: number
    resolutionTimeout: number
    enableML: boolean
  }

  // 性能配置
  performance: {
    cacheEnabled: boolean
    cacheSize: number
    cacheTTL: number
    batchSize: number
    maxConcurrentDetections: number
    maxConcurrentResolutions: number
  }

  // 用户体验配置
  ux: {
    showNotifications: boolean
    notificationDelay: number
    enableRealtime: boolean
    enableBatchProcessing: boolean
  }
}

// ============================================================================
// 统计和监控接口
// ============================================================================

export interface ConflictEngineMetrics {
  // 基础统计
  totalConflicts: number
  resolvedConflicts: number
  pendingConflicts: number
  manualRequiredConflicts: number

  // 性能指标
  averageDetectionTime: number
  averageResolutionTime: number
  successRate: number
  autoResolveRate: number

  // 按类型统计
  conflictsByType: Record<string, number>
  conflictsByEntity: Record<string, number>
  resolutionsByStrategy: Record<string, number>

  // 按时间统计
  conflictsByHour: Record<number, number>
  conflictsByDay: Record<number, number>

  // 错误统计
  detectionErrors: number
  resolutionErrors: number
  timeoutErrors: number

  // 资源使用
  memoryUsage: number
  cacheHitRate: number
  cpuUsage: number
}

export interface ConflictEngineHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  score: number // 0-100
  issues: HealthIssue[]
  lastCheck: Date

  // 组件状态
  detection: ComponentHealth
  resolution: ComponentHealth
  cache: ComponentHealth
  ml: ComponentHealth
}

export interface HealthIssue {
  type: 'error' | 'warning' | 'info'
  component: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  suggestion?: string
  timestamp: Date
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency: number
  successRate: number
  errorRate: number
  lastError?: string
  lastErrorTime?: Date
}

// ============================================================================
// 事件和回调接口
// ============================================================================

export interface ConflictEventListeners {
  onConflictDetected?: (conflict: UnifiedConflict) => void
  onConflictResolved?: (conflict: UnifiedConflict, resolution: ConflictResolution) => void
  onAutoResolveFailed?: (conflict: UnifiedConflict, error: string) => void
  onManualResolutionRequired?: (conflict: UnifiedConflict) => void
  onEngineError?: (error: EngineError) => void
  onMetricsUpdated?: (metrics: ConflictEngineMetrics) => void
  onHealthCheck?: (health: ConflictEngineHealth) => void
}

export interface EngineError {
  type: 'detection_error' | 'resolution_error' | 'timeout_error' | 'system_error'
  code: string
  message: string
  details?: any
  timestamp: Date
  conflictId?: string
}

// ============================================================================
// 导出类型
// ============================================================================

export type {
  UnifiedConflict,
  ConflictDetails,
  ConflictSuggestion,
  MergeStrategy,
  FieldResolution,
  ConflictResolution,
  ConflictContext,
  SyncHistory,
  ConflictPattern,
  UserConflictPreferences,
  ConflictDetectionRule,
  ConflictDetectionData,
  ConflictDetectionResult,
  ConflictResolutionStrategy,
  ConflictResolutionData,
  UserDecision,
  ConflictResolutionResult,
  ConflictEngineConfig,
  ConflictEngineMetrics,
  ConflictEngineHealth,
  HealthIssue,
  ComponentHealth,
  ConflictEventListeners,
  EngineError
}