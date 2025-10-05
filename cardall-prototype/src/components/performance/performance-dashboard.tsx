import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  MemoryStick,
  Cpu,
  Wifi,
  Database,
  Zap,
  Download,
  RefreshCw,
  Settings
} from 'lucide-react'
import { useAdvancedPerformanceMonitor } from '@/hooks/use-performance-monitor'
import {
  PerformanceTrend,
  BottleneckAnalysis,
  PerformanceAlert
} from '@/hooks/use-performance-monitor'

/**
 * 性能指标卡片组件
 */
const MetricCard: React.FC<{
  title: string
  value: string | number
  unit?: string
  trend?: 'up' | 'down' | 'stable'
  status?: 'good' | 'warning' | 'critical'
  icon: React.ReactNode
}> = ({ title, value, unit, trend, status, icon }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'good': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'critical': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />
      default: return null
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon}
            <p className="text-sm font-medium text-gray-600">{title}</p>
          </div>
          {getTrendIcon()}
        </div>
        <div className="mt-2">
          <p className={`text-2xl font-bold ${getStatusColor()}`}>
            {value}{unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 性能趋势图表组件
 */
const TrendChart: React.FC<{
  trends: PerformanceTrend[]
}> = ({ trends }) => {
  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-600'
      case 'degrading': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4" />
      case 'degrading': return <TrendingDown className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>性能趋势</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {trends.map((trend, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                {getTrendIcon(trend.trend)}
                <div>
                  <p className="font-medium">{trend.metricName}</p>
                  <p className="text-sm text-gray-500">
                    置信度: {Math.round(trend.confidence * 100)}%
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-medium ${getTrendColor(trend.trend)}`}>
                  {trend.trend === 'improving' ? '改善' : trend.trend === 'degrading' ? '下降' : '稳定'}
                </p>
                <p className="text-sm text-gray-500">
                  {trend.changeRate > 0 ? '+' : ''}{Math.round(trend.changeRate * 100)}%
                </p>
              </div>
            </div>
          ))}
          {trends.length === 0 && (
            <p className="text-center text-gray-500 py-4">暂无趋势数据</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 性能告警组件
 */
const AlertsPanel: React.FC<{
  alerts: PerformanceAlert[]
  onClearAlerts: (alertIds?: string[]) => void
}> = ({ alerts, onClearAlerts }) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive'
      case 'warning': return 'default'
      case 'info': return 'secondary'
      default: return 'default'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4" />
      case 'warning': return <AlertTriangle className="h-4 w-4" />
      case 'info': return <CheckCircle className="h-4 w-4" />
      default: return <CheckCircle className="h-4 w-4" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>性能告警</span>
            <Badge variant="outline">{alerts.length}</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onClearAlerts()}
          >
            清除全部
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert, index) => (
            <Alert key={index} className={getSeverityColor(alert.severity)}>
              <div className="flex items-start space-x-2">
                {getSeverityIcon(alert.severity)}
                <div className="flex-1">
                  <AlertDescription className="font-medium">
                    {alert.message}
                  </AlertDescription>
                  {alert.recommendation && (
                    <p className="text-sm text-gray-600 mt-1">
                      建议: {alert.recommendation}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onClearAlerts([alert.id])}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </Alert>
          ))}
          {alerts.length === 0 && (
            <div className="text-center py-4">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-gray-500">暂无告警</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 性能瓶颈分析组件
 */
const BottlenecksPanel: React.FC<{
  bottlenecks: BottleneckAnalysis[]
}> = ({ bottlenecks }) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600'
      case 'high': return 'text-orange-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-blue-600'
      default: return 'text-gray-600'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'memory': return <MemoryStick className="h-4 w-4" />
      case 'cpu': return <Cpu className="h-4 w-4" />
      case 'network': return <Wifi className="h-4 w-4" />
      case 'storage': return <Database className="h-4 w-4" />
      case 'rendering': return <Zap className="h-4 w-4" />
      default: return <AlertTriangle className="h-4 w-4" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>性能瓶颈分析</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {bottlenecks.map((bottleneck, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getCategoryIcon(bottleneck.category)}
                  <span className="font-medium">{bottleneck.description}</span>
                </div>
                <Badge
                  variant="outline"
                  className={getSeverityColor(bottleneck.severity)}
                >
                  {bottleneck.severity}
                </Badge>
              </div>

              <p className="text-sm text-gray-600 mb-3">{bottleneck.impact}</p>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>预计改善</span>
                  <span className="font-medium">+{bottleneck.estimatedImprovement}%</span>
                </div>
                <Progress value={bottleneck.estimatedImprovement} className="h-2" />
              </div>

              <div className="mt-3">
                <p className="text-sm font-medium mb-1">建议措施:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  {bottleneck.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start space-x-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
          {bottlenecks.length === 0 && (
            <div className="text-center py-4">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-gray-500">未发现明显瓶颈</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 性能监控仪表板主组件
 */
export const PerformanceDashboard: React.FC = () => {
  const {
    isInitialized,
    isInitializing,
    metrics,
    alerts,
    trends,
    bottlenecks,
    error,
    isAnalyzing,
    triggerAnalysis,
    getPerformanceSummary,
    optimizePerformance,
    clearAlerts,
    getRecommendations,
    exportPerformanceData,
    refreshData
  } = useAdvancedPerformanceMonitor({
    metricsInterval: 5000,
    analysisInterval: 30000,
    enableRealTimeAnalysis: true,
    enableAutomaticAlerts: true
  })

  const [summary, setSummary] = useState<any>(null)
  const [recommendations, setRecommendations] = useState<string[]>([])

  useEffect(() => {
    if (metrics) {
      const perfSummary = getPerformanceSummary()
      setSummary(perfSummary)

      const recs = getRecommendations()
      setRecommendations(recs)
    }
  }, [metrics, getPerformanceSummary, getRecommendations])

  const handleOptimize = useCallback(async () => {
    try {
      await optimizePerformance()
      await refreshData()
    } catch (err) {
      console.error('性能优化失败:', err)
    }
  }, [optimizePerformance, refreshData])

  const handleExport = useCallback(async (format: 'json' | 'csv') => {
    try {
      const data = await exportPerformanceData(format)
      const blob = new Blob([data], {
        type: format === 'json' ? 'application/json' : 'text/csv'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `performance-report-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('导出失败:', err)
    }
  }, [exportPerformanceData])

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>正在初始化性能监控...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert className="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>性能监控初始化失败: {error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* 头部信息 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">性能监控仪表板</h1>
          <p className="text-gray-600">实时监控系统性能状态和趋势</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={!isInitialized}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={triggerAnalysis}
            disabled={!isInitialized || isAnalyzing}
          >
            <Activity className="h-4 w-4 mr-2" />
            {isAnalyzing ? '分析中...' : '立即分析'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOptimize}
            disabled={!isInitialized}
          >
            <Zap className="h-4 w-4 mr-2" />
            优化性能
          </Button>
        </div>
      </div>

      {/* 性能摘要 */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>性能摘要</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">整体健康度</p>
                <Badge
                  variant={summary.overallHealth === 'excellent' ? 'default' :
                           summary.overallHealth === 'good' ? 'secondary' :
                           summary.overallHealth === 'fair' ? 'outline' : 'destructive'}
                  className="mt-1"
                >
                  {summary.overallHealth === 'excellent' ? '优秀' :
                   summary.overallHealth === 'good' ? '良好' :
                   summary.overallHealth === 'fair' ? '一般' : '较差'}
                </Badge>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">严重问题</p>
                <p className="text-2xl font-bold text-red-600">{summary.criticalIssues}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">警告问题</p>
                <p className="text-2xl font-bold text-yellow-600">{summary.warningIssues}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">性能瓶颈</p>
                <p className="text-2xl font-bold text-orange-600">{summary.bottlenecksCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 关键指标 */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="内存使用"
            value={Math.round(metrics.memoryUsage / 1024 / 1024)}
            unit="MB"
            trend={metrics.memoryUsage > 100 * 1024 * 1024 ? 'up' : 'stable'}
            status={metrics.memoryUsage > 200 * 1024 * 1024 ? 'critical' :
                    metrics.memoryUsage > 100 * 1024 * 1024 ? 'warning' : 'good'}
            icon={<MemoryStick className="h-5 w-5 text-blue-600" />}
          />
          <MetricCard
            title="CPU使用率"
            value={Math.round(metrics.cpuUsage)}
            unit="%"
            trend={metrics.cpuUsage > 80 ? 'up' : 'stable'}
            status={metrics.cpuUsage > 90 ? 'critical' :
                    metrics.cpuUsage > 80 ? 'warning' : 'good'}
            icon={<Cpu className="h-5 w-5 text-green-600" />}
          />
          <MetricCard
            title="网络延迟"
            value={Math.round(metrics.networkLatency)}
            unit="ms"
            trend={metrics.networkLatency > 1000 ? 'up' : 'stable'}
            status={metrics.networkLatency > 2000 ? 'critical' :
                    metrics.networkLatency > 1000 ? 'warning' : 'good'}
            icon={<Wifi className="h-5 w-5 text-purple-600" />}
          />
          <MetricCard
            title="渲染时间"
            value={Math.round(metrics.frameTime)}
            unit="ms"
            trend={metrics.frameTime > 16.67 ? 'up' : 'stable'}
            status={metrics.frameTime > 33.34 ? 'critical' :
                    metrics.frameTime > 16.67 ? 'warning' : 'good'}
            icon={<Zap className="h-5 w-5 text-orange-600" />}
          />
        </div>
      )}

      {/* 详细信息标签页 */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="alerts">告警信息</TabsTrigger>
          <TabsTrigger value="trends">性能趋势</TabsTrigger>
          <TabsTrigger value="bottlenecks">瓶颈分析</TabsTrigger>
          <TabsTrigger value="recommendations">优化建议</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts">
          <AlertsPanel alerts={alerts} onClearAlerts={clearAlerts} />
        </TabsContent>

        <TabsContent value="trends">
          <TrendChart trends={trends} />
        </TabsContent>

        <TabsContent value="bottlenecks">
          <BottlenecksPanel bottlenecks={bottlenecks} />
        </TabsContent>

        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>优化建议</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start space-x-2 p-3 bg-blue-50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-700">{rec}</p>
                  </div>
                ))}
                {recommendations.length === 0 && (
                  <div className="text-center py-4">
                    <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-gray-500">暂无优化建议</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 导出操作 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Download className="h-5 w-5" />
            <span>数据导出</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => handleExport('json')}
              disabled={!isInitialized}
            >
              导出 JSON
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('csv')}
              disabled={!isInitialized}
            >
              导出 CSV
            </Button>
            <p className="text-sm text-gray-500">
              最后更新: {summary?.lastUpdated?.toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}