import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { PerformanceMonitor, PerformanceMonitorConfig, PerformanceMetrics, PerformanceAlert, PerformanceReport } from '@/services/performance/performance-monitor'
import { performanceMonitor, type PerformanceMetrics as UIPerformanceMetrics, type UserExperienceMetrics } from '@/services/ui/performance-monitor'

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

/**
 * 高级性能监控配置接口
 */
interface AdvancedPerformanceHookConfig {
  metricsInterval?: number
  analysisInterval?: number
  alertThresholds?: {
    memory?: number
    cpu?: number
    networkLatency?: number
    frameTime?: number
    storageOperations?: number
  }
  enableRealTimeAnalysis?: boolean
  enableAutomaticAlerts?: boolean
}

/**
 * 性能趋势分析结果
 */
interface PerformanceTrend {
  metricName: string
  trend: 'improving' | 'stable' | 'degrading'
  changeRate: number
  confidence: number
  predictedValue: number
  timeFrame: number
}

/**
 * 性能瓶颈分析结果
 */
interface BottleneckAnalysis {
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'memory' | 'cpu' | 'network' | 'storage' | 'rendering'
  description: string
  impact: string
  recommendations: string[]
  estimatedImprovement: number
  priority: number
}

/**
 * 高级性能监控Hook
 * 提供对高级性能监控功能的访问
 */
