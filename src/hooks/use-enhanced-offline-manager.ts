import { useState, useEffect, useCallback, useRef } from 'react'
import { EnhancedOfflineManager, EnhancedOfflineConfig, EnhancedOfflineStats, EnhancedOfflineOperation } from '@/services/offline/enhanced-offline-manager'
import { OfflineManager } from '@/services/offline-manager'
import { EnhancedCloudSync } from '@/services/sync/enhanced-cloud-sync'

/**
 * 增强离线管理器Hook
 * 提供React组件对增强离线功能的访问
 */
export function useEnhancedOfflineManager(
  offlineManager: OfflineManager,
  enhancedCloudSync: EnhancedCloudSync,
  config?: Partial<EnhancedOfflineConfig>
) {
  const [manager, setManager] = useState<EnhancedOfflineManager | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [stats, setStats] = useState<EnhancedOfflineStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const managerRef = useRef<EnhancedOfflineManager | null>(null)
  const statsUpdateTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 初始化管理器
  useEffect(() => {
    const initializeManager = async () => {
      if (isInitializing || managerRef.current) {
        return
      }

      setIsInitializing(true)
      setError(null)

      try {
        const enhancedManager = new EnhancedOfflineManager(
          offlineManager,
          enhancedCloudSync,
          config
        )

        await enhancedManager.initialize()

        managerRef.current = enhancedManager
        setManager(enhancedManager)
        setIsInitialized(true)

        // 开始统计更新
        startStatsUpdates(enhancedManager)

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '初始化失败'
        setError(errorMessage)
        console.error('EnhancedOfflineManager 初始化失败:', err)
      } finally {
        setIsInitializing(false)
      }
    }

    initializeManager()

    return () => {
      // 清理
      if (statsUpdateTimerRef.current) {
        clearInterval(statsUpdateTimerRef.current)
      }

      if (managerRef.current) {
        managerRef.current.destroy().catch(err => {
          console.error('EnhancedOfflineManager 销毁失败:', err)
        })
      }
    }
  }, [offlineManager, enhancedCloudSync, config])

  // 开始统计更新
  const startStatsUpdates = useCallback((manager: EnhancedOfflineManager) => {
    statsUpdateTimerRef.current = setInterval(() => {
      try {
        const currentStats = manager.getStats()
        setStats(currentStats)
      } catch (err) {
        console.error('获取统计信息失败:', err)
      }
    }, 1000) // 每秒更新一次
  }, [])

  // 添加操作
  const addOperation = useCallback(async (
    operation: Omit<EnhancedOfflineOperation, 'id' | 'version' | 'retryCount' | 'executionStats' | 'createdAt' | 'backoffStrategy'>
  ): Promise<string> => {
    if (!manager) {
      throw new Error('EnhancedOfflineManager 未初始化')
    }

    try {
      const operationId = await manager.addEnhancedOperation(operation)
      return operationId
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '添加操作失败'
      setError(errorMessage)
      throw err
    }
  }, [manager])

  // 获取统计信息
  const getStats = useCallback((): EnhancedOfflineStats | null => {
    if (!manager) {
      return null
    }

    try {
      return manager.getStats()
    } catch (err) {
      console.error('获取统计信息失败:', err)
      return null
    }
  }, [manager])

  // 重新初始化
  const reinitialize = useCallback(async () => {
    if (managerRef.current) {
      try {
        await managerRef.current.destroy()
      } catch (err) {
        console.error('销毁旧管理器失败:', err)
      }
    }

    managerRef.current = null
    setManager(null)
    setIsInitialized(false)
    setError(null)

    // 重新初始化
    if (offlineManager && enhancedCloudSync) {
      const enhancedManager = new EnhancedOfflineManager(
        offlineManager,
        enhancedCloudSync,
        config
      )

      try {
        await enhancedManager.initialize()
        managerRef.current = enhancedManager
        setManager(enhancedManager)
        setIsInitialized(true)

        // 重新开始统计更新
        startStatsUpdates(enhancedManager)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '重新初始化失败'
        setError(errorMessage)
      }
    }
  }, [offlineManager, enhancedCloudSync, config, startStatsUpdates])

  // 清除错误
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    manager,
    isInitialized,
    isInitializing,
    stats,
    error,
    addOperation,
    getStats,
    reinitialize,
    clearError
  }
}

/**
 * 增强离线操作Hook
 * 提供对特定操作的便捷访问
 */
export function useEnhancedOfflineOperation(
  manager: EnhancedOfflineManager | null,
  operationId?: string
) {
  const [operation, setOperation] = useState<EnhancedOfflineOperation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const operationRef = useRef<EnhancedOfflineOperation | null>(null)

  // 监听操作状态变化
  useEffect(() => {
    if (!manager || !operationId) {
      setOperation(null)
      operationRef.current = null
      return
    }

    // 这里可以实现操作状态监听逻辑
    // 由于当前实现中没有直接的操作查询接口，这里是一个简化版本

    const checkOperationStatus = () => {
      try {
        const stats = manager.getStats()
        // 这里可以通过统计信息推断操作状态
        // 实际实现可能需要修改EnhancedOfflineManager以提供操作查询接口

        setOperation(operationRef.current)
      } catch (err) {
        console.error('检查操作状态失败:', err)
      }
    }

    const interval = setInterval(checkOperationStatus, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [manager, operationId])

  return {
    operation,
    isLoading,
    error,
    clearError: () => setError(null)
  }
}

/**
 * 增强离线统计Hook
 * 提供对统计信息的便捷访问
 */
export function useEnhancedOfflineStats(
  manager: EnhancedOfflineManager | null,
  updateInterval: number = 1000
) {
  const [stats, setStats] = useState<EnhancedOfflineStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!manager) {
      setStats(null)
      return
    }

    const updateStats = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const currentStats = manager.getStats()
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
  }, [manager, updateInterval])

  return {
    stats,
    isLoading,
    error,
    refresh: () => {
      if (manager) {
        try {
          const currentStats = manager.getStats()
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