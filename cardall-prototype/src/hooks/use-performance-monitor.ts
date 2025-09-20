import { useEffect, useRef, useCallback } from 'react'
import { performanceMonitor, type PerformanceMetrics, type UserExperienceMetrics } from '@/services/ui/performance-monitor'

interface UsePerformanceMonitorOptions {
  enableMetricsCollection?: boolean
  enableUserTracking?: boolean
  enableConflictMonitoring?: boolean
  reportInterval?: number
}

interface PerformanceStats {
  averageRenderTime: number
  averageMemoryUsage: number
  averageNetworkLatency: number
  conflictResolutionTime: number
  userSatisfaction: number
  errorRate: number
  totalOperations: number
  successfulOperations: number
}

export function usePerformanceMonitor(options: UsePerformanceMonitorOptions = {}) {
  const {
    enableMetricsCollection = true,
    enableUserTracking = true,
    enableConflictMonitoring = true,
    reportInterval = 30000 // 30秒
  } = options

  const statsRef = useRef<PerformanceStats>({
    averageRenderTime: 0,
    averageMemoryUsage: 0,
    averageNetworkLatency: 0,
    conflictResolutionTime: 0,
    userSatisfaction: 0,
    errorRate: 0,
    totalOperations: 0,
    successfulOperations: 0
  })

  const metricsRef = useRef<PerformanceMetrics[]>([])
  const userActionsRef = useRef<any[]>([])

  // 初始化性能监控
  useEffect(() => {
    if (!enableMetricsCollection) return

    // 开始监控
    performanceMonitor.clearMetrics()

    // 定期收集和更新统计信息
    const interval = setInterval(() => {
      updatePerformanceStats()
    }, reportInterval)

    return () => {
      clearInterval(interval)
    }
  }, [enableMetricsCollection, reportInterval])

  // 更新性能统计
  const updatePerformanceStats = useCallback(() => {
    const metrics = performanceMonitor.getMetrics()
    if (metrics.length === 0) return

    const recentMetrics = metrics.slice(-10) // 最近10个指标
    const avgMetrics = calculateAverageMetrics(recentMetrics)

    statsRef.current = {
      averageRenderTime: avgMetrics.renderTime,
      averageMemoryUsage: avgMetrics.memoryUsage,
      averageNetworkLatency: avgMetrics.networkLatency,
      conflictResolutionTime: avgMetrics.conflictResolutionTime,
      userSatisfaction: avgMetrics.userSatisfaction,
      errorRate: calculateErrorRate(recentMetrics),
      totalOperations: recentMetrics.length,
      successfulOperations: recentMetrics.filter(m => m.errorRate < 0.05).length
    }

    metricsRef.current = metrics
  }, [])

  // 计算平均指标
  const calculateAverageMetrics = useCallback((metrics: PerformanceMetrics[]) => {
    if (metrics.length === 0) return {
      renderTime: 0,
      memoryUsage: 0,
      networkLatency: 0,
      conflictResolutionTime: 0,
      userSatisfaction: 0,
      errorRate: 0
    }

    return {
      renderTime: metrics.reduce((sum, m) => sum + m.renderTime, 0) / metrics.length,
      memoryUsage: metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length,
      networkLatency: metrics.reduce((sum, m) => sum + m.networkLatency, 0) / metrics.length,
      conflictResolutionTime: metrics.reduce((sum, m) => sum + m.conflictResolutionTime, 0) / metrics.length,
      userSatisfaction: metrics.reduce((sum, m) => sum + m.userSatisfaction, 0) / metrics.length,
      errorRate: metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length
    }
  }, [])

  // 计算错误率
  const calculateErrorRate = useCallback((metrics: PerformanceMetrics[]) => {
    const totalErrors = metrics.reduce((sum, m) => sum + m.errorRate, 0)
    return totalErrors / metrics.length
  }, [])

  // 开始冲突检测计时
  const startConflictDetection = useCallback(() => {
    if (!enableConflictMonitoring) return () => {}
    return performanceMonitor.startConflictDetection()
  }, [enableConflictMonitoring])

  // 开始冲突解决计时
  const startConflictResolution = useCallback(() => {
    if (!enableConflictMonitoring) return () => {}
    return performanceMonitor.startConflictResolution()
  }, [enableConflictMonitoring])

  // 开始批量操作计时
  const startBatchOperation = useCallback(() => {
    if (!enableConflictMonitoring) return () => {}
    return performanceMonitor.startBatchOperation()
  }, [enableConflictMonitoring])

  // 跟踪用户交互
  const trackUserInteraction = useCallback((action: string, duration: number, success: boolean) => {
    if (!enableUserTracking) return

    performanceMonitor.trackUserInteraction(action, duration, success)

    userActionsRef.current.push({
      action,
      duration,
      success,
      timestamp: new Date()
    })

    // 保持最近100个操作
    if (userActionsRef.current.length > 100) {
      userActionsRef.current = userActionsRef.current.slice(-100)
    }
  }, [enableUserTracking])

  // 跟踪用户满意度
  const trackUserSatisfaction = useCallback((score: number, feedback?: string) => {
    if (!enableUserTracking) return
    performanceMonitor.trackUserSatisfaction(score, feedback)
  }, [enableUserTracking])

  // 获取性能报告
  const getPerformanceReport = useCallback((timeRange: number = 3600000) => {
    return performanceMonitor.generateReport(timeRange)
  }, [])

  // 获取实时性能指标
  const getRealtimeMetrics = useCallback(() => {
    return performanceMonitor.getRealtimeMetrics()
  }, [])

  // 获取性能警报
  const getPerformanceAlerts = useCallback(() => {
    return performanceMonitor.getAlerts()
  }, [])

  // 获取用户操作历史
  const getUserActionHistory = useCallback((limit: number = 20) => {
    return userActionsRef.current.slice(-limit)
  }, [])

  // 获取性能统计
  const getPerformanceStats = useCallback(() => {
    return { ...statsRef.current }
  }, [])

  // 清除性能数据
  const clearPerformanceData = useCallback(() => {
    performanceMonitor.clearMetrics()
    metricsRef.current = []
    userActionsRef.current = []
    statsRef.current = {
      averageRenderTime: 0,
      averageMemoryUsage: 0,
      averageNetworkLatency: 0,
      conflictResolutionTime: 0,
      userSatisfaction: 0,
      errorRate: 0,
      totalOperations: 0,
      successfulOperations: 0
    }
  }, [])

  // 获取性能健康状态
  const getPerformanceHealth = useCallback(() => {
    const stats = statsRef.current

    // 性能健康评分 (0-100)
    let healthScore = 100

    // 根据渲染时间扣分
    if (stats.averageRenderTime > 100) healthScore -= 20
    if (stats.averageRenderTime > 200) healthScore -= 30

    // 根据内存使用扣分
    if (stats.averageMemoryUsage > 100 * 1024 * 1024) healthScore -= 15 // 100MB
    if (stats.averageMemoryUsage > 200 * 1024 * 1024) healthScore -= 25 // 200MB

    // 根据网络延迟扣分
    if (stats.averageNetworkLatency > 1000) healthScore -= 10 // 1秒
    if (stats.averageNetworkLatency > 2000) healthScore -= 20 // 2秒

    // 根据错误率扣分
    if (stats.errorRate > 0.05) healthScore -= 15 // 5%
    if (stats.errorRate > 0.1) healthScore -= 25 // 10%

    // 根据冲突解决时间扣分
    if (stats.conflictResolutionTime > 5000) healthScore -= 10 // 5秒
    if (stats.conflictResolutionTime > 10000) healthScore -= 20 // 10秒

    return {
      healthScore: Math.max(0, healthScore),
      status: healthScore >= 80 ? 'good' : healthScore >= 60 ? 'warning' : 'critical',
      issues: getPerformanceIssues(stats)
    }
  }, [])

  // 获取性能问题
  const getPerformanceIssues = useCallback((stats: PerformanceStats) => {
    const issues: string[] = []

    if (stats.averageRenderTime > 100) {
      issues.push('渲染时间过长，可能影响用户体验')
    }

    if (stats.averageMemoryUsage > 100 * 1024 * 1024) {
      issues.push('内存使用较高，建议检查内存泄漏')
    }

    if (stats.averageNetworkLatency > 1000) {
      issues.push('网络延迟较高，可能影响同步性能')
    }

    if (stats.errorRate > 0.05) {
      issues.push('错误率较高，需要关注错误处理')
    }

    if (stats.conflictResolutionTime > 5000) {
      issues.push('冲突解决时间过长，建议优化算法')
    }

    return issues
  }, [])

  return {
    // 方法
    startConflictDetection,
    startConflictResolution,
    startBatchOperation,
    trackUserInteraction,
    trackUserSatisfaction,
    getPerformanceReport,
    getRealtimeMetrics,
    getPerformanceAlerts,
    getUserActionHistory,
    getPerformanceStats,
    clearPerformanceData,
    getPerformanceHealth,

    // 状态
    stats: statsRef.current,
    isMonitoring: enableMetricsCollection
  }
}