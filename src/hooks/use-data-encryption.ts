import { useState, useEffect, useCallback, useRef } from 'react'
import { DataEncryptionService, EncryptionConfig, KeyManagementStrategy, EncryptionResult, DecryptionResult } from '@/services/security/data-encryption-service'
import { EncryptionAlgorithm, SecurityLevel } from '@/types/security'

/**
 * 数据加密Hook
 * 提供React组件对数据加密功能的访问
 */
export function useDataEncryption(
  config?: Partial<EncryptionConfig>,
  keyStrategy?: Partial<KeyManagementStrategy>
) {
  const [service, setService] = useState<DataEncryptionService | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const serviceRef = useRef<DataEncryptionService | null>(null)

  // 初始化服务
  useEffect(() => {
    const initializeService = async () => {
      if (isInitializing || serviceRef.current) {
        return
      }

      setIsInitializing(true)
      setError(null)

      try {
        const encryptionService = new DataEncryptionService(config, keyStrategy)
        await encryptionService.initialize()

        serviceRef.current = encryptionService
        setService(encryptionService)
        setIsInitialized(true)

        // 获取初始统计信息
        const initialStats = encryptionService.getStats()
        setStats(initialStats)

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '初始化失败'
        setError(errorMessage)
        console.error('DataEncryptionService 初始化失败:', err)
      } finally {
        setIsInitializing(false)
      }
    }

    initializeService()

    return () => {
      // 清理
      if (serviceRef.current) {
        serviceRef.current.destroy().catch(err => {
          console.error('DataEncryptionService 销毁失败:', err)
        })
      }
    }
  }, [config, keyStrategy])

  // 加密数据
  const encryptData = useCallback(async (
    data: string | Uint8Array,
    keyId?: string,
    algorithm?: EncryptionAlgorithm
  ): Promise<EncryptionResult> => {
    if (!service) {
      throw new Error('DataEncryptionService 未初始化')
    }

    try {
      const dataBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
      const result = await service.encrypt(dataBytes, keyId, algorithm)

      // 更新统计信息
      const currentStats = service.getStats()
      setStats(currentStats)

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加密失败'
      setError(errorMessage)
      throw err
    }
  }, [service])

  // 解密数据
  const decryptData = useCallback(async (
    encryptedResult: EncryptionResult
  ): Promise<DecryptionResult> => {
    if (!service) {
      throw new Error('DataEncryptionService 未初始化')
    }

    try {
      const result = await service.decrypt(encryptedResult)

      // 更新统计信息
      const currentStats = service.getStats()
      setStats(currentStats)

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '解密失败'
      setError(errorMessage)
      throw err
    }
  }, [service])

  // 生成新密钥
  const generateKey = useCallback(async (purpose?: string) => {
    if (!service) {
      throw new Error('DataEncryptionService 未初始化')
    }

    try {
      const key = await service.generateKey(purpose)

      // 更新统计信息
      const currentStats = service.getStats()
      setStats(currentStats)

      return key
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '生成密钥失败'
      setError(errorMessage)
      throw err
    }
  }, [service])

  // 获取审计日志
  const getAuditLog = useCallback((limit?: number) => {
    if (!service) {
      return []
    }

    try {
      return service.getAuditLog(limit)
    } catch (err) {
      console.error('获取审计日志失败:', err)
      return []
    }
  }, [service])

  // 生成合规报告
  const generateComplianceReport = useCallback(async (period?: { start: Date; end: Date }) => {
    if (!service) {
      throw new Error('DataEncryptionService 未初始化')
    }

    try {
      return await service.generateComplianceReport(period)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '生成报告失败'
      setError(errorMessage)
      throw err
    }
  }, [service])

  // 刷新统计信息
  const refreshStats = useCallback(() => {
    if (!service) {
      return
    }

    try {
      const currentStats = service.getStats()
      setStats(currentStats)
    } catch (err) {
      console.error('刷新统计信息失败:', err)
    }
  }, [service])

  // 重新初始化
  const reinitialize = useCallback(async () => {
    if (serviceRef.current) {
      try {
        await serviceRef.current.destroy()
      } catch (err) {
        console.error('销毁旧服务失败:', err)
      }
    }

    serviceRef.current = null
    setService(null)
    setIsInitialized(false)
    setError(null)

    // 重新初始化
    const encryptionService = new DataEncryptionService(config, keyStrategy)

    try {
      await encryptionService.initialize()
      serviceRef.current = encryptionService
      setService(encryptionService)
      setIsInitialized(true)

      const initialStats = encryptionService.getStats()
      setStats(initialStats)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '重新初始化失败'
      setError(errorMessage)
    }
  }, [config, keyStrategy])

  // 清除错误
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    service,
    isInitialized,
    isInitializing,
    stats,
    error,
    encryptData,
    decryptData,
    generateKey,
    getAuditLog,
    generateComplianceReport,
    refreshStats,
    reinitialize,
    clearError
  }
}

