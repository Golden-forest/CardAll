import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Bug, 
  Activity, 
  Network, 
  Database, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Download,
  Trash2,
  Settings,
  BarChart3
} from 'lucide-react'

import { 
  debugManager, 
  DebugLevel, 
  DebugEventType,
  type DebugEvent 
} from '@/services/debug-system'

import { 
  syncDiagnostics, 
  SyncHealthStatus,
  type SyncDiagnosticReport 
} from '@/services/sync-diagnostics'

import { 
  smartErrorHandler,
  getErrorStatistics,
  getPreventiveSuggestions,
  type ErrorStatistics 
} from '@/services/smart-error-handler'

// ============================================================================
// 调试面板组件
// ============================================================================

export function DebugPanel() {
  const [events, setEvents] = useState<DebugEvent[]>([])
  const [diagnosticReport, setDiagnosticReport] = useState<SyncDiagnosticReport | null>(null)
  const [errorStats, setErrorStats] = useState<ErrorStatistics | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState<DebugLevel | 'all'>('all')
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    loadData()
    
    // 订阅调试事件
    const unsubscribe = debugManager.subscribeToEvents((event) => {
      setEvents(prev => [event, ...prev].slice(0, 100)) // 保留最近100条
    })

    // 自动刷新
    let refreshInterval: NodeJS.Timeout
    if (autoRefresh) {
      refreshInterval = setInterval(() => {
        loadData()
      }, 5000) // 每5秒刷新
    }

    return () => {
      unsubscribe()
      if (refreshInterval) clearInterval(refreshInterval)
    }
  }, [autoRefresh])

  const loadData = async () => {
    setIsLoading(true)
    try {
      // 加载调试事件
      const filteredEvents = await debugManager.getEvents()
      setEvents(filteredEvents.slice(0, 100))

      // 加载诊断报告
      const report = await syncDiagnostics.generateDiagnosticReport()
      setDiagnosticReport(report)

      // 加载错误统计
      const stats = getErrorStatistics()
      setErrorStats(stats)
    } catch (error) {
      console.error('Failed to load debug data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredEvents = events.filter(event => 
    selectedLevel === 'all' || event.level === selectedLevel
  )

  const handleExportLogs = async () => {
    try {
      const logs = await debugManager.exportLogs('json')
      const blob = new Blob([logs], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `debug-logs-${new Date().toISOString()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export logs:', error)
    }
  }

  const handleClearLogs = async () => {
    try {
      await debugManager.clearLogs()
      setEvents([])
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }

  return (
    <div className="debug-panel fixed bottom-4 right-4 w-96 max-h-[80vh] bg-white border rounded-lg shadow-lg z-50">
      <Card className="h-full border-0 rounded-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bug className="w-5 h-5" />
              调试诊断面板
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Tabs defaultValue="overview" className="h-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" className="text-xs">
                <Activity className="w-4 h-4 mr-1" />
                概览
              </TabsTrigger>
              <TabsTrigger value="events" className="text-xs">
                <Bug className="w-4 h-4 mr-1" />
                事件
              </TabsTrigger>
              <TabsTrigger value="diagnostics" className="text-xs">
                <BarChart3 className="w-4 h-4 mr-1" />
                诊断
              </TabsTrigger>
              <TabsTrigger value="actions" className="text-xs">
                <Settings className="w-4 h-4 mr-1" />
                操作
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="m-4 space-y-4">
              <SystemOverview 
                diagnosticReport={diagnosticReport}
                errorStats={errorStats}
              />
            </TabsContent>

            <TabsContent value="events" className="m-4 space-y-4">
              <EventList 
                events={filteredEvents}
                selectedLevel={selectedLevel}
                onLevelChange={setSelectedLevel}
                onExportLogs={handleExportLogs}
                onClearLogs={handleClearLogs}
              />
            </TabsContent>

            <TabsContent value="diagnostics" className="m-4 space-y-4">
              <DiagnosticsPanel diagnosticReport={diagnosticReport} />
            </TabsContent>

            <TabsContent value="actions" className="m-4 space-y-4">
              <DebugActions onRefresh={loadData} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// 系统概览组件
// ============================================================================

function SystemOverview({ 
  diagnosticReport, 
  errorStats 
}: { 
  diagnosticReport: SyncDiagnosticReport | null
  errorStats: ErrorStatistics | null
}) {
  if (!diagnosticReport || !errorStats) {
    return (
      <div className="text-center py-8 text-gray-500">
        <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
        <p>正在加载系统状态...</p>
      </div>
    )
  }

  const getHealthColor = (status: SyncHealthStatus) => {
    switch (status) {
      case SyncHealthStatus.HEALTHY: return 'bg-green-100 text-green-800'
      case SyncHealthStatus.WARNING: return 'bg-yellow-100 text-yellow-800'
      case SyncHealthStatus.CRITICAL: return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getHealthIcon = (status: SyncHealthStatus) => {
    switch (status) {
      case SyncHealthStatus.HEALTHY: return <CheckCircle className="w-4 h-4" />
      case SyncHealthStatus.WARNING: return <AlertTriangle className="w-4 h-4" />
      case SyncHealthStatus.CRITICAL: return <AlertTriangle className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-4">
      {/* 健康状态 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium flex items-center gap-2">
              {getHealthIcon(diagnosticReport.overallHealth)}
              系统健康状态
            </h3>
            <Badge className={getHealthColor(diagnosticReport.overallHealth)}>
              {diagnosticReport.overallHealth.toUpperCase()}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">总操作数:</span>
              <span className="ml-2 font-medium">{diagnosticReport.summary.totalOperations}</span>
            </div>
            <div>
              <span className="text-gray-500">成功率:</span>
              <span className="ml-2 font-medium">
                {((diagnosticReport.summary.successfulOperations / diagnosticReport.summary.totalOperations) * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-gray-500">失败操作:</span>
              <span className="ml-2 font-medium text-red-600">{diagnosticReport.summary.failedOperations}</span>
            </div>
            <div>
              <span className="text-gray-500">平均响应:</span>
              <span className="ml-2 font-medium">{diagnosticReport.summary.averageResponseTime.toFixed(0)}ms</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 错误统计 */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            错误统计
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">总错误数:</span>
              <span className="font-medium">{errorStats.totalErrors}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">最近错误:</span>
              <span className="font-medium">{errorStats.recentErrors}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">恢复率:</span>
              <span className="font-medium text-green-600">
                {(errorStats.recoveryRate * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">平均恢复时间:</span>
              <span className="font-medium">{errorStats.averageRecoveryTime.toFixed(0)}ms</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 性能指标 */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium mb-2 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            性能指标
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">平均同步时间:</span>
              <span className="font-medium">{diagnosticReport.performanceMetrics.averageSyncTime.toFixed(0)}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">上传速度:</span>
              <span className="font-medium">{(diagnosticReport.performanceMetrics.averageUploadSpeed / 1024).toFixed(1)}KB/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">下载速度:</span>
              <span className="font-medium">{(diagnosticReport.performanceMetrics.averageDownloadSpeed / 1024).toFixed(1)}KB/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">内存使用:</span>
              <span className="font-medium">{diagnosticReport.performanceMetrics.memoryUsage.toFixed(1)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// 事件列表组件
// ============================================================================

function EventList({ 
  events, 
  selectedLevel, 
  onLevelChange,
  onExportLogs,
  onClearLogs
}: {
  events: DebugEvent[]
  selectedLevel: DebugLevel | 'all'
  onLevelChange: (level: DebugLevel | 'all') => void
  onExportLogs: () => void
  onClearLogs: () => void
}) {
  const getEventColor = (level: DebugLevel) => {
    switch (level) {
      case DebugLevel.ERROR: return 'bg-red-100 text-red-800 border-red-200'
      case DebugLevel.WARN: return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case DebugLevel.INFO: return 'bg-blue-100 text-blue-800 border-blue-200'
      case DebugLevel.DEBUG: return 'bg-gray-100 text-gray-800 border-gray-200'
      case DebugLevel.TRACE: return 'bg-purple-100 text-purple-800 border-purple-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString()
  }

  return (
    <div className="space-y-4">
      {/* 过滤器和操作 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {(['all', ...Object.values(DebugLevel)] as const).map(level => (
            <Button
              key={level}
              variant={selectedLevel === level ? 'default' : 'outline'}
              size="sm"
              onClick={() => onLevelChange(level)}
              className="text-xs h-7"
            >
              {level === 'all' ? '全部' : level.toUpperCase()}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={onExportLogs}>
            <Download className="w-3 h-3 mr-1" />
            导出
          </Button>
          <Button variant="outline" size="sm" onClick={onClearLogs}>
            <Trash2 className="w-3 h-3 mr-1" />
            清空
          </Button>
        </div>
      </div>

      {/* 事件列表 */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            没有找到事件
          </div>
        ) : (
          events.map(event => (
            <Card key={event.id} className="border-l-4" style={{ borderLeftColor: getEventColor(event.level).split(' ')[2] }}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${getEventColor(event.level)}`}>
                      {event.level.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {event.category}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-1">{event.message}</p>
                {event.details && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                      查看详情
                    </summary>
                    <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                      {JSON.stringify(event.details, null, 2)}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

// ============================================================================
// 诊断面板组件
// ============================================================================

function DiagnosticsPanel({ diagnosticReport }: { diagnosticReport: SyncDiagnosticReport | null }) {
  if (!diagnosticReport) {
    return (
      <div className="text-center py-8 text-gray-500">
        <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
        <p>正在加载诊断报告...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 错误分析 */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium mb-3">错误分析</h3>
          <div className="space-y-2">
            {diagnosticReport.errorAnalysis.map((error, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div>
                  <span className="font-medium text-sm">{error.errorType}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({error.count}次, {error.frequency.toFixed(1)}/小时)
                  </span>
                </div>
                <Badge 
                  variant={error.severity === 'critical' ? 'destructive' : 'outline'}
                  className="text-xs"
                >
                  {error.severity}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 建议和警告 */}
      {diagnosticReport.recommendations.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              建议和警告
            </h3>
            <div className="space-y-2">
              {diagnosticReport.recommendations.map((rec, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-sm">{rec.title}</h4>
                    <Badge 
                      variant={rec.priority === 'critical' ? 'destructive' : 'outline'}
                      className="text-xs"
                    >
                      {rec.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{rec.description}</p>
                  <div className="text-xs text-gray-500">
                    <strong>预计影响:</strong> {rec.estimatedImpact}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 紧急问题 */}
      {diagnosticReport.urgentIssues.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-4 h-4" />
              紧急问题
            </h3>
            <div className="space-y-2">
              {diagnosticReport.urgentIssues.map((issue, index) => (
                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-sm text-red-800">{issue.description}</h4>
                    {issue.deadline && (
                      <span className="text-xs text-red-600">
                        截止: {new Date(issue.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-red-700 mb-2">{issue.impact}</p>
                  <div className="text-xs text-red-600 font-medium">
                    建议: {issue.suggestedAction}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================================
// 调试操作组件
// ============================================================================

function DebugActions({ onRefresh }: { onRefresh: () => void }) {
  const [isLoading, setIsLoading] = useState(false)

  const handleAction = async (action: () => Promise<void>) => {
    setIsLoading(true)
    try {
      await action()
    } catch (error) {
      console.error('Action failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 诊断操作 */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium mb-3">诊断操作</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction(async () => {
                await syncDiagnostics.generateDiagnosticReport()
                onRefresh()
              })}
              disabled={isLoading}
            >
              <Activity className="w-4 h-4 mr-1" />
              生成诊断报告
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction(async () => {
                await syncDiagnostics.performHealthCheck()
                onRefresh()
              })}
              disabled={isLoading}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              健康检查
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction(async () => {
                const suggestions = await getPreventiveSuggestions()
                console.log('Preventive suggestions:', suggestions)
              })}
              disabled={isLoading}
            >
              <Settings className="w-4 h-4 mr-1" />
              预防建议
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction(async () => {
                const prediction = await syncDiagnostics.predictPotentialIssues()
                console.log('Error prediction:', prediction)
              })}
              disabled={isLoading}
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              错误预测
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 系统操作 */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium mb-3">系统操作</h3>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => handleAction(async () => {
                // 测试网络连接
                const online = navigator.onLine
                console.log('Network status:', online ? 'Online' : 'Offline')
              })}
              disabled={isLoading}
            >
              <Network className="w-4 h-4 mr-2" />
              测试网络连接
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => handleAction(async () => {
                // 清理缓存
                if ('caches' in window) {
                  const cacheNames = await caches.keys()
                  await Promise.all(cacheNames.map(name => caches.delete(name)))
                }
              })}
              disabled={isLoading}
            >
              <Database className="w-4 h-4 mr-2" />
              清理应用缓存
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                if (confirm('确定要重置调试系统吗？这将清除所有日志和设置。')) {
                  localStorage.clear()
                  location.reload()
                }
              }}
              disabled={isLoading}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              重置调试系统
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 开发者工具 */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium mb-3">开发者工具</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div>
              <strong>控制台命令:</strong>
            </div>
            <div className="bg-gray-50 p-2 rounded font-mono text-xs">
              <div>debug.syncStatus() - 查看同步状态</div>
              <div>debug.errorHistory() - 查看错误历史</div>
              <div>debug.performance() - 性能诊断</div>
              <div>debug.forceSync() - 强制同步</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// 调试面板触发器组件
// ============================================================================

export function DebugPanelTrigger() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* 调试按钮 */}
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-40 bg-white shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bug className="w-4 h-4 mr-1" />
        调试面板
      </Button>

      {/* 调试面板 */}
      {isOpen && <DebugPanel />}
    </>
  )
}