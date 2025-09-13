// 增量同步算法接口
// Week 3 Day 11-13 同步机制重构 - Project-Brainstormer

export interface SyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  entity: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  data: any
  timestamp: Date
  retryCount: number
  priority: 'high' | 'medium' | 'low'
  userId?: string
  syncVersion: number
  metadata?: Record<string, any>
}

export interface SyncResult {
  success: boolean
  processedCount: number
  failedCount: number
  conflicts: ConflictInfo[]
  errors: SyncError[]
  duration: number
  bytesTransferred: number
}

export interface ConflictInfo {
  id: string
  entityId: string
  entityType: string
  localData: any
  cloudData: any
  conflictType: 'concurrent_modification' | 'version_mismatch' | 'data_corruption' | 'logic_conflict'
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: Date
  autoResolved: boolean
  resolution?: 'local_wins' | 'cloud_wins' | 'merge' | 'manual'
}

export interface SyncError {
  id: string
  operationId: string
  errorType: 'network_error' | 'validation_error' | 'timeout_error' | 'server_error' | 'conflict_error'
  message: string
  details?: any
  timestamp: Date
  retryable: boolean
  resolved: boolean
}

export interface SyncVersion {
  id: string
  timestamp: Date
  operations: SyncOperation[]
  checksum: string
  description: string
  rollbackPoint: boolean
}

export interface SyncMetrics {
  totalOperations: number
  successRate: number
  averageResponseTime: number
  bandwidthUsage: number
  conflictRate: number
  retryCount: number
  lastSyncTimestamp: Date
}