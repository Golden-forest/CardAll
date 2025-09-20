import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Server,
  Database,
  Cloud,
  Pause,
  Play
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { unifiedSyncService } from '@/services/core/sync/unified-sync.service'
import { performanceMonitor } from '@/services/ui/performance-monitor'

interface SyncStatusDisplayProps {
  className?: string
  showDetails?: boolean
  compact?: boolean
}

interface SyncOperation {
  id: string
  type: 'upload' | 'download' | 'conflict_resolution' | 'merge'
  entity: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  progress: number
  startTime: Date
  endTime?: Date
  error?: string
  details?: string
}

interface SyncMetrics {
  lastSyncTime: Date | null
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  averageSyncTime: number
  networkLatency: number
  serverResponseTime: number
  dataTransferRate: number
}

export function SyncStatusDisplay({
  className,
  showDetails = false,
  compact = false
}: SyncStatusDisplayProps) {
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [operations, setOperations] = useState<SyncOperation[]>([])
  const [metrics, setMetrics] = useState<SyncMetrics>({
    lastSyncTime: null,
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageSyncTime: 0,
    networkLatency: 0,
    serverResponseTime: 0,
    dataTransferRate: 0
  })
  const [expanded, setExpanded] = useState(false)

  // 监听网络状态
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // 初始化网络状态
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 监听同步状态
  useEffect(() => {
    const updateSyncStatus = async () => {
      try {
        const status = unifiedSyncService.getStatus()
        setSyncStatus(status)
        setIsSyncing(status.isSyncing)

        // 更新指标
        if (status.lastSyncTime) {
          setMetrics(prev => ({
            ...prev,
            lastSyncTime: new Date(status.lastSyncTime),
            totalOperations: status.totalSyncs || 0,
            successfulOperations: status.successfulSyncs || 0,
            failedOperations: status.failedSyncs || 0
          }))
        }

        // 更新性能指标
        const perfMetrics = performanceMonitor.getRealtimeMetrics()
        setMetrics(prev => ({
          ...prev,
          networkLatency: perfMetrics.networkLatency || 0
        }))
      } catch (error) {
        console.error('Failed to update sync status:', error)
      }
    }

    // 立即更新一次
    updateSyncStatus()

    // 每2秒更新一次状态
    const interval = setInterval(updateSyncStatus, 2000)

    // 监听同步服务事件
    const handleSyncStart = () => {
      setIsSyncing(true)
      addOperation({
        type: 'upload',
        entity: '批量同步',
        status: 'in_progress',
        progress: 0,
        startTime: new Date()
      })
    }

    const handleSyncComplete = () => {
      setIsSyncing(false)
      updateOperationStatus('completed')
      updateSyncStatus()
    }

    const handleSyncError = (error: any) => {
      setIsSyncing(false)
      updateOperationStatus('failed', error.message)
    }

    // 注册事件监听器
    unifiedSyncService.on('sync:start', handleSyncStart)
    unifiedSyncService.on('sync:complete', handleSyncComplete)
    unifiedSyncService.on('sync:error', handleSyncError)

    return () => {
      clearInterval(interval)
      unifiedSyncService.off('sync:start', handleSyncStart)
      unifiedSyncService.off('sync:complete', handleSyncComplete)
      unifiedSyncService.off('sync:error', handleSyncError)
    }
  }, [])

  // 添加同步操作
  const addOperation = (operation: Omit<SyncOperation, 'id'>) => {
    const newOperation: SyncOperation = {
      ...operation,
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    setOperations(prev => [newOperation, ...prev.slice(0, 9)]) // 保留最近10个操作

    // 更新指标
    setMetrics(prev => ({
      ...prev,
      totalOperations: prev.totalOperations + 1
    }))
  }

  // 更新操作状态
  const updateOperationStatus = (status: SyncOperation['status'], error?: string) => {
    setOperations(prev =>
      prev.map(op =>
        op.status === 'in_progress'
          ? {
              ...op,
              status,
              endTime: new Date(),
              error,
              progress: status === 'completed' ? 100 : op.progress
            }
          : op
      )
    )

    // 更新成功/失败计数
    if (status === 'completed') {
      setMetrics(prev => ({
        ...prev,
        successfulOperations: prev.successfulOperations + 1
      }))
    } else if (status === 'failed') {
      setMetrics(prev => ({
        ...prev,
        failedOperations: prev.failedOperations + 1
      }))
    }
  }

  // 手动触发同步
  const handleManualSync = async () => {
    try {
      setIsSyncing(true)
      await unifiedSyncService.sync({
        type: 'incremental',
        direction: 'bidirectional'
      })
    } catch (error) {
      console.error('Manual sync failed:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  // 获取状态颜色
  const getStatusColor = () => {
    if (!isOnline) return 'text-red-500'
    if (isSyncing) return 'text-yellow-500 animate-pulse'
    if (syncStatus?.hasConflicts) return 'text-orange-500'
    return 'text-green-500'
  }

  // 获取状态图标
  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="h-4 w-4" />
    if (isSyncing) return <RefreshCw className="h-4 w-4 animate-spin" />
    if (syncStatus?.hasConflicts) return <AlertTriangle className="h-4 w-4" />
    return <Wifi className="h-4 w-4" />
  }

  // 获取状态文本
  const getStatusText = () => {
    if (!isOnline) return '离线'
    if (isSyncing) return '同步中...'
    if (syncStatus?.hasConflicts) return '需要解决冲突'
    return '已同步'
  }

  // 格式化时间
  const formatTime = (date: Date | null) => {
    if (!date) return '从未'
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (minutes < 1440) return `${Math.floor(minutes / 60)}小时前`
    return `${Math.floor(minutes / 1440)}天前`
  }

  // 计算成功率
  const successRate = metrics.totalOperations > 0
    ? (metrics.successfulOperations / metrics.totalOperations * 100).toFixed(1)
    : '0.0'

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <div className={cn("flex items-center gap-1", getStatusColor())}>
          {getStatusIcon()}
          <span>{getStatusText()}</span>
        </div>
        {syncStatus?.pendingOperations > 0 && (
          <Badge variant="secondary" className="text-xs">
            {syncStatus.pendingOperations} 待同步
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleManualSync}
          disabled={isSyncing || !isOnline}
        >
          <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
        </Button>
      </div>
    )
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">同步状态</CardTitle>
            <div className={cn("flex items-center gap-1 text-sm", getStatusColor())}>
              {getStatusIcon()}
              <span>{getStatusText()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {syncStatus?.pendingOperations > 0 && (
              <Badge variant="outline">
                {syncStatus.pendingOperations} 待同步
              </Badge>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
              立即同步
            </Button>

            {showDetails && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? '收起' : '详情'}
              </Button>
            )}
          </div>
        </div>

        {/* 基本状态信息 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">网络状态:</span>
            <span className="ml-2 font-medium">{isOnline ? '在线' : '离线'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">最后同步:</span>
            <span className="ml-2 font-medium">{formatTime(metrics.lastSyncTime)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">成功率:</span>
            <span className="ml-2 font-medium">{successRate}%</span>
          </div>
          <div>
            <span className="text-muted-foreground">延迟:</span>
            <span className="ml-2 font-medium">{metrics.networkLatency}ms</span>
          </div>
        </div>

        {/* 同步进度 */}
        {isSyncing && operations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>同步进度</span>
              <span>{operations.find(op => op.status === 'in_progress')?.progress || 0}%</span>
            </div>
            <Progress
              value={operations.find(op => op.status === 'in_progress')?.progress || 0}
              className="h-2"
            />
          </div>
        )}
      </CardHeader>

      {expanded && showDetails && (
        <CardContent className="space-y-4">
          <Separator />

          {/* 详细指标 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">操作统计</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>总操作数:</span>
                    <span>{metrics.totalOperations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>成功:</span>
                    <span className="text-green-600">{metrics.successfulOperations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>失败:</span>
                    <span className="text-red-600">{metrics.failedOperations}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Server className="h-4 w-4 text-green-500" />
                  <span className="font-medium">性能指标</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>平均同步时间:</span>
                    <span>{metrics.averageSyncTime}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>服务器响应:</span>
                    <span>{metrics.serverResponseTime}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>传输速率:</span>
                    <span>{metrics.dataTransferRate}KB/s</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Cloud className="h-4 w-4 text-purple-500" />
                  <span className="font-medium">同步状态</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>待同步操作:</span>
                    <span>{syncStatus?.pendingOperations || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>冲突数量:</span>
                    <span>{syncStatus?.conflicts?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>同步模式:</span>
                    <span>自动</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 最近操作记录 */}
          <div>
            <h4 className="font-medium mb-2">最近操作</h4>
            <ScrollArea className="h-48 border rounded-md p-2">
              <div className="space-y-2">
                {operations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    暂无操作记录
                  </p>
                ) : (
                  operations.map((operation) => (
                    <div key={operation.id} className="flex items-center justify-between text-sm p-2 rounded border">
                      <div className="flex items-center gap-2">
                        {operation.status === 'completed' && <CheckCircle className="h-3 w-3 text-green-500" />}
                        {operation.status === 'failed' && <XCircle className="h-3 w-3 text-red-500" />}
                        {operation.status === 'in_progress' && <Clock className="h-3 w-3 text-yellow-500 animate-spin" />}
                        {operation.status === 'pending' && <Clock className="h-3 w-3 text-gray-500" />}
                        <span>{operation.entity}</span>
                        <Badge variant="outline" className="text-xs">
                          {operation.type === 'upload' ? '上传' :
                           operation.type === 'download' ? '下载' :
                           operation.type === 'conflict_resolution' ? '冲突解决' : '合并'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {operation.status === 'in_progress' && (
                          <Progress value={operation.progress} className="w-16 h-1" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatTime(operation.startTime)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// 导出子组件供其他地方使用
export { SyncOperation, SyncMetrics }