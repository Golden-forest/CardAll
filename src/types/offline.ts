/**
 * 本地操作相关类型定义
 */

/**
 * 操作优先级枚举
 */
export enum OperationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * 网络质量枚举
 */
export enum NetworkQuality {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  OFFLINE = 'offline'
}

/**
 * 网络质量评估接口
 */
export interface NetworkQualityAssessment {
  /**
   * 网络质量
   */
  quality: NetworkQuality

  /**
   * 延迟（毫秒）
   */
  latency: number

  /**
   * 带宽（Mbps）
   */
  bandwidth: number

  /**
   * 丢包率（%）
   */
  packetLoss: number

  /**
   * 抖动（毫秒）
   */
  jitter: number

  /**
   * 评估时间
   */
  assessedAt: Date
}

/**
 * 本地操作接口
 */
export interface LocalOperation {
  /**
   * 操作ID
   */
  id: string

  /**
   * 操作类型
   */
  type: 'create' | 'update' | 'delete'

  /**
   * 数据表
   */
  table: string

  /**
   * 操作数据
   */
  data: any

  /**
   * 时间戳
   */
  timestamp: Date

  /**
   * 是否已处理
   */
  processed: boolean

  /**
   * 处理时间
   */
  processedAt?: Date

  /**
   * 错误信息
   */
  error?: string

  /**
   * 重试次数
   */
  retryCount: number

  /**
   * 优先级
   */
  priority: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * 风险等级枚举
 */
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * 解决类型枚举
 */
export enum ResolutionType {
  ACCEPT_LOCAL = 'accept_local',
  MERGE = 'merge',
  CREATE_NEW = 'create_new',
  MANUAL = 'manual',
  AUTO_RESOLVE = 'auto_resolve'
}

/**
 * 解决结果接口
 */
export interface ResolutionResult {
  /**
   * 是否成功
   */
  success: boolean

  /**
   * 解决类型
   */
  resolutionType: ResolutionType

  /**
   * 解决时间
   */
  resolvedAt: Date

  /**
   * 解决数据
   */
  resolvedData?: any

  /**
   * 错误信息
   */
  error?: string

  /**
   * 解决描述
   */
  description?: string
}

/**
 * 本地存储统计信息
 */
export interface LocalStorageStats {
  /**
   * 总卡片数
   */
  totalCards: number

  /**
   * 总文件夹数
   */
  totalFolders: number

  /**
   * 总标签数
   */
  totalTags: number

  /**
   * 存储大小（字节）
   */
  storageSize: number

  /**
   * 最后更新时间
   */
  lastUpdated: Date

  /**
   * 数据完整性状态
   */
  integrityStatus: 'valid' | 'corrupted' | 'checking'
}

/**
 * 本地操作队列接口
 */
export interface LocalOperationQueue {
  /**
   * 添加操作
   */
  addOperation(operation: Omit<LocalOperation, 'id' | 'timestamp'>): Promise<string>

  /**
   * 获取待处理操作
   */
  getPendingOperations(): Promise<LocalOperation[]>

  /**
   * 标记操作为已完成
   */
  markOperationCompleted(operationId: string): Promise<boolean>

  /**
   * 清理已完成操作
   */
  cleanupCompleted(): Promise<void>

  /**
   * 获取队列状态
   */
  getQueueStatus(): Promise<{
    pending: number
    completed: number
    failed: number
  }>
}