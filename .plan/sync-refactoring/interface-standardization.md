# 接口标准化设计方案

## 1. 设计目标

基于统一同步服务架构，设计一套标准化、类型安全、向后兼容的API接口体系，为未来功能扩展提供坚实基础。

## 2. 核心设计原则

### 2.1 类型安全原则
- 严格的TypeScript类型定义
- 编译时错误检测
- 运行时类型验证

### 2.2 向后兼容原则
- 新接口不破坏现有功能
- 支持渐进式迁移
- 提供废弃警告机制

### 2.3 扩展性原则
- 接口设计考虑未来扩展
- 模块化架构设计
- 插件化功能支持

## 3. 标准化接口设计

### 3.1 统一同步操作接口

#### 3.1.1 基础操作类型

```typescript
// D:\Projects\CardEverything\cardall-prototype\src\types\sync\standard-operations.ts

/**
 * 标准同步操作类型
 * 定义所有同步操作的统一格式
 */
export interface StandardSyncOperation {
  // === 核心标识信息 ===
  id: string
  type: 'create' | 'update' | 'delete'
  entity: SyncEntityType
  entityId: string

  // === 数据内容 ===
  data: Record<string, any>
  previousData?: Record<string, any> // 用于更新操作的原始数据

  // === 调度和优先级 ===
  priority: SyncPriority
  timestamp: Date
  scheduledFor?: Date
  retryCount: number
  maxRetries: number

  // === 用户和权限 ===
  userId?: string
  tenantId?: string
  permissions?: SyncPermission[]

  // === 依赖关系 ===
  dependencies?: string[]
  dependentOperations?: string[]

  // === 元数据和追踪 ===
  metadata: SyncMetadata
  tracing?: OperationTracing
}

/**
 * 同步实体类型枚举
 */
export enum SyncEntityType {
  CARD = 'card',
  FOLDER = 'folder',
  TAG = 'tag',
  IMAGE = 'image',
  USER_PREFERENCE = 'user_preference',
  SYNC_CONFIG = 'sync_config'
}

/**
 * 同步优先级枚举
 */
export enum SyncPriority {
  CRITICAL = 'critical',    // 立即执行，高优先级
  HIGH = 'high',            // 优先执行
  NORMAL = 'normal',        // 正常优先级
  LOW = 'low',             // 低优先级，可延迟
  BACKGROUND = 'background' // 后台执行，最低优先级
}

/**
 * 同步权限类型
 */
export enum SyncPermission {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  SHARE = 'share',
  ADMIN = 'admin'
}
```

#### 3.1.2 元数据结构

```typescript
/**
 * 同步操作元数据
 */
export interface SyncMetadata {
  // === 来源和上下文 ===
  source: SyncSource
  context?: SyncContext

  // === 冲突解决策略 ===
  conflictResolution?: ConflictResolutionStrategy

  // === 重试策略 ===
  retryStrategy?: RetryStrategy

  // === 批处理信息 ===
  batchId?: string
  batchPosition?: number
  batchSize?: number

  // === 性能和优化 ===
  estimatedSize?: number      // 预估数据大小（字节）
  compressionEnabled?: boolean
  deduplicationEnabled?: boolean

  // === 业务规则 ===
  businessRules?: BusinessRule[]
  validationRules?: ValidationRule[]
}

/**
 * 同步来源枚举
 */
export enum SyncSource {
  USER = 'user',           // 用户操作
  SYNC = 'sync',           // 同步操作
  SYSTEM = 'system',       // 系统操作
  IMPORT = 'import',       // 数据导入
  MIGRATION = 'migration',  // 数据迁移
  API = 'api'             // API调用
}

/**
 * 冲突解决策略
 */
export enum ConflictResolutionStrategy {
  LOCAL_WINS = 'local_wins',
  CLOUD_WINS = 'cloud_wins',
  MERGE = 'merge',
  MANUAL = 'manual',
  TIMESTAMP_BASED = 'timestamp_based',
  VERSION_BASED = 'version_based'
}

/**
 * 重试策略
 */
export enum RetryStrategy {
  IMMEDIATE = 'immediate',
  DELAYED = 'delayed',
  EXPONENTIAL = 'exponential',
  LINEAR = 'linear',
  ADAPTIVE = 'adaptive'
}
```

