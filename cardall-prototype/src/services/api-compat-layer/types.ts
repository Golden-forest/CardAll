// ============================================================================
// API兼容层类型定义
// ============================================================================
// 创建时间：2025-09-13
// 功能：为现有UI组件提供API兼容层类型定义
// ============================================================================

// ============================================================================
// 同步服务类型定义
// ============================================================================

export interface SyncStatus {
  isOnline: boolean
  lastSyncTime: Date | null
  pendingOperations: number
  syncInProgress: boolean
  hasConflicts: boolean
}

export interface SyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  table: 'cards' | 'folders' | 'tags' | 'images'
  data: any
  localId: string
  timestamp: Date
  retryCount: number
}

export interface ConflictResolution {
  id: string
  table: string
  localData: any
  cloudData: any
  resolution: 'local' | 'cloud' | 'merge' | 'manual'
  timestamp: Date
}

// ============================================================================
// 认证服务类型定义
// ============================================================================

export interface AuthState {
  user: any
  session: any
  loading: boolean
  error: Error | null
}

// ============================================================================
// 数据库类型定义
// ============================================================================

export interface DbCard {
  id: string
  frontContent: any
  backContent: any
  style: any
  isFlipped: boolean
  createdAt: Date
  updatedAt: Date
  syncVersion: number
  pendingSync: boolean
}

export interface DbFolder {
  id: string
  name: string
  parentId: string | null
  createdAt: Date
  updatedAt: Date
  syncVersion: number
  pendingSync: boolean
}

export interface DbTag {
  id: string
  name: string
  color: string
  createdAt: Date
  updatedAt: Date
  syncVersion: number
  pendingSync: boolean
}

// ============================================================================
// API版本信息
// ============================================================================

export interface ApiVersion {
  version: string
  deprecated: boolean
  deprecationDate?: Date
  removalDate?: Date
  replacementApi?: string
  description: string
}

export interface ApiMetrics {
  api: string
  version: string
  calls: number
  errors: number
  avgResponseTime: number
  lastUsed: Date
}

// ============================================================================
// 适配器配置
// ============================================================================

export interface AdapterConfig {
  enableWarnings: boolean
  enableMetrics: boolean
  enableMigration: boolean
  strictMode: boolean
  logLevel: 'error' | 'warn' | 'info' | 'debug'
}

// ============================================================================
// 事件监听器类型
// ============================================================================

export type StatusChangeListener = (status: SyncStatus) => void
export type AuthStateChangeListener = (state: AuthState) => void
export type ProgressListener = (progress: number) => void
export type ErrorListener = (error: Error) => void
export type ConflictListener = (conflict: ConflictResolution) => void

// ============================================================================
// 通用操作接口
// ============================================================================

export interface BaseOperation {
  id: string
  type: string
  timestamp: Date
  userId?: string
}

export interface DatabaseOperation extends BaseOperation {
  entity: string
  entityId: string
  data: any
}

export interface SyncQueueOperation extends BaseOperation {
  table: string
  data: any
  localId: string
  retryCount: number
}

// ============================================================================
// 导出所有类型
// ============================================================================

export * from './types'