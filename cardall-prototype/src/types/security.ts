/**
 * 安全相关类型定义
 */

/**
 * 加密算法枚举
 */
export enum EncryptionAlgorithm {
  AES_128_GCM = 'AES-128-GCM',
  AES_256_GCM = 'AES-256-GCM',
  AES_256_CBC = 'AES-256-CBC',
  CHACHA20_POLY1305 = 'ChaCha20-Poly1305'
}

/**
 * 密钥派生算法枚举
 */
export enum KeyDerivationAlgorithm {
  PBKDF2 = 'PBKDF2',
  ARGON2 = 'Argon2',
  SCRYPT = 'scrypt'
}

/**
 * 安全级别枚举
 */
export enum SecurityLevel {
  BASIC = 'basic',
  STANDARD = 'standard',
  HIGH = 'high',
  MAXIMUM = 'maximum'
}

/**
 * 加密密钥接口
 */
export interface EncryptionKey {
  /**
   * 密钥ID
   */
  id: string

  /**
   * 密钥算法
   */
  algorithm: EncryptionAlgorithm

  /**
   * 密钥长度（位）
   */
  keyLength: number

  /**
   * 创建时间
   */
  createdAt: Date

  /**
   * 过期时间
   */
  expiresAt: Date

  /**
   * 是否已激活
   */
  isActive: boolean

  /**
   * 密钥用途
   */
  usage: string[]

  /**
   * 元数据
   */
  metadata?: Record<string, any>
}

/**
 * 安全审计事件接口
 */
export interface SecurityAuditEvent {
  /**
   * 事件ID
   */
  id: string

  /**
   * 事件类型
   */
  eventType: 'key_generation' | 'encryption' | 'decryption' | 'key_rotation' | 'access_attempt'

  /**
   * 时间戳
   */
  timestamp: Date

  /**
   * 用户ID
   */
  userId?: string

  /**
   * 资源ID
   */
  resourceId?: string

  /**
   * 操作结果
   */
  result: 'success' | 'failure'

  /**
   * 错误信息
   */
  error?: string

  /**
   * 附加信息
   */
  metadata?: Record<string, any>
}

/**
 * 合规报告接口
 */
export interface ComplianceReport {
  /**
   * 报告ID
   */
  id: string

  /**
   * 报告类型
   */
  reportType: 'gdpr' | 'hipaa' | 'soc2' | 'custom'

  /**
   * 生成时间
   */
  generatedAt: Date

  /**
   * 时间范围
   */
  timeRange: {
    start: Date
    end: Date
  }

  /**
   * 合规状态
   */
  complianceStatus: 'compliant' | 'non_compliant' | 'partial'

  /**
   * 发现的问题
   */
  issues: ComplianceIssue[]

  /**
   * 建议
   */
  recommendations: string[]
}

/**
 * 合规问题接口
 */
export interface ComplianceIssue {
  /**
   * 问题ID
   */
  id: string

  /**
   * 问题类型
   */
  type: string

  /**
   * 严重程度
   */
  severity: 'low' | 'medium' | 'high' | 'critical'

  /**
   * 描述
   */
  description: string

  /**
   * 影响范围
   */
  impact: string

  /**
   * 修复建议
   */
  remediation: string

  /**
   * 状态
   */
  status: 'open' | 'in_progress' | 'resolved'
}