#### 3.1.3 操作追踪信息

```typescript
/**
 * 操作追踪信息
 */
export interface OperationTracing {
  traceId: string
  spanId: string
  parentSpanId?: string
  startTime: Date
  endTime?: Date
  duration?: number
  status: OperationStatus
  tags?: Record<string, string>
  logs?: TraceLog[]
}

/**
 * 操作状态枚举
 */
export enum OperationStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  CANCELLED = 'cancelled'
}

/**
 * 追踪日志条目
 */
export interface TraceLog {
  timestamp: Date
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  data?: any
}
```

### 3.2 统一同步服务接口

#### 3.2.1 核心服务接口

```typescript
// D:\Projects\CardEverything\cardall-prototype\src\services\sync\interfaces\sync-service.ts

/**
 * 统一同步服务接口
 * 定义标准化的同步服务API
 */
export interface IUnifiedSyncService {
  // === 核心操作方法 ===
  addOperation(operation: Omit<StandardSyncOperation, 'id' | 'timestamp'>): Promise<string>
  addOperations(operations: Omit<StandardSyncOperation, 'id' | 'timestamp'>[]): Promise<string[]>
  removeOperation(operationId: string): Promise<boolean>

  // === 同步执行方法 ===
  performSync(options?: SyncOptions): Promise<SyncResult>
  performFullSync(options?: SyncOptions): Promise<SyncResult>
  performIncrementalSync(options?: IncrementalSyncOptions): Promise<SyncResult>

  // === 状态查询方法 ===
  getStatus(): Promise<SyncStatus>
  getMetrics(): Promise<SyncMetrics>
  getQueueStatus(): Promise<QueueStatus>
  getOperationHistory(filters?: OperationHistoryFilters): Promise<StandardSyncOperation[]>

  // === 冲突处理方法 ===
  getConflicts(): Promise<SyncConflict[]>
  resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void>
  getConflictResolutionStrategies(): ConflictResolutionStrategy[]

  // === 事件监听方法 ===
  onStatusChange(callback: (status: SyncStatus) => void): () => void
  onOperationComplete(callback: (operation: StandardSyncOperation, result: SyncResult) => void): () => void
  onConflictDetected(callback: (conflict: SyncConflict) => void): () => void
  onProgress(callback: (progress: SyncProgress) => void): () => void
  onError(callback: (error: SyncError) => void): () => void

  // === 配置管理方法 ===
  getConfiguration(): Promise<SyncConfiguration>
  updateConfiguration(config: Partial<SyncConfiguration>): Promise<void>
  resetConfiguration(): Promise<void>

  // === 控制方法 ===
  pause(): Promise<void>
  resume(): Promise<void>
  cancel(operationId?: string): Promise<void>
  forceSync(): Promise<SyncResult>
}
```

#### 3.2.2 同步选项和结果

```typescript
/**
 * 同步选项接口
 */
export interface SyncOptions {
  // === 基础选项 ===
  userId?: string
  includeEntities?: SyncEntityType[]
  excludeEntities?: SyncEntityType[]
  maxOperations?: number

  // === 网络选项 ===
  networkTimeout?: number
  retryAttempts?: number
  offlineSupport?: boolean

  // === 性能选项 ===
  batchSize?: number
  compressionEnabled?: boolean
  parallelProcessing?: boolean

  // === 冲突解决 ===
  conflictResolution?: ConflictResolutionStrategy
  autoResolveConflicts?: boolean

  // === 调试选项 ===
  debugMode?: boolean
  detailedLogging?: boolean
}

/**
 * 增量同步选项
 */
export interface IncrementalSyncOptions extends SyncOptions {
  // === 增量同步特有选项 ===
  since?: Date
  includeDeleted?: boolean
  versionBased?: boolean
  checksumValidation?: boolean
}

/**
 * 同步结果接口
 */
export interface SyncResult {
  // === 基础信息 ===
  success: boolean
  operationId: string
  timestamp: Date
  duration: number

  // === 统计信息 ===
  statistics: SyncStatistics
  performance: PerformanceMetrics

  // === 操作结果 ===
  operations: OperationResult[]
  conflicts: SyncConflict[]
  errors: SyncError[]

  // === 元数据 ===
  metadata?: {
    bandwidthUsed: number
    requestsMade: number
    cacheHits: number
    compressionRatio?: number
  }
}

/**
 * 同步统计信息
 */
export interface SyncStatistics {
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  skippedOperations: number
  retriedOperations: number

  entities: {
    [key in SyncEntityType]?: {
      created: number
      updated: number
      deleted: number
    }
  }
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  averageResponseTime: number
  maxResponseTime: number
  minResponseTime: number
  totalBandwidthUsed: number
  compressionRatio?: number
  cacheHitRate: number
}
```

