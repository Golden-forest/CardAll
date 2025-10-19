/**
 * 本地存储架构类型定义
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
   * 数据哈希值（用于变更检测）
   */
  dataHash: string;
  /**
   * 创建时间
   */
  createdAt: Date;
  /**
   * 更新时间
   */
  updatedAt: Date;
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

  /**
   * 批量操作
   */
  bulkCreate(items: Omit<T, 'id'>[]): Promise<string[]>;

  /**
   * 批量更新
   */
  bulkUpdate(updates: { id: string; data: Partial<T> }[]): Promise<boolean[]>;

  /**
   * 批量删除
   */
  bulkDelete(ids: string[]): Promise<boolean[]>;

  /**
   * 清空数据
   */
  clear(): Promise<boolean>;
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
   * 最后更新时间
   */
  updatedAt: Date;
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
  };

  /**
   * 监控性能阈值
   */
  monitorThresholds(thresholds: {
    maxMemoryUsage: number;
    maxOperationTime: number;
  }, callback: (metrics: any) => void): void;
}

/**
 * 本地存储核心接口
 */
export interface LocalStorageArchitecture {
  /**
   * 本地数据存储
   */
  localStore: LocalDataStore<any>;

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
   * 获取存储状态
   */
  getStorageStatus(): Promise<{
    totalItems: number;
    storageSize: number;
    lastModified: Date;
  }>;
}