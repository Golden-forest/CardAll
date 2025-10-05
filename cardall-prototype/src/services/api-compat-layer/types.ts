// ============================================================================
// API兼容层类型定义
// ============================================================================
// 创建时间：2025-09-13
// 更新时间：2025-10-05
// 功能：为现有UI组件提供API兼容层类型定义（仅本地功能）
// ============================================================================

// ============================================================================
// 本地数据库操作类型定义
// ============================================================================

export interface LocalOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  table: 'cards' | 'folders' | 'tags' | 'images'
  data: any
  localId: string
  timestamp: Date
}

// ============================================================================
// 数据库适配器类型定义
// ============================================================================

export interface DatabaseAdapterConfig {
  enableMetrics?: boolean
  enableWarnings?: boolean
  logLevel?: 'error' | 'warn' | 'info' | 'debug'
  strictMode?: boolean
}

export interface DatabaseState {
  isConnected: boolean
  isInitializing: boolean
  error?: Error
  lastSyncTime?: Date
}

// ============================================================================
// 适配器基础类型
// ============================================================================

export interface AdapterOptions {
  enableMetrics?: boolean
  enableWarnings?: boolean
  logLevel?: 'error' | 'warn' | 'info' | 'debug'
  strictMode?: boolean
}

export interface AdapterConfig {
  name: string
  version: string
}

// ============================================================================
// 事件监听器类型
// ============================================================================

export type StatusChangeListener = (status: DatabaseState) => void
export type ProgressListener = (progress: number) => void
export type ErrorListener = (error: Error) => void

// ============================================================================
// 通用操作接口
// ============================================================================

export interface OperationResult<T = any> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// 导出所有类型
// ============================================================================

export type {
  LocalOperation,
  DatabaseAdapterConfig,
  DatabaseState,
  AdapterOptions,
  AdapterConfig,
  OperationResult,
  StatusChangeListener,
  ProgressListener,
  ErrorListener
}