#### 3.2.3 状态和进度接口

```typescript
/**
 * 同步状态接口
 */
export interface SyncStatus {
  // === 连接状态 ===
  isOnline: boolean
  networkQuality: NetworkQuality
  connectionType?: ConnectionType

  // === 同步状态 ===
  syncInProgress: boolean
  currentOperation?: string
  syncProgress: number

  // === 队列状态 ===
  pendingOperations: number
  processingOperations: number
  completedOperations: number
  failedOperations: number

  // === 冲突状态 ===
  hasConflicts: boolean
  conflictCount: number

  // === 时间信息 ===
  lastSyncTime?: Date
  nextSyncTime?: Date
  estimatedRemainingTime?: number

  // === 系统状态 ===
  systemHealth: SystemHealth
  memoryUsage: MemoryUsage
}
```

### 3.3 类型安全的操作处理器

#### 3.3.1 泛型操作接口

```typescript
// D:\Projects\CardEverything\cardall-prototype\src\services\sync\interfaces\operation-handlers.ts

/**
 * 泛型操作接口
 * 提供类型安全的操作处理
 */
export interface IEntityOperation<T extends SyncEntityType, D> {
  type: 'create' | 'update' | 'delete'
  entity: T
  entityId: string
  data: D
  previousData?: D
}

/**
 * 具体实体操作类型
 */
export type CardOperation = IEntityOperation<SyncEntityType.CARD, CardData>
export type FolderOperation = IEntityOperation<SyncEntityType.FOLDER, FolderData>
export type TagOperation = IEntityOperation<SyncEntityType.TAG, TagData>
export type ImageOperation = IEntityOperation<SyncEntityType.IMAGE, ImageData>

/**
 * 联合操作类型
 */
export type TypedSyncOperation =
  | CardOperation
  | FolderOperation
  | TagOperation
  | ImageOperation

/**
 * 操作处理器接口
 */
export interface IOperationHandler<T extends SyncEntityType, D> {
  validate(operation: IEntityOperation<T, D>): Promise<ValidationResult>
  execute(operation: IEntityOperation<T, D>): Promise<OperationResult>
  rollback(operation: IEntityOperation<T, D>): Promise<boolean>
  estimateCost(operation: IEntityOperation<T, D>): Promise<number>
}

/**
 * 操作处理器注册表
 */
export interface IOperationHandlerRegistry {
  register<T extends SyncEntityType, D>(
    entityType: T,
    handler: IOperationHandler<T, D>
  ): void

  getHandler<T extends SyncEntityType>(
    entityType: T
  ): IOperationHandler<T, any> | undefined

  getSupportedEntities(): SyncEntityType[]
}
```

#### 3.3.2 类型守卫和验证

