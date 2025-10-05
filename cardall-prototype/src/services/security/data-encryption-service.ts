import { EncryptionAlgorithm, KeyDerivationAlgorithm, SecurityLevel } from '@/types/security'

/**
 * 加密配置接口
 */
export   /**
   * 性能配置
   */
  performance: {
    /**
     * 启用批量加密
     */
    batchEncryption: boolean

    /**
     * 批量大小
     */
    batchSize: number

    /**
     * 启用并行加密
     */
    parallelEncryption: boolean

    /**
     * 并行度
     */
    parallelism: number

    /**
     * 启用缓存
     */
    enableCache: boolean

    /**
     * 缓存大小
     */
    cacheSize: number
  }

  /**
   * 调试配置
   */
  debug: {
    /**
     * 调试模式
     */
    enabled: boolean

    /**
     * 日志级别
     */
    logLevel: 'error' | 'warn' | 'info' | 'debug'

    /**
     * 性能分析
     */
    profiling: boolean
  }
}

/**
 * 加密密钥接口
 */
export /**
 * 密钥用途
 */
export enum KeyUsage {
  /**
   * 数据加密
   */
  _ENCRYPTION = 'encryption',

  /**
   * 数据解密
   */
  _DECRYPTION = 'decryption',

  /**
   * 签名
   */
  _SIGNING = 'signing',

  /**
   * 验证
   */
  _VERIFICATION = 'verification',

  /**
   * 密钥派生
   */
  _KEY_DERIVATION = 'key-derivation'
}

/**
 * 加密结果接口
 */
export /**
 * 解密结果接口
 */
export   /**
   * 元数据
   */
  metadata: Record<string, any>
}

/**
 * 密钥管理策略接口
 */
export   /**
   * 密钥存储策略
   */
  storage: {
    /**
     * 存储位置
     */
    location: 'memory' | 'secure-storage' | 'hardware'

    /**
     * 是否加密存储
     */
    encryptedStorage: boolean

    /**
     * 备份策略
     */
    backup: {
      /**
       * 启用备份
       */
      enabled: boolean

      /**
       * 备份位置
       */
      location: string

      /**
       * 备份间隔（小时）
       */
      interval: number

      /**
       * 保留数量
       */
      retention: number
    }
  }

  /**
   * 密钥轮换策略
   */
  rotation: {
    /**
     * 启用轮换
     */
    enabled: boolean

    /**
     * 轮换间隔（天）
     */
    interval: number

    /**
     * 提前通知（天）
     */
    advanceNotice: number

    /**
     * 是否保留旧密钥
     */
    keepOldKeys: boolean

    /**
     * 保留期限（天）
     */
    retentionPeriod: number
  }
}

/**
 * 安全审计事件接口
 */
export /**
 * 审计事件类型
 */
export enum AuditEventType {
  /**
   * 密钥创建
   */
  _KEY_CREATED = 'key-created',

  /**
   * 密钥使用
   */
  _KEY_USED = 'key-used',

  /**
   * 密钥轮换
   */
  _KEY_ROTATED = 'key-rotated',

  /**
   * 数据加密
   */
  _DATA_ENCRYPTED = 'data-encrypted',

  /**
   * 数据解密
   */
  _DATA_DECRYPTED = 'data-decrypted',

  /**
   * 安全策略变更
   */
  _POLICY_CHANGED = 'policy-changed',

  /**
   * 访问尝试
   */
  _ACCESS_ATTEMPT = 'access-attempt',

  /**
   * 安全违规
   */
  _SECURITY_VIOLATION = 'security-violation'
}

/**
 * 风险等级
 */
export enum RiskLevel {
  /**
   * 低风险
   */
  _LOW = 'low',

  /**
   * 中风险
   */
  _MEDIUM = 'medium',

  /**
   * 高风险
   */
  _HIGH = 'high',

  /**
   * 严重风险
   */
  _CRITICAL = 'critical'
}

/**
 * 安全合规报告接口
 */
