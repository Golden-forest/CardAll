import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Activity,
  Zap,
  Database,
  Wifi,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download,
  BarChart3,
  Users,
  Clock,
  Cpu
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePerformanceMonitor } from '@/hooks/use-performance-monitor'

interface PerformanceMonitorPanelProps {
  className?: string
  showDetails?: boolean
  compact?: boolean
  autoRefresh?: boolean
}

export function PerformanceMonitorPanel({
  className,
  showDetails = true,
  compact = false,
  autoRefresh = true
}: PerformanceMonitorPanelProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [selectedTab, setSelectedTab] = useState<'overview' | 'metrics' | 'alerts' | 'actions'>('overview')
  const [refreshKey, setRefreshKey] = useState(0)

  const {
    stats,
    getRealtimeMetrics,
    getPerformanceAlerts,
    getUserActionHistory,
    getPerformanceHealth,
    getPerformanceReport,
    clearPerformanceData,
    isMonitoring
  } = usePerformanceMonitor({
    enableMetricsCollection: true,
    enableUserTracking: true,
    enableConflictMonitoring: true,
    reportInterval: 10000 // 10秒
  })

  const [realtimeMetrics, setRealtimeMetrics] = useState<any>({})
  const [alerts, setAlerts] = useState<any[]>([])
  const [actions, setActions] = useState<any[]>([])
  const [health, setHealth] = useState<any>(null)

  // 刷新数据
  const refreshData = () => {
    setRealtimeMetrics(getRealtimeMetrics())
    setAlerts(getPerformanceAlerts())
    setActions(getUserActionHistory(20))
    setHealth(getPerformanceHealth())
    setRefreshKey(prev => prev + 1)
  }

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh || !isVisible) return

    refreshData()
    const interval = setInterval(refreshData, 5000) // 每5秒刷新一次

    return () => clearInterval(interval)
  }, [autoRefresh, isVisible, refreshKey])

  // 首次加载时获取数据
  useEffect(() => {
    if (isVisible) {
      refreshData()
    }
  }, [isVisible])

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`
  }

  // 格式化时间
  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}min`
  }

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-500'
      case 'warning': return 'text-yellow-500'
      case 'critical': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'critical': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  // 紧凑模式
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className={cn("flex items-center gap-1", getStatusColor(health?.status || 'unknown'))}>
          {getStatusIcon(health?.status || 'unknown')}
          <span className="text-sm font-medium">
            {health?.healthScore || 0}/100
          </span>
        </div>

        {alerts.length > 0 && (
          <Badge variant="destructive" className="text-xs">
            {alerts.length}
          </Badge>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsVisible(!isVisible)}
        >
          <BarChart3 className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <>
      {/* 性能状态指示器 */}
      <div className={cn("flex items-center gap-2 cursor-pointer", className)} onClick={() => setIsVisible(!isVisible)}>
        <div className={cn("flex items-center gap-1", getStatusColor(health?.status || 'unknown'))}>
          {getStatusIcon(health?.status || 'unknown')}
          <span className="text-sm font-medium">
            性能: {health?.healthScore || 0}/100
          </span>
        </div>

        {alerts.length > 0 && (
          <Badge variant="destructive" className="text-xs">
            {alerts.length} 警报
          </Badge>
        )}

        <Button variant="ghost" size="sm">
          {isVisible ? '隐藏' : '显示'}
        </Button>
      </div>

      {/* 性能监控面板 */}
      {isVisible && (
        <Card className="w-full max-w-4xl max-h-[80vh]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                性能监控
                <Badge variant={isMonitoring ? 'default' : 'secondary'}>
                  {isMonitoring ? '监控中' : '已停止'}
                </Badge>
              </CardTitle>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshData}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  刷新
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const report = getPerformanceReport()
                    // 这里可以实现报告下载功能
                    console.log('Performance Report:', report)
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  报告
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsVisible(false)}
                >
                  ×
                </Button>
              </div>
            </div>

            {/* 健康状态概览 */}
            {health && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">健康状态:</span>
                  <div className="flex items-center gap-1 mt-1">
                    {getStatusIcon(health.status)}
                    <span className={cn("font-medium", getStatusColor(health.status))}>
                      {health.healthScore}/100 ({health.status})
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">渲染时间:</span>
                  <span className="ml-2 font-medium">{formatTime(realtimeMetrics.renderTime || 0)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">内存使用:</span>
                  <span className="ml-2 font-medium">{formatFileSize(realtimeMetrics.memoryUsage || 0)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">网络延迟:</span>
                  <span className="ml-2 font-medium">{realtimeMetrics.networkLatency || 0}ms</span>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent>
            {/* 标签页 */}
            <div className="flex gap-2 mb-4">
              {(['overview', 'metrics', 'alerts', 'actions'] as const).map(tab => (
                <Button
                  key={tab}
                  variant={selectedTab === tab ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTab(tab)}
                >
                  {tab === 'overview' && '概览'}
                  {tab === 'metrics' && '指标'}
                  {tab === 'alerts' && '警报'}
                  {tab === 'actions' && '用户行为'}
                </Button>
              ))}
            </div>

            {/* 内容区域 */}
            <ScrollArea className="h-96">
              {selectedTab === 'overview' && (
                <div className="space-y-4">
                  {/* 性能指标概览 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="h-4 w-4 text-yellow-500" />
                          <span className="font-medium">渲染性能</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>平均渲染时间:</span>
                            <span>{formatTime(stats.averageRenderTime)}</span>
                          </div>
                          <Progress value={Math.min(100, (stats.averageRenderTime / 100) * 100)} className="h-2" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Database className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">内存使用</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>内存使用:</span>
                            <span>{formatFileSize(stats.averageMemoryUsage)}</span>
                          </div>
                          <Progress value={Math.min(100, (stats.averageMemoryUsage / (100 * 1024 * 1024)) * 100)} className="h-2" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Wifi className="h-4 w-4 text-green-500" />
                          <span className="font-medium">网络性能</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>平均延迟:</span>
                            <span>{stats.averageNetworkLatency}ms</span>
                          </div>
                          <Progress value={Math.min(100, (stats.averageNetworkLatency / 1000) * 100)} className="h-2" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="h-4 w-4 text-purple-500" />
                          <span className="font-medium">用户体验</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>满意度:</span>
                            <span>{stats.userSatisfaction.toFixed(1)}%</span>
                          </div>
                          <Progress value={stats.userSatisfaction} className="h-2" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 性能问题 */}
                  {health?.issues && health.issues.length > 0 && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          <span className="font-medium">性能问题</span>
                        </div>
                        <div className="space-y-1 text-sm">
                          {health.issues.map((issue: string, index: number) => (
                            <div key={index} className="flex items-start gap-2">
                              <div className="w-1 h-1 bg-orange-500 rounded-full mt-2 flex-shrink-0" />
                              <span>{issue}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {selectedTab === 'metrics' && (
                <div className="space-y-4">
                  <h4 className="font-medium">实时性能指标</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>渲染时间:</span>
                        <span>{formatTime(realtimeMetrics.renderTime || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>首次绘制:</span>
                        <span>{formatTime(realtimeMetrics.firstPaint || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>内容绘制:</span>
                        <span>{formatTime(realtimeMetrics.firstContentfulPaint || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>最大内容绘制:</span>
                        <span>{formatTime(realtimeMetrics.largestContentfulPaint || 0)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>内存使用:</span>
                        <span>{formatFileSize(realtimeMetrics.memoryUsage || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>网络延迟:</span>
                        <span>{realtimeMetrics.networkLatency || 0}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span>冲突检测时间:</span>
                        <span>{formatTime(realtimeMetrics.conflictDetectionTime || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>冲突解决时间:</span>
                        <span>{formatTime(realtimeMetrics.conflictResolutionTime || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedTab === 'alerts' && (
                <div className="space-y-4">
                  <h4 className="font-medium">性能警报</h4>
                  {alerts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      暂无性能警报
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {alerts.map((alert, index) => (
                        <Card key={index} className="border-l-4 border-l-red-500">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                <span className="font-medium text-sm">{alert.type}</span>
                                <Badge variant="outline" className="text-xs">
                                  {alert.severity}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(alert.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm mb-2">{alert.message}</p>
                            {alert.suggestions && alert.suggestions.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-xs font-medium">建议:</span>
                                {alert.suggestions.map((suggestion: string, idx: number) => (
                                  <div key={idx} className="text-xs text-muted-foreground">
                                    • {suggestion}
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedTab === 'actions' && (
                <div className="space-y-4">
                  <h4 className="font-medium">用户行为历史</h4>
                  {actions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      暂无用户行为记录
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {actions.map((action, index) => (
                        <Card key={index}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{action.action}</span>
                                <Badge variant={action.success ? 'default' : 'destructive'} className="text-xs">
                                  {action.success ? '成功' : '失败'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{new Date(action.timestamp).toLocaleTimeString()}</span>
                                <span>({formatTime(action.duration)})</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </>
  )
}