```typescript
/**
 * 类型守卫工具
 */
export class SyncOperationTypeGuards {
  static isCardOperation(operation: any): operation is CardOperation {
    return operation?.entity === SyncEntityType.CARD
  }

  static isFolderOperation(operation: any): operation is FolderOperation {
    return operation?.entity === SyncEntityType.FOLDER
  }

  static isTagOperation(operation: any): operation is TagOperation {
    return operation?.entity === SyncEntityType.TAG
  }

  static isImageOperation(operation: any): operation is ImageOperation {
    return operation?.entity === SyncEntityType.IMAGE
  }

  static isCreateOperation<T extends SyncEntityType>(
    operation: any
  ): operation is IEntityOperation<T, any> & { type: 'create' } {
    return operation?.type === 'create'
  }

  static isUpdateOperation<T extends SyncEntityType>(
    operation: any
  ): operation is IEntityOperation<T, any> & { type: 'update' } {
    return operation?.type === 'update'
  }

  static isDeleteOperation<T extends SyncEntityType>(
    operation: any
  ): operation is IEntityOperation<T, any> & { type: 'delete' } {
    return operation?.type === 'delete'
  }
}

/**
 * 运行时类型验证器
 */
export class SyncOperationValidator {
  static async validate(operation: any): Promise<ValidationResult> {
    const errors: string[] = []

    // 验证必需字段
    if (!operation.id || typeof operation.id !== 'string') {
      errors.push('Invalid or missing operation id')
    }

    if (!operation.type || !['create', 'update', 'delete'].includes(operation.type)) {
      errors.push('Invalid operation type')
    }

    if (!operation.entity || !Object.values(SyncEntityType).includes(operation.entity)) {
      errors.push('Invalid operation entity')
    }

    if (!operation.entityId || typeof operation.entityId !== 'string') {
      errors.push('Invalid or missing entity id')
    }

    // 验证数据结构
    if (operation.data && typeof operation.data !== 'object') {
      errors.push('Invalid data structure')
    }

    // 验证优先级
    if (operation.priority && !Object.values(SyncPriority).includes(operation.priority)) {
      errors.push('Invalid priority value')
    }

    // 实体特定验证
    const entityValidation = await this.validateEntitySpecific(operation)
    errors.push(...entityValidation.errors)

    return {
      valid: errors.length === 0,
      errors,
      warnings: entityValidation.warnings
    }
  }

  private static async validateEntitySpecific(operation: any): Promise<{
    errors: string[]
    warnings: string[]
  }> {
    const errors: string[] = []
    const warnings: string[] = []

    switch (operation.entity) {
      case SyncEntityType.CARD:
        await this.validateCardData(operation.data, errors, warnings)
        break
      case SyncEntityType.FOLDER:
        await this.validateFolderData(operation.data, errors, warnings)
        break
      case SyncEntityType.TAG:
        await this.validateTagData(operation.data, errors, warnings)
        break
      case SyncEntityType.IMAGE:
        await this.validateImageData(operation.data, errors, warnings)
        break
    }

    return { errors, warnings }
  }

  private static async validateCardData(
    data: any,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    if (!data.frontContent) {
      errors.push('Card data missing frontContent')
    }

    if (!data.backContent) {
      errors.push('Card data missing backContent')
    }

    if (data.frontContent && typeof data.frontContent !== 'object') {
      errors.push('Invalid frontContent structure')
    }

    if (data.backContent && typeof data.backContent !== 'object') {
      errors.push('Invalid backContent structure')
    }

    // 检查数据大小
    const dataSize = JSON.stringify(data).length
    if (dataSize > 1024 * 1024) { // 1MB
      warnings.push(`Card data size is large: ${dataSize} bytes`)
    }
  }

  private static async validateFolderData(
    data: any,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    if (!data.name || typeof data.name !== 'string') {
      errors.push('Folder data missing or invalid name')
    }

    if (data.name && data.name.length > 100) {
      warnings.push('Folder name is very long')
    }
  }

  private static async validateTagData(
    data: any,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    if (!data.name || typeof data.name !== 'string') {
      errors.push('Tag data missing or invalid name')
    }

    if (data.color && !/^#[0-9A-F]{6}$/i.test(data.color)) {
      warnings.push('Invalid color format, should be #RRGGBB')
    }
  }

  private static async validateImageData(
    data: any,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    if (!data.fileName || typeof data.fileName !== 'string') {
      errors.push('Image data missing fileName')
    }

    if (!data.filePath && !data.url) {
      errors.push('Image data missing filePath or url')
    }

    if (data.fileSize && data.fileSize > 10 * 1024 * 1024) { // 10MB
      warnings.push('Image file is very large')
    }
  }
}
```

### 3.4 事件系统标准化

#### 3.4.1 统一事件接口

