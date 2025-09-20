import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Cloud
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { unifiedSyncService } from '@/services/core/sync/unified-sync.service'
import { SyncStatusDisplay } from './sync-status-display'

interface SyncStatusIndicatorProps {
  className?: string
  showLabel?: boolean
  showDetails?: boolean
  onSync?: () => void
}

interface SyncStatus {
  isOnline: boolean
  isSyncing: boolean
  hasConflicts: boolean
  pendingOperations: number
  lastSyncTime: Date | null
  conflicts: any[]
}

export function SyncStatusIndicator({
  className,
  showLabel = true,
  showDetails = true,
  onSync
}: SyncStatusIndicatorProps) {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: true,
    isSyncing: false,
    hasConflicts: false,
    pendingOperations: 0,
    lastSyncTime: null,
    conflicts: []
  })

  // 监听网络状态
  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }))
    }
    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // 初始化状态
    setStatus(prev => ({ ...prev, isOnline: navigator.onLine }))

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 监听同步状态
  useEffect(() => {
    const updateStatus = async () => {
      try {
        const syncStatus = unifiedSyncService.getStatus()
        setStatus(prev => ({
          ...prev,
          isSyncing: syncStatus.isSyncing,
          hasConflicts: syncStatus.hasConflicts,
          pendingOperations: syncStatus.pendingOperations || 0,
          lastSyncTime: syncStatus.lastSyncTime ? new Date(syncStatus.lastSyncTime) : null,
          conflicts: syncStatus.conflicts || []
        }))
      } catch (error) {
        console.error('Failed to update sync status:', error)
      }
    }

    // 立即更新一次
    updateStatus()

    // 每3秒更新一次状态
    const interval = setInterval(updateStatus, 3000)

    // 监听同步服务事件
    const handleSyncStart = () => {
      setStatus(prev => ({ ...prev, isSyncing: true }))
    }

    const handleSyncComplete = () => {
      setStatus(prev => ({ ...prev, isSyncing: false }))
      updateStatus()
    }

    const handleSyncError = () => {
      setStatus(prev => ({ ...prev, isSyncing: false }))
    }

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

  // 获取状态颜色
  const getStatusColor = () => {
    if (!status.isOnline) return 'text-red-500'
    if (status.isSyncing) return 'text-yellow-500 animate-pulse'
    if (status.hasConflicts) return 'text-orange-500'
    return 'text-green-500'
  }

  // 获取状态图标
  const getStatusIcon = () => {
    if (!status.isOnline) return <WifiOff className="h-4 w-4" />
    if (status.isSyncing) return <RefreshCw className="h-4 w-4 animate-spin" />
    if (status.hasConflicts) return <AlertTriangle className="h-4 w-4" />
    return <Wifi className="h-4 w-4" />
  }

  // 获取状态文本
  const getStatusText = () => {
    if (!status.isOnline) return '离线'
    if (status.isSyncing) return '同步中...'
    if (status.hasConflicts) return '有冲突'
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

  // 处理手动同步
  const handleManualSync = async () => {
    if (onSync) {
      onSync()
      return
    }

    try {
      await unifiedSyncService.sync({
        type: 'incremental',
        direction: 'bidirectional'
      })
    } catch (error) {
      console.error('Manual sync failed:', error)
    }
  }

  // 紧凑模式显示
  const CompactView = () => (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("flex items-center gap-1", getStatusColor())}>
        {getStatusIcon()}
        {showLabel && <span className="text-sm">{getStatusText()}</span>}
      </div>

      {status.pendingOperations > 0 && (
        <Badge variant="secondary" className="text-xs">
          {status.pendingOperations}
        </Badge>
      )}

      {status.conflicts.length > 0 && (
        <Badge variant="destructive" className="text-xs">
          {status.conflicts.length}
        </Badge>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleManualSync}
        disabled={status.isSyncing || !status.isOnline}
        className="h-6 w-6 p-0"
      >
        <RefreshCw className={cn("h-3 w-3", status.isSyncing && "animate-spin")} />
      </Button>
    </div>
  )

  // 详细模式显示（带弹出框）
  const DetailedView = () => (
    <Popover>
      <PopoverTrigger asChild>
        <div className={cn("flex items-center gap-2 cursor-pointer hover:bg-accent rounded-md p-2", className)}>
          <div className={cn("flex items-center gap-1", getStatusColor())}>
            {getStatusIcon()}
            {showLabel && <span className="text-sm font-medium">{getStatusText()}</span>}
          </div>

          {status.pendingOperations > 0 && (
            <Badge variant="outline" className="text-xs">
              {status.pendingOperations} 待同步
            </Badge>
          )}

          {status.conflicts.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {status.conflicts.length} 冲突
            </Badge>
          )}

          <span className="text-xs text-muted-foreground">
            {formatTime(status.lastSyncTime)}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              handleManualSync()
            }}
            disabled={status.isSyncing || !status.isOnline}
            className="h-6 w-6 p-0 ml-auto"
          >
            <RefreshCw className={cn("h-3 w-3", status.isSyncing && "animate-spin")} />
          </Button>
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0" align="end">
        <SyncStatusDisplay showDetails={true} compact={false} />
      </PopoverContent>
    </Popover>
  )

  return showDetails ? <DetailedView /> : <CompactView />
}

// 导出状态类型供其他组件使用
export type { SyncStatus }