export   /**
   * 合规状态
   */
  complianceStatus: {
    /**
     * 是否合规
     */
    isCompliant: boolean

    /**
     * 合规得分
     */
    score: number

    /**
     * 违规数量
     */
    violations: number

    /**
     * 建议改进
     */
    recommendations: string[]
  }

  /**
   * 安全统计
   */
  securityStats: {
    /**
     * 加密操作数
     */
    encryptionOperations: number

    /**
     * 解密操作数
     */
    decryptionOperations: number

    /**
     * 密钥使用数
     */
    keyUsageCount: number

    /**
     * 安全事件数
     */
    securityEvents: number

    /**
     * 平均加密时间
     */
    averageEncryptionTime: number

    /**
     * 成功率
     */
    successRate: number
  }

  /**
   * 详细结果
   */
  details: {
    /**
     * 加密算法使用情况
     */
    algorithmUsage: Record<EncryptionAlgorithm, number>

    /**
     * 安全事件分布
     */
    eventDistribution: Record<AuditEventType, number>

    /**
     * 风险等级分布
     */
    riskDistribution: Record<RiskLevel, number>

    /**
     * 用户活动统计
     */
    userActivity: Record<string, number>
  }
}

/**
 * 数据加密服务
 * 提供端到端数据加密、密钥管理和安全审计功能
 */
export class DataEncryptionService {
  private config: EncryptionConfig
  private keys: Map<string, EncryptionKey> = new Map()
  private activeKeyId: string | null = null
  private auditLog: SecurityAuditEvent[] = []
  private encryptionCache = new Map<string, EncryptionResult>()
  private keyManagementStrategy: KeyManagementStrategy

  /**
   * 统计信息
   */
  private stats = {
    totalEncryptions: 0,
    totalDecryptions: 0,
    failedEncryptions: 0,
    failedDecryptions: 0,
    averageEncryptionTime: 0,
    averageDecryptionTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    securityEvents: 0
  }

  /**
   * 构造函数
   */
  constructor(config?: Partial<EncryptionConfig>, keyStrategy?: Partial<KeyManagementStrategy>) {
    this.config = this.mergeConfig(config)
    this.keyManagementStrategy = this.mergeKeyStrategy(keyStrategy)
  }

  /**
   * 合并配置
   */
  private mergeConfig(config?: Partial<EncryptionConfig>): EncryptionConfig {
    const defaultConfig: EncryptionConfig = {
      defaultAlgorithm: EncryptionAlgorithm.AES_256_GCM,
      keyDerivation: KeyDerivationAlgorithm.PBKDF2,
      securityLevel: SecurityLevel.HIGH,
      keyRotationInterval: 30,
      encryptionStrength: 256,
      hardwareAcceleration: true,
      maxEncryptionTime: 5000,
      memorySecurity: {
        secureMemory: true,
        wipeDelay: 100,
        preventMemoryDump: true
      },
      performance: {
        batchEncryption: true,
        batchSize: 10,
        parallelEncryption: true,
        parallelism: 4,
        enableCache: true,
        cacheSize: 1000
      },
      debug: {
        enabled: false,
        logLevel: 'info',
        profiling: false
      }
    }

    return { ...defaultConfig, ...config }
  }