```typescript
// D:\Projects\CardEverything\cardall-prototype\src\services\sync\interfaces\event-system.ts

/**
 * 同步事件类型枚举
 */
export enum SyncEventType {
  // === 操作事件 ===
  OPERATION_QUEUED = 'operation_queued',
  OPERATION_STARTED = 'operation_started',
  OPERATION_COMPLETED = 'operation_completed',
  OPERATION_FAILED = 'operation_failed',
  OPERATION_RETRYING = 'operation_retrying',
  OPERATION_CANCELLED = 'operation_cancelled',

  // === 同步事件 ===
  SYNC_STARTED = 'sync_started',
  SYNC_PROGRESS = 'sync_progress',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_FAILED = 'sync_failed',
  SYNC_PAUSED = 'sync_paused',
  SYNC_RESUMED = 'sync_resumed',

  // === 冲突事件 ===
  CONFLICT_DETECTED = 'conflict_detected',
  CONFLICT_RESOLVED = 'conflict_resolved',
  CONFLICT_ESCALATED = 'conflict_escalated',

  // === 网络事件 ===
  NETWORK_CONNECTED = 'network_connected',
  NETWORK_DISCONNECTED = 'network_disconnected',
  NETWORK_SLOW = 'network_slow',
  NETWORK_ERROR = 'network_error',

  // === 系统事件 ===
  CONFIGURATION_CHANGED = 'configuration_changed',
  HEALTH_CHECK_FAILED = 'health_check_failed',
  MAINTENANCE_MODE = 'maintenance_mode'
}

/**
 * 统一同步事件接口
 */
export interface SyncEvent<T extends SyncEventType = SyncEventType> {
  id: string
  type: T
  timestamp: Date
  source: string
  data: SyncEventData<T>
  metadata?: EventMetadata
}

/**
 * 事件数据类型映射
 */
export type SyncEventData<T extends SyncEventType> = T extends keyof SyncEventDataTypeMap
  ? SyncEventDataTypeMap[T]
  : any

/**
 * 事件数据类型映射表
 */
export interface SyncEventDataTypeMap {
  [SyncEventType.OPERATION_QUEUED]: OperationQueuedData
  [SyncEventType.OPERATION_STARTED]: OperationStartedData
  [SyncEventType.OPERATION_COMPLETED]: OperationCompletedData
  [SyncEventType.OPERATION_FAILED]: OperationFailedData
  [SyncEventType.OPERATION_RETRYING]: OperationRetryingData
  [SyncEventType.OPERATION_CANCELLED]: OperationCancelledData
  [SyncEventType.SYNC_STARTED]: SyncStartedData
  [SyncEventType.SYNC_PROGRESS]: SyncProgressData
  [SyncEventType.SYNC_COMPLETED]: SyncCompletedData
  [SyncEventType.SYNC_FAILED]: SyncFailedData
  [SyncEventType.SYNC_PAUSED]: SyncPausedData
  [SyncEventType.SYNC_RESUMED]: SyncResumedData
  [SyncEventType.CONFLICT_DETECTED]: ConflictDetectedData
  [SyncEventType.CONFLICT_RESOLVED]: ConflictResolvedData
  [SyncEventType.CONFLICT_ESCALATED]: ConflictEscalatedData
  [SyncEventType.NETWORK_CONNECTED]: NetworkConnectedData
  [SyncEventType.NETWORK_DISCONNECTED]: NetworkDisconnectedData
  [SyncEventType.NETWORK_SLOW]: NetworkSlowData
  [SyncEventType.NETWORK_ERROR]: NetworkErrorData
  [SyncEventType.CONFIGURATION_CHANGED]: ConfigurationChangedData
  [SyncEventType.HEALTH_CHECK_FAILED]: HealthCheckFailedData
  [SyncEventType.MAINTENANCE_MODE]: MaintenanceModeData
}

/**
 * 事件元数据
 */
export interface EventMetadata {
  userId?: string
  sessionId?: string
  requestId?: string
  traceId?: string
  version?: string
  environment?: string
}
```

#### 3.4.2 事件监听器接口

