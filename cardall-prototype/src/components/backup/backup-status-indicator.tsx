/**
 * 备份状态指示器组件 (Backup Status Indicator)
 * 
 * 显示系统备份状态的简洁指示器
 */

import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Database,
  RefreshCw
} from 'lucide-react'
import { enhancedLocalBackupService, type BackupStatistics } from '@/services/enhanced-local-backup-service'

interface BackupStatusIndicatorProps {
  className?: string
  showDetails?: boolean
  onRefresh?: () => void
}

export function BackupStatusIndicator({ 
  className, 
  showDetails = false, 
  onRefresh 
}: BackupStatusIndicatorProps) {
  const [statistics, setStatistics] = useState<BackupStatistics | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadStatistics = async () => {
    try {
      setIsLoading(true)
      const stats = await enhancedLocalBackupService.getBackupStatistics()
      setStatistics(stats)
    } catch (error) {
      console.error('Failed to load backup statistics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadStatistics()
  }, [])

  const handleRefresh = () => {
    loadStatistics()
    onRefresh?.()
  }

  const getStatusInfo = () => {
    if (!statistics) {
      return {
        status: 'unknown',
        label: '未知状态',
        color: 'bg-gray-100 text-gray-600',
        icon: <Clock className="h-3 w-3" />,
        description: '无法获取备份状态'
      }
    }

    const hasIssues = statistics.integrityIssues > 0
    const hasRecentBackup = statistics.lastBackupTime && 
      (Date.now() - statistics.lastBackupTime.getTime()) < 24 * 60 * 60 * 1000 // 24小时内

    if (hasIssues) {
      return {
        status: 'warning',
        label: '数据问题',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        icon: <AlertTriangle className="h-3 w-3" />,
        description: `发现 ${statistics.integrityIssues} 个数据完整性问题`
      }
    }

    if (!hasRecentBackup) {
      return {
        status: 'warning',
        label: '需要备份',
        color: 'bg-orange-100 text-orange-700 border-orange-200',
        icon: <Clock className="h-3 w-3" />,
        description: '超过24小时未备份'
      }
    }

    return {
      status: 'healthy',
      label: '数据安全',
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: <CheckCircle className="h-3 w-3" />,
      description: '数据备份正常，无完整性问题'
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatRelativeTime = (date: Date): string => {
    const now = Date.now()
    const diff = now - date.getTime()
    
    if (diff < 60 * 1000) {
      return '刚刚'
    } else if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000))
      return `${minutes}分钟前`
    } else if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000))
      return `${hours}小时前`
    } else {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000))
      return `${days}天前`
    }
  }

  const statusInfo = getStatusInfo()

  const compactView = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`${statusInfo.color} cursor-pointer hover:opacity-80 transition-opacity ${className}`}
          >
            {statusInfo.icon}
            <span className="ml-1 text-xs">{statusInfo.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm space-y-1">
            <div className="font-medium">{statusInfo.description}</div>
            {statistics && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div>总备份数: {statistics.totalBackups}</div>
                <div>存储使用: {formatFileSize(statistics.storageUsage)}</div>
                {statistics.lastBackupTime && (
                  <div>最后备份: {formatRelativeTime(statistics.lastBackupTime)}</div>
                )}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  const detailedView = (
    <div className={`space-y-4 ${className}`}>
      {/* 状态概览 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className={statusInfo.color}>
            {statusInfo.icon}
            <span className="ml-1">{statusInfo.label}</span>
          </Badge>
          <span className="text-sm text-muted-foreground">
            {statusInfo.description}
          </span>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-3 bg-muted rounded-lg">
            <Database className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-semibold">{statistics.totalBackups}</div>
            <div className="text-xs text-muted-foreground">总备份</div>
          </div>
          
          <div className="text-center p-3 bg-muted rounded-lg">
            <Shield className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-semibold">{statistics.integrityIssues}</div>
            <div className="text-xs text-muted-foreground">问题数</div>
          </div>
          
          <div className="text-center p-3 bg-muted rounded-lg">
            <Database className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-semibold">{formatFileSize(statistics.storageUsage)}</div>
            <div className="text-xs text-muted-foreground">存储使用</div>
          </div>
          
          <div className="text-center p-3 bg-muted rounded-lg">
            <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-semibold">
              {statistics.lastBackupTime ? formatRelativeTime(statistics.lastBackupTime) : '无'}
            </div>
            <div className="text-xs text-muted-foreground">最后备份</div>
          </div>
        </div>
      )}

      {/* 健康检查建议 */}
      {statistics && (
        <div className="space-y-2">
          <div className="text-sm font-medium">健康状态</div>
          
          {statistics.integrityIssues > 0 && (
            <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
              <AlertTriangle className="h-4 w-4" />
              <span>发现 {statistics.integrityIssues} 个数据完整性问题，建议运行检查</span>
            </div>
          )}
          
          {statistics.lastBackupTime && 
           (Date.now() - statistics.lastBackupTime.getTime()) > 24 * 60 * 60 * 1000 && (
            <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 p-2 rounded">
              <Clock className="h-4 w-4" />
              <span>超过24小时未备份，建议创建新备份</span>
            </div>
          )}
          
          {statistics.storageUsage > statistics.storageQuota * 0.8 && (
            <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 p-2 rounded">
              <Database className="h-4 w-4" />
              <span>存储使用量超过80%，建议清理旧备份</span>
            </div>
          )}
          
          {statistics.integrityIssues === 0 && 
           statistics.lastBackupTime && 
           (Date.now() - statistics.lastBackupTime.getTime()) < 24 * 60 * 60 * 1000 &&
           statistics.storageUsage < statistics.storageQuota * 0.8 && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
              <CheckCircle className="h-4 w-4" />
              <span>系统状态良好，数据安全</span>
            </div>
          )}
        </div>
      )}
    </div>
  )

  return showDetails ? detailedView : compactView
}