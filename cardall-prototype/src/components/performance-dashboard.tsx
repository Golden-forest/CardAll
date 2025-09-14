import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  BarChart3,
  Database,
  Zap,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Cpu,
  Wifi,
  HardDrive,
  Globe
} from 'lucide-react'
import {
  optimizedQueryService,
  getQueryPerformance,
  rebuildSearchIndexes,
  optimizeDatabase
} from '@/services/query-optimizer'
import { performanceMonitor, PerformanceReport } from '@/utils/performance-monitoring'
import { measurePerformance, measureAsyncPerformance } from '@/utils/performance-monitoring'

interface PerformanceMetrics {
  averageQueryTime: number
  cacheHitRate: number
  slowQueries: any[]
  suggestions: any[]
}

interface SystemMetrics {
  memory: {
    used: number
    total: number
    percentage: number
  }
  cpu: {
    usage: number
  }
  network: {
    latency: number
    downlink: number
  }
  loading: {
    fcp: number
    lcp: number
    tti: number
  }
}

export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [reports, setReports] = useState<PerformanceReport[]>([])
  const [alerts, setAlerts] = useState<any[]>([])

  const loadMetrics = async () => {
    setIsLoading(true)
    try {
      // 加载数据库性能指标
      const dbReport = getQueryPerformance()
      setMetrics(dbReport)

      // 加载系统性能指标
      await loadSystemMetrics()

      setLastUpdate(new Date())
    } catch (error) {
      console.error('Failed to load performance metrics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadSystemMetrics = async () => {
    try {
      // 收集系统指标
      const memoryInfo = measurePerformance('MemoryCollection', () => {
        if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
          const memory = (performance as any).memory
          return {
            used: memory.usedJSHeapSize / (1024 * 1024),
            total: memory.jsHeapSizeLimit / (1024 * 1024),
            percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
          }
        }
        return { used: 0, total: 0, percentage: 0 }
      }, 'runtime')

      const networkInfo = measurePerformance('NetworkCollection', () => {
        if (typeof window !== 'undefined' && 'navigator' in window && 'connection' in navigator) {
          const connection = (navigator as any).connection
          return {
            latency: connection.rtt || 0,
            downlink: connection.downlink || 0
          }
        }
        return { latency: 0, downlink: 0 }
      }, 'network')

      setSystemMetrics({
        memory: memoryInfo,
        cpu: { usage: 0 }, // 浏览器中无法直接获取CPU使用率
        network: networkInfo,
        loading: {
          fcp: 0,
          lcp: 0,
          tti: 0
        }
      })
    } catch (error) {
      console.error('Failed to load system metrics:', error)
    }
  }

  const handleOptimize = async () => {
    setIsOptimizing(true)
    try {
      await optimizeDatabase()
      await loadMetrics()
    } catch (error) {
      console.error('Optimization failed:', error)
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleRebuildIndexes = async () => {
    setIsOptimizing(true)
    try {
      await rebuildSearchIndexes()
      await loadMetrics()
    } catch (error) {
      console.error('Index rebuild failed:', error)
    } finally {
      setIsOptimizing(false)
    }
  }

  // 处理性能报告
  const handlePerformanceReport = useCallback((report: PerformanceReport) => {
    setReports(prev => {
      const updated = [...prev, report]
      // 保持最近24小时的报告
      const oneDayAgo = Date.now() - 86400000
      return updated.filter(r => r.period.end >= oneDayAgo)
    })
  }, [])

  // 开始/停止监控
  const toggleMonitoring = useCallback(() => {
    if (isMonitoring) {
      performanceMonitor.stopMonitoring()
      setIsMonitoring(false)
    } else {
      performanceMonitor.startMonitoring(30000) // 30秒间隔
      setIsMonitoring(true)
      loadMetrics()
    }
  }, [isMonitoring, loadMetrics])

  useEffect(() => {
    loadMetrics()

    // 设置性能监控订阅
    performanceMonitor.subscribe(handlePerformanceReport)

    // 每30秒自动更新指标
    const interval = setInterval(loadMetrics, 30000)

    return () => {
      clearInterval(interval)
      performanceMonitor.unsubscribe(handlePerformanceReport)
    }
  }, [loadMetrics, handlePerformanceReport])

  const formatExecutionTime = (time: number) => {
    return `${time.toFixed(2)}ms`
  }

  const formatCacheRate = (rate: number) => {
    return `${(rate * 100).toFixed(1)}%`
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'destructive'
      case 'medium': return 'secondary'
      case 'low': return 'outline'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">综合性能监控</h1>
          <p className="text-muted-foreground">
            监控系统、数据库、网络和加载性能
            {lastUpdate && (
              <span className="ml-2 text-sm">
                (最后更新: {lastUpdate.toLocaleTimeString()})
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={toggleMonitoring}
            variant={isMonitoring ? "destructive" : "default"}
            size="sm"
          >
            <Activity className={`w-4 h-4 mr-2 ${isMonitoring ? 'animate-pulse' : ''}`} />
            {isMonitoring ? '停止监控' : '开始监控'}
          </Button>
          <Button
            onClick={loadMetrics}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button
            onClick={handleRebuildIndexes}
            disabled={isOptimizing}
            variant="outline"
            size="sm"
          >
            <Database className="w-4 h-4 mr-2" />
            重建索引
          </Button>
          <Button
            onClick={handleOptimize}
            disabled={isOptimizing}
            size="sm"
          >
            <Zap className="w-4 h-4 mr-2" />
            优化数据库
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="database">数据库</TabsTrigger>
          <TabsTrigger value="system">系统</TabsTrigger>
          <TabsTrigger value="network">网络</TabsTrigger>
          <TabsTrigger value="loading">加载性能</TabsTrigger>
          <TabsTrigger value="reports">报告</TabsTrigger>
        </TabsList>

        {/* 概览 */}
        <TabsContent value="overview" className="space-y-4">
          {metrics && systemMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* 平均查询时间 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">平均查询时间</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatExecutionTime(metrics.averageQueryTime)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {metrics.averageQueryTime < 50 ? (
                      <span className="text-green-600">优秀</span>
                    ) : metrics.averageQueryTime < 100 ? (
                      <span className="text-yellow-600">良好</span>
                    ) : (
                      <span className="text-red-600">需要优化</span>
                    )}
                  </p>
                </CardContent>
              </Card>

              {/* 内存使用 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">内存使用</CardTitle>
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {systemMetrics.memory.used.toFixed(1)}MB
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {systemMetrics.memory.percentage < 50 ? (
                      <span className="text-green-600">正常</span>
                    ) : systemMetrics.memory.percentage < 80 ? (
                      <span className="text-yellow-600">中等</span>
                    ) : (
                      <span className="text-red-600">高内存</span>
                    )}
                  </p>
                </CardContent>
              </Card>

              {/* 网络延迟 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">网络延迟</CardTitle>
                  <Wifi className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {systemMetrics.network.latency}ms
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {systemMetrics.network.latency < 100 ? (
                      <span className="text-green-600">优秀</span>
                    ) : systemMetrics.network.latency < 300 ? (
                      <span className="text-yellow-600">一般</span>
                    ) : (
                      <span className="text-red-600">较慢</span>
                    )}
                  </p>
                </CardContent>
              </Card>

              {/* 缓存命中率 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">缓存命中率</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCacheRate(metrics.cacheHitRate)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {metrics.cacheHitRate > 0.8 ? (
                      <span className="text-green-600">优秀</span>
                    ) : metrics.cacheHitRate > 0.5 ? (
                      <span className="text-yellow-600">良好</span>
                    ) : (
                      <span className="text-red-600">需要优化</span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

      {metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 平均查询时间 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均查询时间</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatExecutionTime(metrics.averageQueryTime)}
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.averageQueryTime < 50 ? (
                  <span className="text-green-600">优秀</span>
                ) : metrics.averageQueryTime < 100 ? (
                  <span className="text-yellow-600">良好</span>
                ) : (
                  <span className="text-red-600">需要优化</span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* 缓存命中率 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">缓存命中率</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCacheRate(metrics.cacheHitRate)}
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.cacheHitRate > 0.8 ? (
                  <span className="text-green-600">优秀</span>
                ) : metrics.cacheHitRate > 0.5 ? (
                  <span className="text-yellow-600">良好</span>
                ) : (
                  <span className="text-red-600">需要优化</span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* 慢查询数量 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">慢查询数量</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.slowQueries.length}
              </div>
              <p className="text-xs text-muted-foreground">
                超过100ms的查询
              </p>
            </CardContent>
          </Card>

          {/* 优化建议数量 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">优化建议</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.suggestions.length}
              </div>
              <p className="text-xs text-muted-foreground">
                待处理的建议
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p>加载性能指标中...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 慢查询列表 */}
      {metrics && metrics.slowQueries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>慢查询分析</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.slowQueries.slice(0, 5).map((query, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{query.query}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(query.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-lg">
                      {formatExecutionTime(query.executionTime)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {query.resultCount} 结果
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 优化建议 */}
      {metrics && metrics.suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>优化建议</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.suggestions.map((suggestion, index) => (
                <div key={index} className="flex items-start gap-3 p-4 border rounded">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={getImpactColor(suggestion.impact)}>
                        {suggestion.impact}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {suggestion.type}
                      </span>
                    </div>
                    <div className="font-medium mb-1">{suggestion.description}</div>
                    <div className="text-sm text-green-600">
                      预期提升: {suggestion.estimatedImprovement}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 性能图表占位符 */}
      <Card>
        <CardHeader>
          <CardTitle>性能趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-2" />
              <p>性能图表将在这里显示</p>
              <p className="text-sm">（需要集成图表库）</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}