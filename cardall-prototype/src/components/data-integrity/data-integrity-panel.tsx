import React, { useState, useEffect } from 'react'
import { DataIntegrityService, IntegrityCheckResult, IntegrityIssue } from '@/services/data-integrity-service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  RefreshCw,
  Clock,
  Database,
  Activity,
  Zap
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from '@/hooks/use-toast'

interface DataIntegrityPanelProps {
  className?: string
}

export function DataIntegrityPanel({ className }: DataIntegrityPanelProps) {
  const [service] = useState(() => new DataIntegrityService())
  const [isChecking, setIsChecking] = useState(false)
  const [lastResult, setLastResult] = useState<IntegrityCheckResult | null>(null)
  const [serviceStatus, setServiceStatus] = useState<any>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [checkHistory, setCheckHistory] = useState<any[]>([])
  const { toast } = useToast()

  useEffect(() => {
    // 初始化时获取服务状态和历史记录
    loadServiceStatus()
    loadCheckHistory()
  }, [])

  const loadServiceStatus = async () => {
    try {
      const status = await service.getServiceStatus()
      setServiceStatus(status)
    } catch (error) {
      console.error('加载服务状态失败:', error)
    }
  }

  const loadCheckHistory = async () => {
    try {
      const history = await service.getHistory()
      setCheckHistory(history.slice(0, 10)) // 只显示最近10条记录
    } catch (error) {
      console.error('加载检查历史失败:', error)
    }
  }

  const runManualCheck = async (force = false) => {
    setIsChecking(true)
    try {
      const result = await service.runManualCheck(force)
      setLastResult(result)
      await loadServiceStatus()
      await loadCheckHistory()

      // 显示通知
      if (result.status === 'passed') {
        toast({
          title: "数据完整性检查完成",
          description: "所有检查都通过了，数据状态良好。",
        })
      } else if (result.status === 'warning') {
        toast({
          title: "数据完整性检查完成",
          description: `发现 ${result.issues.length} 个警告，请查看详情。`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "数据完整性检查完成",
          description: `发现 ${result.issues.length} 个严重问题，建议立即修复。`,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "检查失败",
        description: "数据完整性检查执行失败，请稍后重试。",
        variant: "destructive",
      })
    } finally {
      setIsChecking(false)
    }
  }

  const toggleBackgroundValidation = async (enabled: boolean) => {
    try {
      if (enabled) {
        await service.enableBackgroundValidation()
        toast({
          title: "后台验证已启用",
          description: "系统将自动在后台进行数据完整性检查。",
        })
      } else {
        await service.disableBackgroundValidation()
        toast({
          title: "后台验证已禁用",
          description: "后台数据完整性检查已停止。",
        })
      }
      await loadServiceStatus()
    } catch (error) {
      toast({
        title: "操作失败",
        description: "无法更改后台验证状态。",
        variant: "destructive",
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'low':
        return <Badge variant="secondary">低</Badge>
      case 'medium':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800">中</Badge>
      case 'high':
        return <Badge variant="destructive">高</Badge>
      case 'critical':
        return <Badge variant="destructive" className="bg-red-600">严重</Badge>
      default:
        return <Badge variant="outline">未知</Badge>
    }
  }

  return (
    <div className={className}>
      {/* 状态卡片 */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            数据完整性状态
          </CardTitle>
          <div className="flex items-center gap-2">
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>数据完整性设置</DialogTitle>
                  <DialogDescription>
                    配置数据完整性检查的行为和通知设置。
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">后台检查</label>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-muted-foreground">
                        {serviceStatus?.backgroundValidationEnabled ? '已启用' : '已禁用'}
                      </span>
                      <Button
                        size="sm"
                        variant={serviceStatus?.backgroundValidationEnabled ? "destructive" : "default"}
                        onClick={() => toggleBackgroundValidation(!serviceStatus?.backgroundValidationEnabled)}
                      >
                        {serviceStatus?.backgroundValidationEnabled ? '禁用' : '启用'}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">检查间隔</label>
                    <p className="text-sm text-muted-foreground mt-1">
                      每 {Math.round((serviceStatus?.backgroundCheckInterval || 0) / 60000)} 分钟
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              onClick={() => runManualCheck(true)}
              disabled={isChecking}
              size="sm"
            >
              {isChecking ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
              {isChecking ? '检查中...' : '立即检查'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {serviceStatus && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{serviceStatus.totalChecks || 0}</div>
                <div className="text-xs text-muted-foreground">总检查次数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{serviceStatus.passedChecks || 0}</div>
                <div className="text-xs text-muted-foreground">通过检查</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{serviceStatus.warningChecks || 0}</div>
                <div className="text-xs text-muted-foreground">警告次数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{serviceStatus.failedChecks || 0}</div>
                <div className="text-xs text-muted-foreground">失败次数</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 最后检查结果 */}
      {lastResult && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(lastResult.status)}
              最后检查结果
              <Badge variant="outline" className={getStatusColor(lastResult.status)}>
                {lastResult.status === 'passed' && '通过'}
                {lastResult.status === 'warning' && '警告'}
                {lastResult.status === 'failed' && '失败'}
              </Badge>
            </CardTitle>
            <CardDescription>
              检查时间: {new Date(lastResult.timestamp).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* 统计信息 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-lg font-semibold">{lastResult.stats.totalEntities}</div>
                <div className="text-xs text-muted-foreground">检查实体</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-yellow-600">{lastResult.stats.warningIssues}</div>
                <div className="text-xs text-muted-foreground">警告问题</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-red-600">{lastResult.stats.criticalIssues}</div>
                <div className="text-xs text-muted-foreground">严重问题</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{lastResult.stats.orphanedEntities}</div>
                <div className="text-xs text-muted-foreground">孤立实体</div>
              </div>
            </div>

            {/* 问题列表 */}
            {lastResult.issues.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3">发现的问题</h4>
                <div className="space-y-2">
                  {lastResult.issues.map((issue: IntegrityIssue, index: number) => (
                    <Alert key={index} className="border-l-4 border-l-yellow-400">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getSeverityBadge(issue.severity)}
                            <span className="font-medium">{issue.type}</span>
                          </div>
                          <AlertDescription className="text-sm">
                            {issue.description}
                          </AlertDescription>
                          {issue.suggestedAction && (
                            <p className="text-xs text-muted-foreground mt-1">
                              建议: {issue.suggestedAction}
                            </p>
                          )}
                        </div>
                        {issue.autoFixable && (
                          <Button size="sm" variant="outline" className="ml-2">
                            自动修复
                          </Button>
                        )}
                      </div>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            {lastResult.issues.length === 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  未发现数据完整性问题，所有检查都通过了。
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* 检查历史 */}
      {checkHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              检查历史
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {checkHistory.map((record, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(record.status)}
                    <span className="text-sm">
                      {new Date(record.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getStatusColor(record.status)}>
                      {record.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {record.issues?.length || 0} 个问题
                    </span>
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