  /**
   * 合并密钥管理策略
   */
  private mergeKeyStrategy(strategy?: Partial<KeyManagementStrategy>): KeyManagementStrategy {
    const defaultStrategy: KeyManagementStrategy = {
      name: 'default',
      description: '默认密钥管理策略',
      keyGeneration: {
        algorithm: KeyDerivationAlgorithm.PBKDF2,
        iterations: 600000,
        memory: 0,
        parallelism: 1,
        saltLength: 32
      },
      storage: {
        location: 'memory',
        encryptedStorage: true,
        backup: {
          enabled: false,
          location: '',
          interval: 24,
          retention: 7
        }
      },
      rotation: {
        enabled: true,
        interval: 30,
        advanceNotice: 7,
        keepOldKeys: true,
        retentionPeriod: 90
      }
    }

    return { ...defaultStrategy, ...strategy }
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    try {
      // 生成初始密钥
      if (this.keys.size === 0) {
        const initialKey = await this.generateKey()
        this.keys.set(initialKey.keyId, initialKey)
        this.activeKeyId = initialKey.keyId
      }

      // 检查密钥轮换
      await this.checkKeyRotation()

      // 记录审计事件
      this.logAuditEvent({
        eventType: AuditEventType.POLICY_CHANGED,
        operation: 'initialize',
        result: 'success',
        riskLevel: RiskLevel.LOW,
        severity: 'low',
        details: { message: 'DataEncryptionService 初始化完成' }
      })

      this.log('info', 'DataEncryptionService 初始化完成')

    } catch (error) {
          console.warn("操作失败:", error)
        }
      throw error
    }
  }

  /**
   * 生成密钥
   */
  async generateKey(purpose?: string): Promise<EncryptionKey> {
    const startTime = Date.now()

    try {
      // 生成密钥数据
      const keyData = await this.generateKeyData()

      const key: EncryptionKey = {
        keyId: crypto.randomUUID(),
        keyData,
        algorithm: this.config.defaultAlgorithm,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.config.keyRotationInterval * 24 * 60 * 60 * 1000),
        isActive: true,
        usage: [KeyUsage.ENCRYPTION, KeyUsage.DECRYPTION],
        metadata: {
          purpose,
          generationTime: Date.now(),
          source: 'generated'
        }
      }

      this.keys.set(key.keyId, key)

      // 记录审计事件
      this.logAuditEvent({
        eventType: AuditEventType.KEY_CREATED,
        operation: 'generate-key',
        result: 'success',
        riskLevel: RiskLevel.LOW,
        severity: 'low',
        details: { keyId: key.keyId, algorithm: key.algorithm, purpose }
      })

      const generationTime = Date.now() - startTime
      this.log('debug', '密钥生成完成', { keyId: key.keyId, generationTime })

      return key

    } catch (error) {
          console.warn("操作失败:", error)
        }
      throw error
    }
  }

  /**
   * 生成密钥数据
   */
  private async generateKeyData(): Promise<Uint8Array> {
    const keyLength = this.config.encryptionStrength / 8

    switch (this.config.keyDerivation) {
      case KeyDerivationAlgorithm.PBKDF2:
        return this.generateKeyWithPBKDF2(keyLength)

      case KeyDerivationAlgorithm.ARGON2:
        return this.generateKeyWithArgon2(keyLength)

      case KeyDerivationAlgorithm.SCRYPT:
        return this.generateKeyWithScrypt(keyLength)

      default:
        throw new Error(`不支持的密钥派生算法: ${this.config.keyDerivation}`)
    }
  }

  /**
   * 使用PBKDF2生成密钥
   */
  private async generateKeyWithPBKDF2(_keyLength: number): Promise<Uint8Array> {
    const config = this.keyManagementStrategy.keyGeneration

    // 生成随机盐值
    const salt = crypto.getRandomValues(new Uint8Array(config.saltLength))

    // 生成随机密码
    const password = crypto.getRandomValues(new Uint8Array(32))

    // 导入密码
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      password,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    )

    // 派生密钥
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: config.iterations,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: this.config.encryptionStrength },
      true,
      ['encrypt', 'decrypt']
    )

    // 导出密钥
    const exportedKey = await crypto.subtle.exportKey('raw', derivedKey)
    return new Uint8Array(exportedKey)
  }

  /**
   * 使用Argon2生成密钥
   */
  private async generateKeyWithArgon2(keyLength: number): Promise<Uint8Array> {
    // 注意：浏览器原生不支持Argon2,需要第三方库
    // 这里提供一个简化的实现
    const password = crypto.getRandomValues(new Uint8Array(32))
    const salt = crypto.getRandomValues(new Uint8Array(16))

    // 模拟Argon2密钥派生（实际应使用专业库）
    const derivedKey = await crypto.subtle.digest('SHA-256', new Uint8Array([...password, ...salt]))
    return new Uint8Array(derivedKey).slice(0, keyLength)
  }

  /**
   * 使用Scrypt生成密钥
   */
  private async generateKeyWithScrypt(keyLength: number): Promise<Uint8Array> {
    // 注意：浏览器原生不支持Scrypt,需要第三方库
    // 这里提供一个简化的实现
    const password = crypto.getRandomValues(new Uint8Array(32))
    const salt = crypto.getRandomValues(new Uint8Array(16))

    // 模拟Scrypt密钥派生（实际应使用专业库）
    const derivedKey = await crypto.subtle.digest('SHA-256', new Uint8Array([...password, ...salt]))
    return new Uint8Array(derivedKey).slice(0, keyLength)
  }

  /**
   * 加密数据
   */
  async encrypt(
    data: Uint8Array,
    keyId?: string,
    algorithm?: EncryptionAlgorithm
  ): Promise<EncryptionResult> {
    const startTime = Date.now()

    try {
      // 检查缓存
      if (this.config.performance.enableCache) {
        const cacheKey = this.generateCacheKey(data, keyId, algorithm)
        const cached = this.encryptionCache.get(cacheKey)
        if (cached) {
          this.stats.cacheHits++
          return cached
        }
        this.stats.cacheMisses++
      }

      // 获取密钥
      const key = this.getKey(keyId)
      if (!key) {
        throw new Error('指定的密钥不存在')
      }

      // 获取加密算法
      const encAlgorithm = algorithm || this.config.defaultAlgorithm

      // 执行加密
      const result = await this.performEncryption(data, key, encAlgorithm)

      // 缓存结果
      if (this.config.performance.enableCache) {
        const cacheKey = this.generateCacheKey(data, keyId, algorithm)
        this.encryptionCache.set(cacheKey, result)

        // 清理缓存
        if (this.encryptionCache.size > this.config.performance.cacheSize) {
          this.cleanupCache()
        }
      }

      // 更新统计
      this.stats.totalEncryptions++
      this.updateAverageEncryptionTime(Date.now() - startTime)

      // 记录审计事件
      this.logAuditEvent({
        eventType: AuditEventType.DATA_ENCRYPTED,
        operation: 'encrypt',
        result: 'success',
        riskLevel: RiskLevel.LOW,
        severity: 'low',
        details: {
          keyId: result.keyId,
          algorithm: result.algorithm,
          dataSize: result.dataSize,
          encryptionTime: result.encryptionTime
        }
      })

      return result

    } catch (error) {
          console.warn("操作失败:", error)
        }

      this.logAuditEvent({
        eventType: AuditEventType.DATA_ENCRYPTED,
        operation: 'encrypt',
        result: 'failure',
        riskLevel: RiskLevel.MEDIUM,
        severity: 'high',
        details: { keyId, algorithm, error: error.message }
      })

      throw error
    }
  }

  /**
   * 执行加密操作
   */
  private async performEncryption(
    data: Uint8Array,
    key: EncryptionKey,
    algorithm: EncryptionAlgorithm
  ): Promise<EncryptionResult> {
    const startTime = Date.now()

    try {
      let encryptedData: Uint8Array
      let iv: Uint8Array

      switch (algorithm) {
        case EncryptionAlgorithm.AES_256_GCM:
          ({ encryptedData, iv } = await this.encryptWithAES_GCM(data, key.keyData))
          break

        case EncryptionAlgorithm.AES_256_CBC:
          ({ encryptedData, iv } = await this.encryptWithAES_CBC(data, key.keyData))
          break

        case EncryptionAlgorithm.CHACHA20_POLY1305:
          ({ encryptedData, iv } = await this.encryptWithChaCha20_Poly1305(data, key.keyData))
          break

        default:
          throw new Error(`不支持的加密算法: ${algorithm}`)
      }

      const encryptionTime = Date.now() - startTime
      const checksum = await this.calculateChecksum(data)

      const result: EncryptionResult = {
        encryptedData,
        iv,
        keyId: key.keyId,
        algorithm,
        encryptionTime,
        dataSize: data.length,
        checksum,
        metadata: {
          encryptedAt: new Date().toISOString(),
          keyVersion: 1,
          algorithmVersion: '1.0'
        }
      }

      return result

    } catch (error) {
          console.warn("操作失败:", error)
        }
      throw error
    }
  }

  /**
   * 使用AES-GCM加密
   */
  private async encryptWithAES_GCM(
    data: Uint8Array,
    keyData: Uint8Array
  ): Promise<{ encryptedData: Uint8Array; iv: Uint8Array }> {
    // 生成随机IV
    const iv = crypto.getRandomValues(new Uint8Array(12))

    // 导入密钥
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    )

    // 加密数据
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      data
    )

    return {
      encryptedData: new Uint8Array(encrypted),
      iv
    }
  }

  /**
   * 使用AES-CBC加密
   */
  private async encryptWithAES_CBC(
    data: Uint8Array,
    keyData: Uint8Array
  ): Promise<{ encryptedData: Uint8Array; iv: Uint8Array }> {
    // 生成随机IV
    const iv = crypto.getRandomValues(new Uint8Array(16))

    // 导入密钥
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-CBC' },
      false,
      ['encrypt']
    )

    // 加密数据
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-CBC',
        iv
      },
      key,
      data
    )

    return {
      encryptedData: new Uint8Array(encrypted),
      iv
    }
  }

  /**
   * 使用ChaCha20-Poly1305加密
   */
  private async encryptWithChaCha20_Poly1305(
    data: Uint8Array,
    keyData: Uint8Array
  ): Promise<{ encryptedData: Uint8Array; iv: Uint8Array }> {
    // 注意：浏览器可能不支持ChaCha20-Poly1305
    // 这里提供一个回退到AES-GCM的实现

    // 生成随机IV
    const iv = crypto.getRandomValues(new Uint8Array(12))

    // 导入密钥
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' }, // 回退到AES-GCM
      false,
      ['encrypt']
    )

    // 加密数据
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      data
    )

    return {
      encryptedData: new Uint8Array(encrypted),
      iv
    }
  }

  /**
   * 解密数据
   */
  async decrypt(encryptedResult: EncryptionResult): Promise<DecryptionResult> {
    const startTime = Date.now()

    try {
      // 获取密钥
      const key = this.getKey(encryptedResult.keyId)
      if (!key) {
        throw new Error('指定的密钥不存在')
      }

      // 执行解密
      const result = await this.performDecryption(encryptedResult, key)

      // 更新统计
      this.stats.totalDecryptions++
      this.updateAverageDecryptionTime(Date.now() - startTime)

      // 记录审计事件
      this.logAuditEvent({
        eventType: AuditEventType.DATA_DECRYPTED,
        operation: 'decrypt',
        result: 'success',
        riskLevel: RiskLevel.LOW,
        severity: 'low',
        details: {
          keyId: result.keyId,
          algorithm: result.algorithm,
          dataSize: result.decryptedData.length,
          decryptionTime: result.decryptionTime,
          verification: result.verification
        }
      })

      return result

    } catch (error) {
          console.warn("操作失败:", error)
        }

      this.logAuditEvent({
        eventType: AuditEventType.DATA_DECRYPTED,
        operation: 'decrypt',
        result: 'failure',
        riskLevel: RiskLevel.HIGH,
        severity: 'critical',
        details: {
          keyId: encryptedResult.keyId,
          algorithm: encryptedResult.algorithm,
          error: error.message
        }
      })

      throw error
    }
  }

  /**
   * 执行解密操作
   */
  private async performDecryption(
    encryptedResult: EncryptionResult,
    key: EncryptionKey
  ): Promise<DecryptionResult> {
    const startTime = Date.now()

    try {
      let decryptedData: Uint8Array

      switch (encryptedResult.algorithm) {
        case EncryptionAlgorithm.AES_256_GCM:
          decryptedData = await this.decryptWithAES_GCM(
            encryptedResult.encryptedData,
            key.keyData,
            encryptedResult.iv
          )
          break

        case EncryptionAlgorithm.AES_256_CBC:
          decryptedData = await this.decryptWithAES_CBC(
            encryptedResult.encryptedData,
            key.keyData,
            encryptedResult.iv
          )
          break

        case EncryptionAlgorithm.CHACHA20_POLY1305:
          decryptedData = await this.decryptWithChaCha20_Poly1305(
            encryptedResult.encryptedData,
            key.keyData,
            encryptedResult.iv
          )
          break

        default:
          throw new Error(`不支持的解密算法: ${encryptedResult.algorithm}`)
      }

      const decryptionTime = Date.now() - startTime

      // 验证数据完整性
      const checksum = await this.calculateChecksum(decryptedData)
      const checksumMatch = checksum === encryptedResult.checksum

      const result: DecryptionResult = {
        decryptedData,
        keyId: key.keyId,
        algorithm: encryptedResult.algorithm,
        decryptionTime,
        verification: {
          isValid: checksumMatch,
          checksumMatch,
          signatureValid: true // 暂时假设签名有效
        },
        metadata: {
          decryptedAt: new Date().toISOString(),
          originalEncryptionTime: encryptedResult.encryptionTime
        }
      }

      return result

    } catch (error) {
          console.warn("操作失败:", error)
        }
      throw error
    }
  }

  /**
   * 使用AES-GCM解密
   */
  private async decryptWithAES_GCM(
    encryptedData: Uint8Array,
    keyData: Uint8Array,
    iv: Uint8Array
  ): Promise<Uint8Array> {
    // 导入密钥
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )

    // 解密数据
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      encryptedData
    )

    return new Uint8Array(decrypted)
  }

  /**
   * 使用AES-CBC解密
   */
  private async decryptWithAES_CBC(
    encryptedData: Uint8Array,
    keyData: Uint8Array,
    iv: Uint8Array
  ): Promise<Uint8Array> {
    // 导入密钥
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    )

    // 解密数据
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-CBC',
        iv
      },
      key,
      encryptedData
    )

    return new Uint8Array(decrypted)
  }

  /**
   * 使用ChaCha20-Poly1305解密
   */
  private async decryptWithChaCha20_Poly1305(
    encryptedData: Uint8Array,
    keyData: Uint8Array,
    iv: Uint8Array
  ): Promise<Uint8Array> {
    // 回退到AES-GCM
    return this.decryptWithAES_GCM(encryptedData, keyData, iv)
  }

  /**
   * 计算校验和
   */
  private async calculateChecksum(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * 获取密钥
   */
  private getKey(keyId?: string): EncryptionKey | null {
    if (keyId) {
      return this.keys.get(keyId) || null
    }

    if (this.activeKeyId) {
      return this.keys.get(this.activeKeyId) || null
    }

    // 返回第一个激活的密钥
    for (const key of this.keys.values()) {
      if (key.isActive) {
        return key
      }
    }

    return null
  }

  /**
   * 检查密钥轮换
   */
  private async checkKeyRotation(): Promise<void> {
    if (!this.keyManagementStrategy.rotation.enabled) {
      return
    }

    const now = new Date()
    const keysToRotate: EncryptionKey[] = []

    // 查找需要轮换的密钥
    for (const key of this.keys.values()) {
      if (key.isActive && key.expiresAt <= now) {
        keysToRotate.push(key)
      }
    }

    // 轮换密钥
    for (const key of keysToRotate) {
      await this.rotateKey(key)
    }
  }

  /**
   * 轮换密钥
   */
  private async rotateKey(oldKey: EncryptionKey): Promise<void> {
    try {
      // 生成新密钥
      const newKey = await this.generateKey(`轮换密钥 ${oldKey.keyId}`)

      // 停用旧密钥
      oldKey.isActive = false

      // 设置新的活动密钥
      this.activeKeyId = newKey.keyId

      // 记录审计事件
      this.logAuditEvent({
        eventType: AuditEventType.KEY_ROTATED,
        operation: 'rotate-key',
        result: 'success',
        riskLevel: RiskLevel.LOW,
        severity: 'medium',
        details: {
          oldKeyId: oldKey.keyId,
          newKeyId: newKey.keyId
        }
      })

      this.log('info', '密钥轮换完成', { oldKeyId: oldKey.keyId, newKeyId: newKey.keyId })

    } catch (error) {
          console.warn("操作失败:", error)
        }
      throw error
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(
    data: Uint8Array,
    keyId?: string,
    algorithm?: EncryptionAlgorithm
  ): string {
    const dataHash = Array.from(data).reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), '')
    return `${dataHash}-${keyId || 'default'}-${algorithm || 'default'}`
  }

  /**
   * 清理缓存
   */
  private cleanupCache(): void {
    if (this.encryptionCache.size > this.config.performance.cacheSize) {
      const keysToDelete = Array.from(this.encryptionCache.keys()).slice(0, this.encryptionCache.size - this.config.performance.cacheSize)
      for (const key of keysToDelete) {
        this.encryptionCache.delete(key)
      }
    }
  }

  /**
   * 更新平均加密时间
   */
  private updateAverageEncryptionTime(newTime: number): void {
    this.stats.averageEncryptionTime = (
      this.stats.averageEncryptionTime * (this.stats.totalEncryptions - 1) + newTime
    ) / this.stats.totalEncryptions
  }

  /**
   * 更新平均解密时间
   */
  private updateAverageDecryptionTime(newTime: number): void {
    this.stats.averageDecryptionTime = (
      this.stats.averageDecryptionTime * (this.stats.totalDecryptions - 1) + newTime
    ) / this.stats.totalDecryptions
  }

  /**
   * 记录审计事件
   */
  private logAuditEvent(event: Omit<SecurityAuditEvent, 'eventId' | 'timestamp'>): void {
    const auditEvent: SecurityAuditEvent = {
      eventId: crypto.randomUUID(),
      timestamp: new Date(),
      ...event
    }

    this.auditLog.push(auditEvent)
    this.stats.securityEvents++

    // 限制日志大小
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000)
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): typeof this.stats {
    return { ...this.stats }
  }

  /**
   * 获取审计日志
   */
  getAuditLog(limit?: number): SecurityAuditEvent[] {
    const log = [...this.auditLog]
    return limit ? log.slice(-limit) : log
  }

  /**
   * 生成合规报告
   */
  async generateComplianceReport(period?: { start: Date; end: Date }): Promise<ComplianceReport> {
    const start = period?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = period?.end || new Date()

    const relevantEvents = this.auditLog.filter(event =>
      event.timestamp >= start && event.timestamp <= end
    )

    const algorithmUsage: Record<EncryptionAlgorithm, number> = {
      [EncryptionAlgorithm.AES_256_GCM]: 0,
      [EncryptionAlgorithm.AES_256_CBC]: 0,
      [EncryptionAlgorithm.CHACHA20_POLY1305]: 0
    }

    const eventDistribution: Record<AuditEventType, number> = {}
    const riskDistribution: Record<RiskLevel, number> = {}

    // 统计数据
    for (const event of relevantEvents) {
      if (event.details?.algorithm) {
        algorithmUsage[event.details.algorithm]++
      }

      eventDistribution[event.eventType] = (eventDistribution[event.eventType] || 0) + 1
      riskDistribution[event.riskLevel] = (riskDistribution[event.riskLevel] || 0) + 1
    }

    const successRate = this.stats.totalEncryptions > 0
      ? (this.stats.totalEncryptions - this.stats.failedEncryptions) / this.stats.totalEncryptions
      : 0

    const report: ComplianceReport = {
      reportId: crypto.randomUUID(),
      generatedAt: new Date(),
      period: { start, end },
      complianceStatus: {
        isCompliant: successRate > 0.95 && this.stats.securityEvents < 100,
        score: Math.round(successRate * 100),
        violations: this.stats.failedEncryptions + this.stats.failedDecryptions,
        recommendations: this.generateRecommendations()
      },
      securityStats: {
        encryptionOperations: this.stats.totalEncryptions,
        decryptionOperations: this.stats.totalDecryptions,
        keyUsageCount: this.keys.size,
        securityEvents: this.stats.securityEvents,
        averageEncryptionTime: this.stats.averageEncryptionTime,
        successRate
      },
      details: {
        algorithmUsage,
        eventDistribution,
        riskDistribution,
        userActivity: {}
      }
    }

    return report
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = []

    if (this.stats.failedEncryptions > 0) {
      recommendations.push('建议检查加密失败的原因,可能是密钥管理或算法兼容性问题')
    }

    if (this.stats.averageEncryptionTime > 1000) {
      recommendations.push('加密性能较低,建议启用硬件加速或优化加密算法')
    }

    if (this.config.performance.enableCache && this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) < 0.5) {
      recommendations.push('缓存命中率较低,建议调整缓存策略')
    }

    if (this.keys.size > 10) {
      recommendations.push('密钥数量较多,建议清理过期密钥')
    }

    return recommendations
  }

  /**
   * 安全地清除内存
   */
  private secureWipe(buffer: Uint8Array): void {
    if (this.config.memorySecurity.secureMemory) {
      // 使用随机数据覆盖内存
      crypto.getRandomValues(buffer)

      // 延迟清除
      setTimeout(() => {
        buffer.fill(0)
      }, this.config.memorySecurity.wipeDelay)
    }
  }

  /**
   * 记录日志
   */
  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, context?: any): void {
    if (!this.config.debug.enabled) {
      return
    }

    const levels = ['error', 'warn', 'info', 'debug']
    const currentLevelIndex = levels.indexOf(this.config.debug.logLevel)
    const messageLevelIndex = levels.indexOf(level)

    if (messageLevelIndex <= currentLevelIndex) {
      console.log(`[DataEncryptionService] [${level.toUpperCase()}] ${message}`, context)
    }
  }

  /**
   * 销毁服务
   */
  async destroy(): Promise<void> {
    try {
      // 安全清除所有密钥
      for (const key of this.keys.values()) {
        this.secureWipe(key.keyData)
      }

      // 清除缓存
      this.encryptionCache.clear()

      // 清除内存
      this.keys.clear()
      this.activeKeyId = null
      this.auditLog = []

      this.log('info', 'DataEncryptionService 已销毁')

    } catch (error) {
          console.warn("操作失败:", error)
        }
      throw error
    }
  }
}