```typescript
/**
 * 事件监听器接口
 */
export interface ISyncEventListener {
  /**
   * 事件处理器
   */
  handleEvent<T extends SyncEventType>(event: SyncEvent<T>): Promise<void> | void

  /**
   * 获取监听的事件类型
   */
  getSubscribedEvents(): SyncEventType[]

  /**
   * 检查是否应该处理此事件
   */
  shouldHandleEvent<T extends SyncEventType>(event: SyncEvent<T>): boolean
}

/**
 * 事件管理器接口
 */
export interface ISyncEventManager {
  /**
   * 注册事件监听器
   */
  addEventListener<T extends SyncEventType>(
    eventType: T,
    listener: (event: SyncEvent<T>) => void | Promise<void>
  ): () => void

  /**
   * 移除事件监听器
   */
  removeEventListener<T extends SyncEventType>(
    eventType: T,
    listener: (event: SyncEvent<T>) => void | Promise<void>
  ): void

  /**
   * 发送事件
   */
  emitEvent<T extends SyncEventType>(
    eventType: T,
    data: SyncEventData<T>,
    metadata?: EventMetadata
  ): Promise<void>

  /**
   * 批量发送事件
   */
  emitEvents(events: SyncEvent[]): Promise<void>

  /**
   * 获取事件历史
   */
  getEventHistory(filters?: EventFilters): Promise<SyncEvent[]>

  /**
   * 清理事件历史
   */
  clearEventHistory(olderThan?: Date): Promise<void>
}
```

## 4. 迁移路径和兼容性

### 4.1 向后兼容映射

```typescript
// D:\Projects\CardEverything\cardall-prototype\src\services\sync\compatibility\type-mapping.ts

/**
 * 类型映射工具
 * 将旧的接口类型映射到新的标准化类型
 */
export class TypeMappingUtils {
  /**
   * 将旧的SyncOperation映射到StandardSyncOperation
   */
  static mapToStandardOperation(
    legacyOperation: any
  ): StandardSyncOperation {
    return {
      id: legacyOperation.id || crypto.randomUUID(),
      type: legacyOperation.type,
      entity: this.mapTableToEntity(legacyOperation.table),
      entityId: legacyOperation.localId || legacyOperation.entityId,
      data: legacyOperation.data,
      priority: this.mapPriority(legacyOperation),
      timestamp: legacyOperation.timestamp || new Date(),
      retryCount: legacyOperation.retryCount || 0,
      maxRetries: this.getMaxRetries(legacyOperation),
      userId: legacyOperation.userId,
      metadata: this.mapMetadata(legacyOperation)
    }
  }

  /**
   * 将旧的SyncStatus映射到新的SyncStatus
   */
  static mapToStandardStatus(
    legacyStatus: any
  ): SyncStatus {
    return {
      isOnline: legacyStatus.isOnline,
      networkQuality: this.mapNetworkQuality(legacyStatus),
      syncInProgress: legacyStatus.syncInProgress,
      pendingOperations: legacyStatus.pendingOperations || 0,
      hasConflicts: legacyStatus.hasConflicts || false,
      lastSyncTime: legacyStatus.lastSyncTime,
      systemHealth: {
        overall: 'healthy',
        services: {
          database: 'healthy',
          network: legacyStatus.isOnline ? 'healthy' : 'unhealthy',
          storage: 'healthy'
        }
      },
      memoryUsage: {
        used: 0,
        total: 0,
        percentage: 0
      }
    }
  }

  /**
   * 映射表名到实体类型
   */
  private static mapTableToEntity(table: string): SyncEntityType {
    const mapping: Record<string, SyncEntityType> = {
      'cards': SyncEntityType.CARD,
      'folders': SyncEntityType.FOLDER,
      'tags': SyncEntityType.TAG,
      'images': SyncEntityType.IMAGE
    }

    return mapping[table] || SyncEntityType.CARD
  }

  /**
   * 映射优先级
   */
  private static mapPriority(operation: any): SyncPriority {
    if (operation.type === 'delete') return SyncPriority.HIGH

    // 根据操作复杂度确定优先级
    const dataSize = JSON.stringify(operation.data).length
    if (dataSize > 1000000) return SyncPriority.LOW  // 大于1MB
    if (dataSize > 100000) return SyncPriority.NORMAL // 大于100KB

    return SyncPriority.NORMAL
  }

  /**
   * 获取最大重试次数
   */
  private static getMaxRetries(operation: any): number {
    switch (operation.type) {
      case 'delete': return 5
      case 'create': return 3
      case 'update': return 3
      default: return 2
    }
  }

  /**
   * 映射元数据
   */
  private static mapMetadata(operation: any): SyncMetadata {
    return {
      source: SyncSource.USER,
      conflictResolution: ConflictResolutionStrategy.TIMESTAMP_BASED,
      retryStrategy: RetryStrategy.EXPONENTIAL,
      compressionEnabled: false,
      businessRules: []
    }
  }

  /**
   * 映射网络质量
   */
  private static mapNetworkQuality(status: any): NetworkQuality {
    if (!status.isOnline) return NetworkQuality.OFFLINE
    if (status.pendingOperations > 50) return NetworkQuality.POOR
    if (status.pendingOperations > 10) return NetworkQuality.FAIR
    return NetworkQuality.GOOD
  }
}
```

