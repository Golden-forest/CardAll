/**
 * 离线优先架构核心类型定义
 */

/**
 * 本地数据存储状态枚举
 */
export enum LocalDataState {
  /**
   * 仅本地存在
   */
  LOCAL_ONLY = 'local_only',
  /**
   * 同步中
   */
  SYNCING = 'syncing',
  /**
   * 已同步
   */
  SYNCED = 'synced',
  /**
   * 冲突状态
   */
  CONFLICTED = 'conflicted',
  /**
   * 待删除
   */
  PENDING_DELETE = 'pending_delete'
}

/**
 * 数据版本信息
 */
export interface DataVersion {
  /**
   * 本地版本号
   */
  localVersion: number;
  /**
   * 远程版本号
   */
  remoteVersion?: number;
  /**
   * 最后同步时间
   */
  lastSyncAt?: Date;
  /**
   * 数据哈希值（用于变更检测）
   */
  dataHash: string;
}

/**
 * 本地数据存储接口
 */
export interface LocalDataStore<T> {
  /**
   * 获取数据
   */
  get(id: string): Promise<T | null>;

  /**
   * 获取所有数据
   */
  getAll(): Promise<T[]>;

  /**
   * 创建数据
   */
  create(data: Omit<T, 'id'>): Promise<string>;

  /**
   * 更新数据
   */
  update(id: string, updates: Partial<T>): Promise<boolean>;

  /**
   * 删除数据
   */
  delete(id: string): Promise<boolean>;

  /**
   * 获取数据状态
   */
  getDataState(id: string): Promise<LocalDataState>;

  /**
   * 获取数据版本信息
   */
  getDataVersion(id: string): Promise<DataVersion>;

  /**
   * 设置数据状态
   */
  setDataState(id: string, state: LocalDataState): Promise<void>;

  /**
   * 监听数据变更
   */
  onChange(callback: (data: T[]) => void): () => void;
}

/**
 * 同步队列操作类型
 */
export enum SyncOperationType {
  /**
   * 创建
   */
  CREATE = 'create',
  /**
   * 更新
   */
  UPDATE = 'update',
  /**
   * 删除
   */
  DELETE = 'delete',
  /**
   * 合并
   */
  MERGE = 'merge',
  /**
   * 冲突解决
   */
  RESOLVE_CONFLICT = 'resolve_conflict'
}

/**
 * 同步优先级
 */
export enum SyncPriority {
  /**
   * 低优先级（批量操作）
   */
  LOW = 1,
  /**
   * 中等优先级（普通操作）
   */
  MEDIUM = 2,
  /**
   * 高优先级（用户交互）
   */
  HIGH = 3,
  /**
   * 紧急优先级（关键操作）
   */
  CRITICAL = 4
}

/**
 * 同步操作接口
 */
export interface SyncOperation {
  /**
   * 操作ID
   */
  id: string;
  /**
   * 操作类型
   */
  type: SyncOperationType;
  /**
   * 数据类型
   */
  entityType: string;
  /**
   * 数据ID
   */
  entityId: string;
  /**
   * 操作数据
   */
  data: any;
  /**
   * 优先级
   */
  priority: SyncPriority;
  /**
   * 重试次数
   */
  retryCount: number;
  /**
   * 最大重试次数
   */
  maxRetries: number;
  /**
   * 创建时间
   */
  createdAt: Date;
  /**
   * 最后尝试时间
   */
  lastAttemptAt?: Date;
  /**
   * 下次尝试时间
   */
  nextAttemptAt?: Date;
  /**
   * 错误信息
   */
  error?: string;
  /**
   * 依赖的操作ID
   */
  dependencies?: string[];
  /**
   * 操作状态
   */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
}

/**
 * 网络状态信息
 */
