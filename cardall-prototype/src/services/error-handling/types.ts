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
export // 错误处理上下文
export // 错误处理结果
export }

// 错误处理器接口
export // 监控指标接口
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
export // 告警条件接口
export // 告警严重程度
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

// 告警通道接口
export // 告警动作接口
export // 恢复策略接口
export // 恢复结果
export // 重试配置
export // 自愈规则
export // 错误模式
export // 时间模式
export // 频率模式
export // 自愈条件
export // 自愈动作
export // 健康检查状态
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

// 健康检查结果
export // 健康检查项
export // 错误日志接口
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