/**
 * 加密状态Hook
 * 提供对加密服务状态的便捷访问
 */
export function useEncryptionStatus(
  service: DataEncryptionService | null,
  updateInterval: number = 5000
) {
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!service) {
      setStats(null)
      return
    }

    const updateStats = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const currentStats = service.getStats()
        setStats(currentStats)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '获取统计信息失败'
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    // 立即更新一次
    updateStats()

    // 设置定时更新
    const interval = setInterval(updateStats, updateInterval)

    return () => {
      clearInterval(interval)
    }
  }, [service, updateInterval])

  // 计算安全指标
  const securityMetrics = useMemo(() => {
    if (!stats) return null

    const successRate = stats.totalEncryptions > 0
      ? (stats.totalEncryptions - stats.failedEncryptions) / stats.totalEncryptions
      : 0

    const cacheHitRate = stats.cacheHits + stats.cacheMisses > 0
      ? stats.cacheHits / (stats.cacheHits + stats.cacheMisses)
      : 0

    return {
      successRate: Math.round(successRate * 100),
      cacheHitRate: Math.round(cacheHitRate * 100),
      averageEncryptionTime: Math.round(stats.averageEncryptionTime),
      averageDecryptionTime: Math.round(stats.averageDecryptionTime),
      totalOperations: stats.totalEncryptions + stats.totalDecryptions,
      failureRate: Math.round(((stats.failedEncryptions + stats.failedDecryptions) / (stats.totalEncryptions + stats.totalDecryptions)) * 100)
    }
  }, [stats])

  // 获取安全等级
  const getSecurityLevel = useCallback((): SecurityLevel => {
    if (!securityMetrics) return SecurityLevel.LOW

    if (securityMetrics.successRate >= 99 && securityMetrics.failureRate <= 1) {
      return SecurityLevel.HIGH
    } else if (securityMetrics.successRate >= 95 && securityMetrics.failureRate <= 5) {
      return SecurityLevel.MEDIUM
    } else {
      return SecurityLevel.LOW
    }
  }, [securityMetrics])

  // 获取状态颜色
  const getStatusColor = useCallback(() => {
    const level = getSecurityLevel()
    switch (level) {
      case SecurityLevel.HIGH:
        return 'text-green-600'
      case SecurityLevel.MEDIUM:
        return 'text-yellow-600'
      case SecurityLevel.LOW:
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }, [getSecurityLevel])

  return {
    stats,
    securityMetrics,
    securityLevel: getSecurityLevel(),
    statusColor: getStatusColor(),
    isLoading,
    error,
    refresh: () => {
      if (service) {
        try {
          const currentStats = service.getStats()
          setStats(currentStats)
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : '刷新统计信息失败'
          setError(errorMessage)
        }
      }
    },
    clearError: () => setError(null)
  }
}

/**
 * 安全审计Hook
 * 提供对安全审计功能的便捷访问
 */
export function useSecurityAudit(
  service: DataEncryptionService | null,
  limit: number = 100
) {
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!service) {
      setAuditLog([])
      return
    }

    const fetchAuditLog = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const log = service.getAuditLog(limit)
        setAuditLog(log)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '获取审计日志失败'
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAuditLog()
  }, [service, limit])

  // 获取安全事件统计
  const eventStats = useMemo(() => {
    if (auditLog.length === 0) return null

    const stats = {
      total: auditLog.length,
      success: 0,
      failure: 0,
      byType: {} as Record<string, number>,
      byRiskLevel: {} as Record<string, number>,
      recentEvents: auditLog.slice(-10).reverse()
    }

    for (const event of auditLog) {
      // 按结果统计
      if (event.result === 'success') {
        stats.success++
      } else {
        stats.failure++
      }

      // 按类型统计
      stats.byType[event.eventType] = (stats.byType[event.eventType] || 0) + 1

      // 按风险等级统计
      stats.byRiskLevel[event.riskLevel] = (stats.byRiskLevel[event.riskLevel] || 0) + 1
    }

    return stats
  }, [auditLog])

  // 获取高风险事件
  const highRiskEvents = useMemo(() => {
    return auditLog.filter(event => event.riskLevel === 'high' || event.riskLevel === 'critical')
  }, [auditLog])

  // 获取最近的安全事件
  const recentSecurityEvents = useMemo(() => {
    return auditLog
      .filter(event => event.eventType.includes('security') || event.severity === 'high' || event.severity === 'critical')
      .slice(-20)
      .reverse()
  }, [auditLog])

  return {
    auditLog,
    eventStats,
    highRiskEvents,
    recentSecurityEvents,
    isLoading,
    error,
    refresh: () => {
      if (service) {
        try {
          const log = service.getAuditLog(limit)
          setAuditLog(log)
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : '刷新审计日志失败'
          setError(errorMessage)
        }
      }
    },
    clearError: () => setError(null)
  }
}