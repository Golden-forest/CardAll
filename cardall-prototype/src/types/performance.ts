/**
 * 性能监控相关类型定义
 */

/**
 * 性能指标类型
 */
export enum MetricType {
  MEMORY = 'memory',
  CPU = 'cpu',
  NETWORK = 'network',
  RENDERING = 'rendering',
  STORAGE = 'storage',
  USER_INTERACTION = 'userInteraction',
  SYNC = 'sync',
  CONFLICT_RESOLUTION = 'conflictResolution'
}

/**
 * 性能指标接口
 */
export interface PerformanceMetric {
  /**
   * 指标类型
   */
  type: MetricType

  /**
   * 指标值
   */
  value: number

  /**
   * 指标单位
   */
  unit: string

  /**
   * 时间戳
   */
  timestamp: Date

  /**
   * 附加信息
   */
  metadata?: Record<string, any>
}

/**
 * 警告阈值接口
 */
export interface AlertThreshold {
  /**
   * 警告级别
   */
  warning: number

  /**
   * 关键级别
   */
  critical: number

  /**
   * 最小值
   */
  min?: number

  /**
   * 最大值
   */
  max?: number
}

/**
 * 警告规则接口
 */
export interface AlertRule {
  /**
   * 规则名称
   */
  name: string

  /**
   * 指标类型
   */
  metricType: MetricType

  /**
   * 条件
   */
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals'

  /**
   * 阈值
   */
  threshold: number

  /**
   * 严重程度
   */
  severity: 'info' | 'warning' | 'critical'

  /**
   * 持续时间（毫秒）
   */
  duration?: number

  /**
   * 是否启用
   */
  enabled: boolean
}

/**
 * 性能警告接口
 */
export interface PerformanceAlert {
  /**
   * 警告ID
   */
  id: string

  /**
   * 警告类型
   */
  type: MetricType

  /**
   * 严重程度
   */
  severity: 'info' | 'warning' | 'critical'

  /**
   * 消息
   */
  message: string

  /**
   * 时间戳
   */
  timestamp: Date

  /**
   * 当前值
   */
  currentValue: number

  /**
   * 阈值
   */
  threshold: number

  /**
   * 建议
   */
  recommendation?: string

  /**
   * 是否已解决
   */
  resolved: boolean
}