export interface NetworkStatus {
  /**
   * 是否在线
   */
  isOnline: boolean;
  /**
   * 网络类型
   */
  type: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  /**
   * 信号强度 (0-100)
   */
  signalStrength?: number;
  /**
   * 延迟 (ms)
   */
  latency?: number;
  /**
   * 带宽 (Mbps)
   */
  bandwidth?: number;
  /**
   * 最后更新时间
   */
  updatedAt: Date;
}

/**
 * 同步配置接口
 */
export interface SyncConfiguration {
  /**
   * 自动同步启用状态
   */
  autoSyncEnabled: boolean;
  /**
   * 同步间隔 (ms)
   */
  syncInterval: number;
  /**
   * 批量同步大小
   */
  batchSize: number;
  /**
   * 最大重试次数
   */
  maxRetries: number;
  /**
   * 冲突解决策略
   */
  conflictResolutionStrategy: 'local_wins' | 'remote_wins' | 'manual' | 'smart_merge';
  /**
   * 网络阈值配置
   */
  networkThresholds: {
    /**
     * 最小带宽 (Mbps)
     */
    minBandwidth: number;
    /**
     * 最大延迟 (ms)
     */
    maxLatency: number;
    /**
     * 最大丢包率 (%)
     */
    maxPacketLoss: number;
  };
  /**
   * 数据保留策略
   */
  dataRetention: {
    /**
     * 本地数据保留天数
     */
    localRetentionDays: number;
    /**
     * 同步日志保留天数
     */
    syncLogRetentionDays: number;
  };
}

/**
 * 同步统计信息
 */
export interface SyncStatistics {
  /**
   * 总操作数
   */
  totalOperations: number;
  /**
   * 成功操作数
   */
  successfulOperations: number;
  /**
   * 失败操作数
   */
  failedOperations: number;
  /**
   * 待处理操作数
   */
  pendingOperations: number;
  /**
   * 冲突数量
   */
  conflictsCount: number;
  /**
   * 最后同步时间
   */
  lastSyncTime?: Date;
  /**
   * 平均同步时间 (ms)
   */
  averageSyncTime: number;
  /**
   * 数据传输量 (bytes)
   */
  dataTransferred: number;
}

/**
 * 冲突解决策略接口
 */
export interface ConflictResolutionStrategy {
  /**
   * 解决冲突
   */
  resolve(conflict: ConflictInfo): Promise<ResolutionResult>;
  /**
   * 获取策略名称
   */
  getName(): string;
  /**
   * 获取策略描述
   */
  getDescription(): string;
  /**
   * 是否适用于特定冲突类型
   */
  isApplicable(conflict: ConflictInfo): boolean;
}

/**
 * 智能合并结果
 */
export interface MergeResult {
  /**
   * 是否成功
   */
  success: boolean;
  /**
   * 合并后的数据
   */
  mergedData?: any;
  /**
   * 冲突字段
   */
  conflictingFields: string[];
  /**
   * 自动解决的字段
   */
  autoResolvedFields: string[];
  /**
   * 需要手动解决的字段
   */
  manualResolutionRequired: string[];
  /**
   * 错误信息
   */
  error?: string;
}

/**
 * 数据一致性检查结果
 */
export interface ConsistencyCheckResult {
  /**
   * 是否一致
   */
  isConsistent: boolean;
  /**
   * 不一致的项目
   */
  inconsistencies: {
    /**
     * 数据类型
     */
    entityType: string;
    /**
     * 数据ID
     */
    entityId: string;
    /**
     * 不一致类型
     */
    inconsistencyType: string;
    /**
     * 描述
     */
    description: string;
    /**
     * 严重程度
     */
    severity: 'low' | 'medium' | 'high' | 'critical';
  }[];
  /**
   * 检查时间
   */
  checkedAt: Date;
  /**
   * 建议的修复操作
   */
  recommendedActions: string[];
}

/**
 * 离线优先架构核心接口
 */
export interface OfflineFirstArchitecture {
  /**
   * 本地数据存储
   */
  localStore: LocalDataStore<any>;

  /**
   * 同步管理器
   */
  syncManager: SyncManager;

