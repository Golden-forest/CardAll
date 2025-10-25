/**
 * 错误处理类型定义
 * 统一所有错误处理相关的类型定义
 */

// 错误级别
export enum ErrorLevel {
  CRITICAL = 'critical',    // 系统级严重错误
  ERROR = 'error',         // 功能性错误
  WARNING = 'warning',     // 警告信息
  INFO = 'info'           // 信息提示
}

// 错误类别
export enum ErrorCategory {
  NETWORK = 'network',           // 网络相关错误
  PROTOCOL = 'protocol',         // 协议相关错误
  APPLICATION = 'application',   // 应用相关错误
  DATA = 'data',               // 数据相关错误
  SYSTEM = 'system'            // 系统相关错误
}

// 错误子类别
export enum ErrorSubCategory {
  // 网络错误
  CONNECTION_LOST = 'connection_lost',
  NETWORK_TIMEOUT = 'network_timeout',
  BANDWIDTH_LIMIT = 'bandwidth_limit',
  DNS_FAILURE = 'dns_failure',

  // 协议错误
  HTTP_ERROR = 'http_error',
  SSL_ERROR = 'ssl_error',
  AUTH_ERROR = 'auth_error',

  // 应用错误
  VALIDATION_ERROR = 'validation_error',
  BUSINESS_LOGIC_ERROR = 'business_logic_error',
  PERMISSION_ERROR = 'permission_error',

  // 数据错误
  DATA_CONFLICT = 'data_conflict',
  DATA_CORRUPTION = 'data_corruption',
  DATA_LOSS = 'data_loss',

  // 系统错误
  SYSTEM_OVERLOAD = 'system_overload',
  RESOURCE_EXHAUSTED = 'resource_exhausted',
  CONFIGURATION_ERROR = 'configuration_error'
}

// 错误严重程度（别名）
export type ErrorSeverity = ErrorLevel

// 恢复操作类型
export type RecoveryAction =
  | 'retry'
  | 'rollback'
  | 'fallback'
  | 'repair'
  | 'manual'
  | 'skip'

// 统一错误接口
export interface UnifiedError {
  // 基础信息
  id: string                    // 错误唯一标识
  code: string                  // 错误代码
  level: ErrorLevel            // 错误级别
  category: ErrorCategory      // 错误类别
  subCategory: ErrorSubCategory // 错误子类别

  // 错误详情
  message: string              // 错误消息
  details?: any               // 错误详情
  stack?: string              // 错误堆栈

  // 上下文信息
  timestamp: Date             // 发生时间
  operation?: string          // 相关操作
  entity?: string             // 相关实体
  userId?: string             // 用户ID

  // 恢复信息
  retryable: boolean          // 是否可重试
  retryCount?: number         // 已重试次数
  maxRetries?: number         // 最大重试次数
  recovery?: RecoveryAction   // 恢复操作

  // 关联信息
  cause?: UnifiedError        // 原始错误
  relatedErrors?: UnifiedError[] // 关联错误
}

// 错误处理上下文
export interface ErrorContext {
  request?: any               // 相关请求
  response?: any              // 相关响应
  userId?: string             // 用户ID
  sessionId?: string          // 会话ID
  environment: 'development' | 'staging' | 'production'
  deviceInfo?: any            // 设备信息
  networkState?: any          // 网络状态
}

// 错误处理结果
export interface ErrorHandlingResult {
  handled: boolean            // 是否已处理
  error?: UnifiedError        // 处理后的错误
  action?: RecoveryAction     // 执行的恢复操作
  resolution?: string         // 解决方案描述
  metrics?: {                // 处理指标
    handlingTime: number      // 处理时间
    attempts: number          // 尝试次数
    memoryUsage: number       // 内存使用
  }
}

// 错误处理器接口
export interface ErrorHandler {
  canHandle(error: any): boolean
  handle(error: any, context: ErrorContext): Promise<ErrorHandlingResult>
  priority: number           // 处理优先级
}

// 监控指标接口
export interface MonitoringMetrics {
  // 基础指标
  totalErrors: number                    // 总错误数
  errorRate: number                     // 错误率
  uniqueErrors: number                  // 唯一错误数

  // 分类指标
  errorByCategory: Record<ErrorCategory, number>
  errorByLevel: Record<ErrorLevel, number>
  errorByCode: Record<string, number>

