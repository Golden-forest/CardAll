import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Wifi,
  WifiOff
} from 'lucide-react'
import { cloudSyncService } from '@/services/cloud-sync'

interface SyncStatus {
  isOnline: boolean
  lastSyncTime: Date | null
  pendingOperations: number
  syncInProgress: boolean
  hasConflicts: boolean
}
import { authService, type AuthState } from '@/services/auth'

export function SyncStatusIndicator() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    lastSyncTime: null,
    pendingOperations: 0,
    syncInProgress: false,
    hasConflicts: false
  })
  
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: false,
    error: null
  })

  useEffect(() => {
    const unsubscribeSync = cloudSyncService.onStatusChange(setSyncStatus)
    const unsubscribeAuth = authService.onAuthStateChange(setAuthState)
    
    return () => {
      unsubscribeSync()
      unsubscribeAuth()
    }
  }, [])

  const handleManualSync = async () => {
    if (authState.user && syncStatus.isOnline) {
      await cloudSyncService.performFullSync()
    }
  }

  const getStatusIcon = () => {
    if (!syncStatus.isOnline) {
      return <WifiOff className="h-4 w-4 text-red-500" />
    }
    
    if (!authState.user) {
      return <CloudOff className="h-4 w-4 text-gray-500" />
    }
    
    if (syncStatus.syncInProgress) {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    }
    
    if (syncStatus.hasConflicts) {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
    
    if (syncStatus.pendingOperations > 0) {
      return <RefreshCw className="h-4 w-4 text-orange-500" />
    }
    
    return <CheckCircle className="h-4 w-4 text-green-500" />
  }

  const getStatusText = () => {
    if (!syncStatus.isOnline) {
      return '离线'
    }
    
    if (!authState.user) {
      return '未登录'
    }
    
    if (syncStatus.syncInProgress) {
      return '同步中'
    }
    
    if (syncStatus.hasConflicts) {
      return '有冲突'
    }
    
    if (syncStatus.pendingOperations > 0) {
      return `待同步 ${syncStatus.pendingOperations}`
    }
    
    return '已同步'
  }

  const getStatusVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    if (!syncStatus.isOnline) return 'destructive'
    if (!authState.user) return 'secondary'
    if (syncStatus.hasConflicts) return 'destructive'
    if (syncStatus.pendingOperations > 0) return 'outline'
    return 'default'
  }

  const formatLastSyncTime = (time: Date | null) => {
    if (!time) return '从未同步'
    
    const now = new Date()
    const diff = now.getTime() - time.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return '刚刚同步'
    if (minutes < 60) return `${minutes}分钟前`
    
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}小时前`
    
    const days = Math.floor(hours / 24)
    return `${days}天前`
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          {getStatusIcon()}
          <span className="ml-1 text-xs">{getStatusText()}</span>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">同步状态</h4>
            <Badge variant={getStatusVariant()}>
              {getStatusText()}
            </Badge>
          </div>
          
          <div className="space-y-3">
            {/* 网络状态 */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {syncStatus.isOnline ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span>网络状态</span>
              </div>
              <span className={syncStatus.isOnline ? 'text-green-600' : 'text-red-600'}>
                {syncStatus.isOnline ? '在线' : '离线'}
              </span>
            </div>
            
            {/* 登录状态 */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {authState.user ? (
                  <Cloud className="h-4 w-4 text-blue-500" />
                ) : (
                  <CloudOff className="h-4 w-4 text-gray-500" />
                )}
                <span>云端同步</span>
              </div>
              <span className={authState.user ? 'text-blue-600' : 'text-gray-600'}>
                {authState.user ? '已启用' : '未启用'}
              </span>
            </div>
            
            {/* 待同步操作 */}
            {syncStatus.pendingOperations > 0 && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-orange-500" />
                  <span>待同步操作</span>
                </div>
                <span className="text-orange-600">
                  {syncStatus.pendingOperations} 项
                </span>
              </div>
            )}
            
            {/* 冲突状态 */}
            {syncStatus.hasConflicts && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <span>数据冲突</span>
                </div>
                <span className="text-yellow-600">需要处理</span>
              </div>
            )}
            
            {/* 最后同步时间 */}
            <div className="flex items-center justify-between text-sm">
              <span>最后同步</span>
              <span className="text-muted-foreground">
                {formatLastSyncTime(syncStatus.lastSyncTime)}
              </span>
            </div>
            
            {/* 同步进度 */}
            {syncStatus.syncInProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>同步进度</span>
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <Progress value={75} className="h-2" />
              </div>
            )}
          </div>
          
          {/* 操作按钮 */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              onClick={handleManualSync}
              disabled={!authState.user || !syncStatus.isOnline || syncStatus.syncInProgress}
              size="sm"
              className="flex-1"
            >
              {syncStatus.syncInProgress ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              立即同步
            </Button>
            
            {!authState.user && (
              <Button
                onClick={() => {/* 打开登录对话框 */}}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Cloud className="h-4 w-4 mr-2" />
                登录
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}