export function useAdvancedPerformanceMonitor(config: AdvancedPerformanceHookConfig = {}) {
  const [monitor, setMonitor] = useState<PerformanceMonitor | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [trends, setTrends] = useState<PerformanceTrend[]>([])
  const [bottlenecks, setBottlenecks] = useState<BottleneckAnalysis[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const monitorRef = useRef<PerformanceMonitor | null>(null)
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 创建监控配置
  const createMonitorConfig = useCallback((): PerformanceMonitorConfig => {
    return {
      collectionInterval: config.metricsInterval || 5000,
      analysisInterval: config.analysisInterval || 30000,
      alertThresholds: config.alertThresholds || {
        memory: 100 * 1024 * 1024, // 100MB
        cpu: 80, // 80%
        networkLatency: 1000, // 1s
        frameTime: 16.67, // 60fps
        storageOperations: 100 // 100 ops/sec
      },
      enableRealTimeAnalysis: config.enableRealTimeAnalysis || true,
      enableAutomaticAlerts: config.enableAutomaticAlerts || true,
      maxMetricsHistory: 1000,
      enableDetailedProfiling: true,
      enableNetworkMonitoring: true,
      enableMemoryTracking: true,
      enableCPUMonitoring: true
    }
  }, [config])

  // 初始化监控器
  useEffect(() => {
    if (isInitializing || monitorRef.current) {
      return
    }

    const initializeMonitor = async () => {
      setIsInitializing(true)
      setError(null)

      try {
        const performanceMonitor = new PerformanceMonitor(createMonitorConfig())
        await performanceMonitor.initialize()

        monitorRef.current = performanceMonitor
        setMonitor(performanceMonitor)
        setIsInitialized(true)

        // 获取初始指标
        const initialMetrics = performanceMonitor.getCurrentMetrics()
        setMetrics(initialMetrics)

        // 设置指标更新间隔
        if (config.metricsInterval !== 0) {
          metricsIntervalRef.current = setInterval(async () => {
            try {
              const currentMetrics = performanceMonitor.getCurrentMetrics()
              setMetrics(currentMetrics)
            } catch (err) {
              console.error('获取性能指标失败:', err)
            }
          }, config.metricsInterval || 5000)
        }

        // 设置分析间隔
        if (config.enableRealTimeAnalysis && config.analysisInterval !== 0) {
          analysisIntervalRef.current = setInterval(async () => {
            await runAnalysis()
          }, config.analysisInterval || 30000)
        }

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '初始化失败'
        setError(errorMessage)
        console.error('PerformanceMonitor 初始化失败:', err)
      } finally {
        setIsInitializing(false)
      }
    }

    initializeMonitor()

    return () => {
      // 清理
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current)
      }
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current)
      }
      if (monitorRef.current) {
        monitorRef.current.destroy().catch(err => {
          console.error('PerformanceMonitor 销毁失败:', err)
        })
      }
    }
  }, [createMonitorConfig, config.metricsInterval, config.analysisInterval, config.enableRealTimeAnalysis])

  // 运行性能分析
  const runAnalysis = useCallback(async () => {
    if (!monitor || isAnalyzing) {
      return
    }

    setIsAnalyzing(true)

    try {
      // 分析性能趋势
      const trendAnalysis = await monitor.analyzePerformanceTrends()
      const formattedTrends: PerformanceTrend[] = trendAnalysis.map(trend => ({
        metricName: trend.metricName,
        trend: trend.trend,
        changeRate: trend.changeRate,
        confidence: trend.confidence,
        predictedValue: trend.predictedValue,
        timeFrame: trend.timeFrame
      }))
      setTrends(formattedTrends)

      // 分析瓶颈
      const bottleneckAnalysis = await monitor.analyzeBottlenecks()
      const formattedBottlenecks: BottleneckAnalysis[] = bottleneckAnalysis.map(bottleneck => ({
        severity: bottleneck.severity,
        category: bottleneck.category,
        description: bottleneck.description,
        impact: bottleneck.impact,
        recommendations: bottleneck.recommendations,
        estimatedImprovement: bottleneck.estimatedImprovement,
        priority: bottleneck.priority
      }))
      setBottlenecks(formattedBottlenecks)

      // 获取最新告警
      const currentAlerts = monitor.getAlerts()
      setAlerts(currentAlerts)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '分析失败'
      setError(errorMessage)
      console.error('性能分析失败:', err)
    } finally {
      setIsAnalyzing(false)
    }
  }, [monitor, isAnalyzing])

  // 手动触发分析
  const triggerAnalysis = useCallback(async () => {
    await runAnalysis()
  }, [runAnalysis])

  // 生成性能报告
  const generateReport = useCallback(async (timeRange?: { start: Date; end: Date }) => {
    if (!monitor) {
      throw new Error('PerformanceMonitor 未初始化')
    }

    try {
      const report = await monitor.generatePerformanceReport(timeRange)
      return report
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '生成报告失败'
      setError(errorMessage)
      throw err
    }
  }, [monitor])

  // 获取性能摘要
  const getPerformanceSummary = useCallback(() => {
    if (!metrics) {
      return null
    }

    return {
      overallHealth: calculateOverallHealth(),
      criticalIssues: alerts.filter(alert => alert.severity === 'critical').length,
      warningIssues: alerts.filter(alert => alert.severity === 'warning').length,
      bottlenecksCount: bottlenecks.filter(b => b.severity === 'critical' || b.severity === 'high').length,
      lastUpdated: new Date()
    }
  }, [metrics, alerts, bottlenecks])

  // 计算整体健康度
  const calculateOverallHealth = useCallback((): 'excellent' | 'good' | 'fair' | 'poor' => {
    if (!metrics) {
      return 'poor'
    }

    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical').length
    const highBottlenecks = bottlenecks.filter(b => b.severity === 'critical' || b.severity === 'high').length

    if (criticalAlerts > 0 || highBottlenecks > 0) {
      return 'poor'
    } else if (alerts.length > 2 || bottlenecks.length > 1) {
      return 'fair'
    } else if (alerts.length > 0 || bottlenecks.length > 0) {
      return 'good'
    } else {
      return 'excellent'
    }
  }, [metrics, alerts, bottlenecks])

  // 优化性能
  const optimizePerformance = useCallback(async () => {
    if (!monitor) {
      throw new Error('PerformanceMonitor 未初始化')
    }

    try {
      const optimizations = await monitor.optimizePerformance()

      // 刷新指标和分析结果
      const currentMetrics = monitor.getCurrentMetrics()
      setMetrics(currentMetrics)

      await runAnalysis()

      return optimizations
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '优化失败'
      setError(errorMessage)
      throw err
    }
  }, [monitor, runAnalysis])

  // 清除告警
  const clearAlerts = useCallback(async (alertIds?: string[]) => {
    if (!monitor) {
      return
    }

    try {
      await monitor.clearAlerts(alertIds)
      const currentAlerts = monitor.getAlerts()
      setAlerts(currentAlerts)
    } catch (err) {
      console.error('清除告警失败:', err)
    }
  }, [monitor])

  // 获取性能建议
  const getRecommendations = useCallback(() => {
    const recommendations: string[] = []

    // 从瓶颈分析中提取建议
    bottlenecks.forEach(bottleneck => {
      recommendations.push(...bottleneck.recommendations)
    })

    // 从趋势分析中提取建议
    trends.forEach(trend => {
      if (trend.trend === 'degrading') {
        recommendations.push(`检测到 ${trend.metricName} 性能下降，建议检查相关组件`)
      }
    })

    // 从告警中提取建议
    alerts.forEach(alert => {
      if (alert.recommendation) {
        recommendations.push(alert.recommendation)
      }
    })

    // 去重
    return [...new Set(recommendations)]
  }, [bottlenecks, trends, alerts])

  // 导出性能数据
  const exportPerformanceData = useCallback(async (format: 'json' | 'csv' = 'json') => {
    if (!monitor) {
      throw new Error('PerformanceMonitor 未初始化')
    }

    try {
      const data = await monitor.exportMetrics(format)
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '导出失败'
      setError(errorMessage)
      throw err
    }
  }, [monitor])

  // 刷新数据
  const refreshData = useCallback(async () => {
    if (!monitor) {
      return
    }

    try {
      const currentMetrics = monitor.getCurrentMetrics()
      setMetrics(currentMetrics)

      const currentAlerts = monitor.getAlerts()
      setAlerts(currentAlerts)

      await runAnalysis()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '刷新失败'
      setError(errorMessage)
    }
  }, [monitor, runAnalysis])

  // 清除错误
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    monitor,
    isInitialized,
    isInitializing,
    metrics,
    alerts,
    trends,
    bottlenecks,
    error,
    isAnalyzing,
    triggerAnalysis,
    generateReport,
    getPerformanceSummary,
    optimizePerformance,
    clearAlerts,
    getRecommendations,
    exportPerformanceData,
    refreshData,
    clearError
  }
}

/**
 * UI性能监控Hook（原有功能）
 */
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