  // 趋势指标
  errorTrend: Array<{
    timestamp: Date
    count: number
    rate: number
  }>

  // 恢复指标
  recoveryRate: number                 // 恢复率
  averageRecoveryTime: number          // 平均恢复时间
  retrySuccessRate: number             // 重试成功率

  // 影响指标
  affectedUsers: number                // 受影响用户数
  affectedOperations: number           // 受影响操作数
}

// 告警规则接口
export interface AlertRule {
  id: string
  name: string
  description: string
  condition: AlertCondition
  threshold: number
  duration: number          // 持续时间（毫秒）
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  channels: AlertChannel[]  // 通知渠道
  actions: AlertAction[]    // 告警动作
  cooldown: number         // 冷却时间（毫秒）
}

// 告警条件接口
export interface AlertCondition {
  metric: string           // 监控指标
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  value: number
  aggregation: 'count' | 'sum' | 'avg' | 'rate'  // 聚合方式
  window: number          // 时间窗口
}

// 告警严重程度
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

// 告警通道接口
export interface AlertChannel {
  type: 'console' | 'notification' | 'email' | 'webhook'
  config: any
}

// 告警动作接口
export interface AlertAction {
  type: 'log' | 'notify' | 'email' | 'webhook' | 'restart' | 'scale'
  config: any
}

// 恢复策略接口
export interface RecoveryStrategy {
  id: string
  name: string
  description: string
  canHandle: (error: UnifiedError) => boolean
  execute: (error: UnifiedError, context: ErrorContext) => Promise<RecoveryResult>
  priority: number
  maxAttempts: number
  cooldownPeriod: number
  dependencies?: string[]
}

// 恢复结果
export interface RecoveryResult {
  success: boolean
  strategy: string
  duration: number
  attempts: number
  message: string
  details?: any
  nextAction?: 'continue' | 'retry' | 'fallback' | 'escalate'
  fallbackStrategy?: string
}

// 重试配置
export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  jitter: boolean
  retryableErrors: string[]
  circuitBreakerThreshold: number
  recoveryTimeout: number
}

// 自愈规则
export interface HealingRule {
  id: string
  name: string
  description: string
  pattern: ErrorPattern
  conditions: HealingCondition[]
  actions: HealingAction[]
  priority: number
  confidence: number
  maxApplications: number
  cooldownPeriod: number
  successRate: number
  lastApplied?: number
  applicationCount: number
}

// 错误模式
export interface ErrorPattern {
  category: ErrorCategory
  severity: ErrorSeverity
  errorCode?: string
  messagePattern?: string
  stackPattern?: string
  contextPattern?: any
  timePattern?: TimePattern
  frequencyPattern?: FrequencyPattern
}

// 时间模式
export interface TimePattern {
  timeRange?: [number, number] // 时间范围
  dayOfWeek?: number[]         // 星期几
  recency?: number             // 最近时间
}

// 频率模式
export interface FrequencyPattern {
  count: number
  window: number
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
}

// 自愈条件
export interface HealingCondition {
  type: 'error_count' | 'error_rate' | 'system_load' | 'network_status'
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  value: number
  window?: number
}

// 自愈动作
export interface HealingAction {
  type: 'retry' | 'rollback' | 'repair' | 'reconfigure' | 'restart' | 'scale'
  params: any
  timeout: number
  rollback?: any
}

// 健康检查状态
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

// 健康检查结果
export interface HealthCheckResult {
  status: HealthStatus
  score: number
  timestamp: Date
  checks: HealthCheckItem[]
  summary: string
  recommendations?: string[]
}

// 健康检查项
export interface HealthCheckItem {
  name: string
  status: HealthStatus
  score: number
  message: string
  details?: any
  timestamp: Date
}

// 错误日志接口
export interface ErrorLog {
  id: string
  timestamp: Date
  level: ErrorLevel
  category: ErrorCategory
  code: string
  message: string
  stack?: string
  details?: any
  userId?: string
  sessionId?: string
  operation?: string
  entityId?: string
  environment: 'development' | 'staging' | 'production'
  deviceInfo?: any
  networkInfo?: any
  handled?: boolean
  recoveryAction?: RecoveryAction
  resolution?: string
  resolutionTime?: Date
}