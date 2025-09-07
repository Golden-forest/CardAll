import React, { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Loader2 
} from 'lucide-react'
import { cloudSyncService } from '@/services/cloud-sync'
import { authService } from '@/services/auth'
import { useToast } from '@/hooks/use-toast'

interface SyncStatusIndicatorProps {
  className?: string
}

export function SyncStatusIndicator({ className }: SyncStatusIndicatorProps) {
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const { toast } = useToast()

  // 监听同步状态
  useEffect(() => {
    const unsubscribe = cloudSyncService.onStatusChange((status) => {
      setSyncStatus(status)
      if (status.lastSyncTime) {
        setLastSyncTime(new Date(status.lastSyncTime))
      }
    })

    return unsubscribe
  }, [])

  // 手动同步
  const handleManualSync = async () => {
    if (!authService.isAuthenticated()) {
      toast({
        title: "同步失败",
        description: "请先登录账户",
        variant: "destructive"
      })
      return
    }

    setIsSyncing(true)
    try {
      await cloudSyncService.performFullSync()
      toast({
        title: "同步完成",
        description: "数据已成功同步到云端"
      })
    } catch (error) {
      toast({
        title: "同步失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive"
      })
    } finally {
      setIsSyncing(false)
    }
  }

  if (!syncStatus) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">加载中...</span>
      </div>
    )
  }

  const getStatusIcon = () => {
    if (!syncStatus.isOnline) {
      return <CloudOff className="h-4 w-4 text-destructive" />
    }
    
    if (syncStatus.syncInProgress || isSyncing) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    }
    
    if (syncStatus.pendingOperations > 0) {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
    
    return <CheckCircle className="h-4 w-4 text-green-500" />
  }

  const getStatusText = () => {
    if (!syncStatus.isOnline) {
      return "离线"
    }
    
    if (syncStatus.syncInProgress || isSyncing) {
      return "同步中..."
    }
    
    if (syncStatus.pendingOperations > 0) {
      return `待同步 (${syncStatus.pendingOperations})`
    }
    
    return "已同步"
  }

  const getStatusVariant = () => {
    if (!syncStatus.isOnline) {
      return "destructive"
    }
    
    if (syncStatus.syncInProgress || isSyncing) {
      return "default"
    }
    
    if (syncStatus.pendingOperations > 0) {
      return "secondary"
    }
    
    return "default"
  }

  const formatLastSyncTime = () => {
    if (!lastSyncTime) return "从未同步"
    
    const now = new Date()
    const diff = now.getTime() - lastSyncTime.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return "刚刚"
    if (minutes < 60) return `${minutes}分钟前`
    
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}小时前`
    
    const days = Math.floor(hours / 24)
    return `${days}天前`
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* 状态图标和文字 */}
      <div className="flex items-center gap-1">
        {getStatusIcon()}
        <Badge variant={getStatusVariant() as any} className="text-xs">
          {getStatusText()}
        </Badge>
      </div>
      
      {/* 最后同步时间 */}
      {syncStatus.isOnline && lastSyncTime && (
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {formatLastSyncTime()}
        </span>
      )}
      
      {/* 手动同步按钮 */}
      {syncStatus.isOnline && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleManualSync}
          disabled={isSyncing || syncStatus.syncInProgress}
          className="h-6 w-6 p-0"
        >
          <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
        </Button>
      )}
    </div>
  )
}