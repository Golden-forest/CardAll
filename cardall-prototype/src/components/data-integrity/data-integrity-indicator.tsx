import React, { useState, useEffect } from 'react'
import { DataIntegrityService } from '@/services/data-integrity-service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  MoreVertical
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface DataIntegrityIndicatorProps {
  className?: string
  showDetails?: boolean
}

export function DataIntegrityIndicator({ className, showDetails = false }: DataIntegrityIndicatorProps) {
  const [service] = useState(() => new DataIntegrityService())
  const [status, setStatus] = useState<{
    lastCheck: Date | null
    status: 'passed' | 'warning' | 'failed' | 'unknown'
    issuesCount: number
    backgroundEnabled: boolean
  }>({
    lastCheck: null,
    status: 'unknown',
    issuesCount: 0,
    backgroundEnabled: true
  })
  const [isChecking, setIsChecking] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    try {
      setIsLoading(true)
      const serviceStatus = await service.getServiceStatus()
      const history = await service.getHistory()

      const lastCheck = history.length > 0 ? new Date(history[0].timestamp) : null
      const lastResult = history.length > 0 ? history[0] : null

      setStatus({
        lastCheck,
        status: lastResult?.status || 'unknown',
        issuesCount: lastResult?.issues?.length || 0,
        backgroundEnabled: serviceStatus.backgroundValidationEnabled
      })
    } catch (error) {
      console.error('加载数据完整性状态失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const runQuickCheck = async () => {
    setIsChecking(true)
    try {
      const result = await service.runManualCheck(false)
      setStatus(prev => ({
        ...prev,
        lastCheck: new Date(result.timestamp),
        status: result.status,
        issuesCount: result.issues.length
      }))

      toast({
        title: "快速检查完成",
        description: result.status === 'passed'
          ? "数据完整性良好"
          : `发现 ${result.issues.length} 个问题`,
      })
    } catch (error) {
      toast({
        title: "检查失败",
        description: "无法完成数据完整性检查",
        variant: "destructive",
      })
    } finally {
      setIsChecking(false)
    }
  }

  const getStatusIcon = () => {
    if (isLoading) {
      return <RefreshCw className="h-4 w-4 animate-spin" />
    }

    switch (status.status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Shield className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = () => {
    switch (status.status) {
      case 'passed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusText = () => {
    if (isLoading) return '检查中...'

    switch (status.status) {
      case 'passed':
        return '正常'
      case 'warning':
        return '警告'
      case 'failed':
        return '异常'
      default:
        return '未知'
    }
  }

  const getTimeSinceLastCheck = () => {
    if (!status.lastCheck) return '从未检查'

    const now = new Date()
    const diff = now.getTime() - status.lastCheck.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes} 分钟前`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} 小时前`

    const days = Math.floor(hours / 24)
    return `${days} 天前`
  }

  if (showDetails) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium">数据完整性</span>
          <Badge variant="outline" className={getStatusColor()}>
            {getStatusText()}
          </Badge>
          {status.issuesCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {status.issuesCount}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {getTimeSinceLastCheck()}
          {status.backgroundEnabled && (
            <span className="ml-2">• 后台检查已启用</span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={runQuickCheck}
          disabled={isChecking || isLoading}
        >
          {isChecking ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      </div>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={className}>
          {getStatusIcon()}
          {status.issuesCount > 0 && (
            <Badge variant="destructive" className="ml-1 text-xs">
              {status.issuesCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="font-medium">数据完整性</span>
            </div>
            <Badge variant="outline" className={getStatusColor()}>
              {getStatusText()}
            </Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>状态:</span>
              <span className="font-medium">{getStatusText()}</span>
            </div>
            {status.issuesCount > 0 && (
              <div className="flex justify-between">
                <span>问题数量:</span>
                <span className="font-medium text-red-600">{status.issuesCount}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>最后检查:</span>
              <span>{getTimeSinceLastCheck()}</span>
            </div>
            <div className="flex justify-between">
              <span>后台检查:</span>
              <span>{status.backgroundEnabled ? '已启用' : '已禁用'}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              onClick={runQuickCheck}
              disabled={isChecking || isLoading}
              className="flex-1"
            >
              {isChecking ? (
                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              快速检查
            </Button>
            <Button size="sm" variant="outline" onClick={loadStatus}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}