/**
 * 离线操作相关类型定义
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
 * 离线操作接口
 */
export interface OfflineOperation {
  /**
   * 操作ID
   */
  id: string

  /**
   * 操作类型
   */
  type: 'create' | 'update' | 'delete' | 'sync'

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
 * 冲突信息接口
 */
export interface ConflictInfo {
  /**
   * 冲突ID
   */
  id: string

  /**
   * 冲突类型
   */
  type: ConflictType

  /**
   * 实体类型
   */
  entityType: string

  /**
   * 实体ID
   */
  entityId: string

  /**
   * 本地数据
   */
  localData: any

  /**
   * 远程数据
   */
  remoteData: any

  /**
   * 冲突字段
   */
  conflictingFields: string[]

  /**
   * 严重程度 (0-1)
   */
  severity?: number

  /**
   * 风险等级
   */
  riskLevel?: RiskLevel

  /**
   * 本地操作ID
   */
  localOperationId?: string

  /**
   * 远程操作ID
   */
  remoteOperationId?: string

  /**
   * 创建时间
   */
  createdAt: Date

  /**
   * 状态
   */
  status: 'pending' | 'resolved' | 'ignored'

  /**
   * 解决方案
   */
  resolution?: ResolutionType

  /**
   * 解决时间
   */
  resolvedAt?: Date

  /**
   * 冲突描述
   */
  description?: string
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
 * 冲突类型枚举
 */
export enum ConflictType {
  CONCURRENT_MODIFICATION = 'concurrent_modification',
  DATA_INCONSISTENCY = 'data_inconsistency',
  NETWORK_CONFLICT = 'network_conflict',
  VERSION_CONFLICT = 'version_conflict',
  STRUCTURE_CONFLICT = 'structure_conflict',
  SYNC_CONFLICT = 'sync_conflict'
}

/**
 * 解决类型枚举
 */
export enum ResolutionType {
  ACCEPT_LOCAL = 'accept_local',
  ACCEPT_REMOTE = 'accept_remote',
  MERGE = 'merge',
  CREATE_NEW = 'create_new',
  MANUAL = 'manual',
  MANUAL_INTERVENTION = 'manual_intervention',
  LOCAL_WINS = 'local_wins',
  REMOTE_WINS = 'remote_wins',
  AUTO_RESOLVE = 'auto_resolve'
}

/**
 * 冲突分析结果接口
 */
export interface ConflictAnalysis {
  /**
   * 严重程度 (0-1)
   */
  severity: number

  /**
   * 置信度 (0-1)
   */
  confidence: number

  /**
   * 复杂度 (1-5)
   */
  complexity: number

  /**
   * 风险等级
   */
  riskLevel: RiskLevel

  /**
   * 预计解决时间（毫秒）
   */
  estimatedResolutionTime: number

  /**
   * 主要原因
   */
  cause: string

  /**
   * 涉及的操作
   */
  involvedOperations: string[]

  /**
   * 受影响的数据
   */
  affectedData: {
    /**
     * 冲突字段
     */
    conflictingFields: string[]
    /**
     * 数据类型
     */
    dataType: string
  }

  /**
   * 建议的解决方案
   */
  suggestedResolution: {
    /**
     * 解决类型
     */
    type: ResolutionType
    /**
     * 解释
     */
    explanation: string
    /**
     * 成功概率 (0-1)
     */
    successProbability: number
    /**
     * 潜在风险
     */
    risks: string[]
  }
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
 * 同步操作接口
 */
export interface SyncOperation {
  /**
   * 操作ID
   */
  id: string

  /**
   * 操作类型
   */
  type: 'upload' | 'download' | 'bidirectional'

  /**
   * 数据表
   */
  table: string

  /**
   * 记录ID
   */
  recordId: string

  /**
   * 操作数据
   */
  data: any

  /**
   * 时间戳
   */
  timestamp: Date

  /**
   * 状态
   */
  status: 'pending' | 'in_progress' | 'completed' | 'failed'

  /**
   * 进度（0-100）
   */
  progress: number

  /**
   * 错误信息
   */
  error?: string
}