  /**
   * 冲突解决器
   */
  conflictResolver: ConflictResolver;

  /**
   * 网络状态管理器
   */
  networkManager: NetworkManager;

  /**
   * 性能监控器
   */
  performanceMonitor: PerformanceMonitor;

  /**
   * 初始化架构
   */
  initialize(): Promise<void>;

  /**
   * 销毁架构
   */
  destroy(): Promise<void>;

  /**
   * 获取同步状态
   */
  getSyncStatus(): Promise<SyncStatistics>;

  /**
   * 执行一致性检查
   */
  checkConsistency(): Promise<ConsistencyCheckResult>;
}

/**
 * 同步管理器接口
 */
export interface SyncManager {
  /**
   * 添加同步操作
   */
  addOperation(operation: Omit<SyncOperation, 'id' | 'createdAt'>): Promise<string>;

  /**
   * 取消同步操作
   */
  cancelOperation(operationId: string): Promise<boolean>;

  /**
   * 获取待处理操作
   */
  getPendingOperations(): Promise<SyncOperation[]>;

  /**
   * 执行同步
   */
  sync(): Promise<SyncStatistics>;

  /**
   * 强制同步
   */
  forceSync(): Promise<SyncStatistics>;

  /**
   * 暂停同步
   */
  pauseSync(): Promise<void>;

  /**
   * 恢复同步
   */
  resumeSync(): Promise<void>;

  /**
   * 清理已完成操作
   */
  cleanupCompleted(): Promise<void>;

  /**
   * 获取同步配置
   */
  getConfiguration(): SyncConfiguration;

  /**
   * 更新同步配置
   */
  updateConfiguration(config: Partial<SyncConfiguration>): Promise<void>;
}

/**
 * 冲突解决器接口
 */
export interface ConflictResolver {
  /**
   * 检测冲突
   */
  detectConflicts(localData: any, remoteData: any): Promise<ConflictInfo[]>;

  /**
   * 解决冲突
   */
  resolveConflict(conflict: ConflictInfo): Promise<ResolutionResult>;

  /**
   * 批量解决冲突
   */
  resolveConflicts(conflicts: ConflictInfo[]): Promise<ResolutionResult[]>;

  /**
   * 获取所有冲突
   */
  getConflicts(): Promise<ConflictInfo[]>;

  /**
   * 注册解决策略
   */
  registerStrategy(strategy: ConflictResolutionStrategy): void;

  /**
   * 智能合并数据
   */
  smartMerge(localData: any, remoteData: any): Promise<MergeResult>;
}

/**
 * 网络状态管理器接口
 */
export interface NetworkManager {
  /**
   * 获取网络状态
   */
  getNetworkStatus(): Promise<NetworkStatus>;

  /**
   * 监听网络状态变化
   */
  onNetworkChange(callback: (status: NetworkStatus) => void): () => void;

  /**
   * 测试网络质量
   */
  testNetworkQuality(): Promise<{
    latency: number;
    bandwidth: number;
    packetLoss: number;
  }>;

  /**
   * 是否支持后台同步
   */
  supportsBackgroundSync(): boolean;

  /**
   * 注册后台同步
   */
  registerBackgroundSync(): Promise<boolean>;
}

/**
 * 性能监控器接口
 */
export interface PerformanceMonitor {
  /**
   * 开始性能测量
   */
  startMeasure(operation: string): void;

  /**
   * 结束性能测量
   */
  endMeasure(operation: string): number;

  /**
   * 获取性能指标
   */
  getMetrics(): {
    operationTimes: Record<string, number>;
    memoryUsage: number;
    storageUsage: number;
    syncPerformance: {
      averageSyncTime: number;
      successRate: number;
      failureRate: number;
    };
  };

  /**
   * 监控性能阈值
   */
  monitorThresholds(thresholds: {
    maxMemoryUsage: number;
    maxSyncTime: number;
    minSuccessRate: number;
  }, callback: (metrics: any) => void): void;
}