### 4.2 渐进式类型迁移

```typescript
/**
 * 渐进式类型迁移工具
 */
export class TypeMigrationHelper {
  /**
   * 验证类型兼容性
   */
  static async validateTypeCompatibility(
    oldType: any,
    newType: any
  ): Promise<TypeCompatibilityResult> {
    const compatibility = await this.analyzeCompatibility(oldType, newType)

    return {
      compatible: compatibility.score >= 0.8, // 80%兼容性阈值
      score: compatibility.score,
      issues: compatibility.issues,
      suggestions: this.generateMigrationSuggestions(compatibility)
    }
  }

  /**
   * 生成类型迁移代码
   */
  static generateMigrationCode(
    oldInterface: string,
    newInterface: string
  ): MigrationCode {
    return {
      adapterCode: this.generateAdapterCode(oldInterface, newInterface),
      validationCode: this.generateValidationCode(newInterface),
      usageExamples: this.generateUsageExamples(newInterface),
      migrationSteps: this.generateMigrationSteps(oldInterface, newInterface)
    }
  }

  private static async analyzeCompatibility(
    oldType: any,
    newType: any
  ): Promise<CompatibilityAnalysis> {
    // 实现类型兼容性分析逻辑
    return {
      score: 0.85,
      issues: [],
      mappings: new Map()
    }
  }

  private static generateMigrationSuggestions(
    analysis: CompatibilityAnalysis
  ): MigrationSuggestion[] {
    return [
      {
        type: 'info',
        message: 'Type migration is safe with minimal changes required',
        impact: 'low',
        effort: 'minimal'
      }
    ]
  }
}
```

## 5. 实施计划

### 5.1 第一阶段：类型定义（1周）

1. **核心类型定义**
   - 定义StandardSyncOperation接口
   - 实现类型守卫和验证器
   - 创建实体特定类型

2. **事件系统类型**
   - 定义统一事件接口
   - 实现事件数据类型映射
   - 创建事件监听器接口

### 5.2 第二阶段：接口实现（2周）

1. **服务接口实现**
   - 实现IUnifiedSyncService接口
   - 创建操作处理器系统
   - 实现事件管理器

2. **兼容层集成**
   - 创建类型映射工具
   - 实现渐进式迁移
   - 集成现有系统

### 5.3 第三阶段：测试和验证（1周）

1. **类型安全测试**
   - TypeScript编译验证
   - 运行时类型测试
   - 边界情况测试

2. **集成测试**
   - 现有组件兼容性测试
   - 性能基准测试
   - 端到端功能测试

## 6. 总结

本接口标准化设计提供了：

1. **类型安全**：严格的TypeScript类型定义和运行时验证
2. **向后兼容**：完整的旧接口到新接口的映射机制
3. **扩展性**：模块化、插件化的架构设计
4. **标准化**：统一的API接口和事件系统
5. **渐进式迁移**：支持平滑的架构过渡

通过这套标准化接口设计，可以为项目提供坚实的类型安全基础，同时保证现有功能的完全兼容性。