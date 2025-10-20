import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Shield,
  Lock,
  Key,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Settings,
  Eye,
  Database,
  Network,
  Clock,
  BarChart3,
  FileText,
  Users,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDataEncryption, useEncryptionStatus, useSecurityAudit } from '@/hooks/use-data-encryption'
import { DataEncryptionService } from '@/services/security/data-encryption-service'
import { SecurityLevel, EncryptionAlgorithm } from '@/types/security'

interface SecurityDashboardProps {
  service: DataEncryptionService | null
  className?: string
}

/**
 * 安全仪表板组件
 * 提供加密服务状态、安全监控和审计功能的完整界面
 */
export function SecurityDashboard({ service, className }: SecurityDashboardProps) {
  const { isInitialized, stats, error, reinitialize, clearError } = useDataEncryption()
  const { securityMetrics, securityLevel, statusColor, isLoading } = useEncryptionStatus(service)
  const { eventStats, highRiskEvents, recentSecurityEvents, refresh: refreshAudit } = useSecurityAudit(service)

  const [activeTab, setActiveTab] = useState('overview')
  const [showDetails, setShowDetails] = useState(false)

  // 格式化时间
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleString()
  }

  // 格式化字节数
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`
  }

  // 获取安全等级颜色
  const getSecurityLevelColor = (level: SecurityLevel) => {
    switch (level) {
      case SecurityLevel.HIGH:
        return 'text-green-600 bg-green-50 border-green-200'
      case SecurityLevel.MEDIUM:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case SecurityLevel.LOW:
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  // 获取风险等级颜色
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'text-green-600'
      case 'medium':
        return 'text-yellow-600'
      case 'high':
        return 'text-orange-600'
      case 'critical':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  // 获取状态图标
  const getStatusIcon = (result: string) => {
    switch (result) {
      case 'success':
        return CheckCircle
      case 'failure':
        return AlertTriangle
      case 'error':
        return XCircle
      default:
        return Activity
    }
  }

  if (error) {
    return (
      <Card className={cn('border-red-200', className)}>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">错误</span>
          </div>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearError()
              reinitialize()
            }}
            className="mt-3"
          >
            重试
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!isInitialized) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>初始化安全服务...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('w-full max-w-6xl mx-auto space-y-6', className)}>
      {/* 头部状态 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>安全仪表板</span>
              <Badge variant="outline" className={cn('ml-2', statusColor)}>
                {securityLevel}
              </Badge>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshAudit()}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                刷新
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                <Settings className="h-4 w-4 mr-1" />
                {showDetails ? '隐藏' : '显示'}详情
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="加密操作"
              value={stats?.totalEncryptions || 0}
              icon={Lock}
              color="text-blue-600"
              description="总加密操作数"
            />
            <StatCard
              title="解密操作"
              value={stats?.totalDecryptions || 0}
              icon={Unlock}
              color="text-green-600"
              description="总解密操作数"
            />
            <StatCard
              title="成功率"
              value={`${securityMetrics?.successRate || 0}%`}
              icon={CheckCircle}
              color="text-green-600"
              description="操作成功率"
            />
            <StatCard
              title="安全事件"
              value={stats?.securityEvents || 0}
              icon={AlertTriangle}
              color="text-yellow-600"
              description="安全相关事件"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>概览</span>
          </TabsTrigger>
          <TabsTrigger value="encryption" className="flex items-center space-x-2">
            <Lock className="h-4 w-4" />
            <span>加密</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center space-x-2">
            <Eye className="h-4 w-4" />
            <span>审计</span>
            {highRiskEvents.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {highRiskEvents.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>合规</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* 安全状态 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">安全状态</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">安全等级</span>
                    <Badge variant="outline" className={cn('text-xs', getSecurityLevelColor(securityLevel))}>
                      {securityLevel}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">成功率</span>
                    <span className={cn('text-sm font-medium', statusColor)}>
                      {securityMetrics?.successRate || 0}%
                    </span>
                  </div>
                  <Progress value={securityMetrics?.successRate || 0} className="h-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">平均加密时间</span>
                    <span className="text-sm font-medium">
                      {securityMetrics?.averageEncryptionTime || 0}ms
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">缓存命中率</span>
                    <span className="text-sm font-medium">
                      {securityMetrics?.cacheHitRate || 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">性能指标</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">总操作数</span>
                    <span className="text-sm font-medium">
                      {securityMetrics?.totalOperations || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">失败率</span>
                    <span className={cn('text-sm font-medium', securityMetrics?.failureRate > 5 ? 'text-red-600' : 'text-green-600')}>
                      {securityMetrics?.failureRate || 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">失败次数</span>
                    <span className="text-sm font-medium text-red-600">
                      {(stats?.failedEncryptions || 0) + (stats?.failedDecryptions || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">密钥数量</span>
                    <span className="text-sm font-medium">
                      {stats?.keyUsageCount || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 安全警告 */}
          {highRiskEvents.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <strong>检测到高风险安全事件:</strong>
                  {highRiskEvents.slice(0, 3).map((event, index) => (
                    <div key={index} className="text-sm">
                      • {event.eventType} - {formatTime(event.timestamp)}
                    </div>
                  ))}
                  {highRiskEvents.length > 3 && (
                    <div className="text-sm">
                      还有 {highRiskEvents.length - 3} 个高风险事件...
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {showDetails && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">详细信息</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">服务状态</span>
                    <Badge variant={isInitialized ? 'default' : 'secondary'}>
                      {isInitialized ? '已初始化' : '未初始化'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">总加密操作</span>
                    <span>{stats?.totalEncryptions || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">总解密操作</span>
                    <span>{stats?.totalDecryptions || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">加密失败</span>
                    <span className="text-red-600">{stats?.failedEncryptions || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">解密失败</span>
                    <span className="text-red-600">{stats?.failedDecryptions || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">缓存命中</span>
                    <span>{stats?.cacheHits || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">缓存未命中</span>
                    <span>{stats?.cacheMisses || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="encryption" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">加密统计</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">总加密操作</span>
                    <span className="text-sm font-medium">{stats?.totalEncryptions || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">失败加密</span>
                    <span className="text-sm font-medium text-red-600">{stats?.failedEncryptions || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">平均加密时间</span>
                    <span className="text-sm font-medium">
                      {Math.round(stats?.averageEncryptionTime || 0)}ms
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">加密成功率</span>
                    <span className="text-sm font-medium text-green-600">
                      {stats?.totalEncryptions > 0 ? Math.round(((stats?.totalEncryptions - stats?.failedEncryptions) / stats?.totalEncryptions) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">解密统计</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">总解密操作</span>
                    <span className="text-sm font-medium">{stats?.totalDecryptions || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">失败解密</span>
                    <span className="text-sm font-medium text-red-600">{stats?.failedDecryptions || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">平均解密时间</span>
                    <span className="text-sm font-medium">
                      {Math.round(stats?.averageDecryptionTime || 0)}ms
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">解密成功率</span>
                    <span className="text-sm font-medium text-green-600">
                      {stats?.totalDecryptions > 0 ? Math.round(((stats?.totalDecryptions - stats?.failedDecryptions) / stats?.totalDecryptions) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">加密性能</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{stats?.totalEncryptions || 0}</div>
                  <div className="text-xs text-muted-foreground">加密操作</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{Math.round(stats?.averageEncryptionTime || 0)}</div>
                  <div className="text-xs text-muted-foreground">平均加密时间(ms)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{stats?.cacheHits || 0}</div>
                  <div className="text-xs text-muted-foreground">缓存命中</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">事件统计</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">总事件数</span>
                    <span className="text-sm font-medium">{eventStats?.total || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">成功事件</span>
                    <span className="text-sm font-medium text-green-600">{eventStats?.success || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">失败事件</span>
                    <span className="text-sm font-medium text-red-600">{eventStats?.failure || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">风险分布</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {eventStats?.byRiskLevel && Object.entries(eventStats.byRiskLevel).map(([level, count]) => (
                    <div key={level} className="flex justify-between">
                      <span className={cn('text-sm', getRiskColor(level))}>{level}</span>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">事件类型</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {eventStats?.byType && Object.entries(eventStats.byType).slice(0, 5).map(([type, count]) => (
                    <div key={type} className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{type}</span>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 高风险事件 */}
          {highRiskEvents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">高风险事件</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {highRiskEvents.slice(0, 10).map((event, index) => {
                    const Icon = getStatusIcon(event.result)
                    return (
                      <div key={index} className="flex items-center space-x-2 text-sm">
                        <Icon className={cn('h-4 w-4', event.result === 'success' ? 'text-green-600' : 'text-red-600')} />
                        <span className="flex-1">{event.eventType}</span>
                        <span className={cn('text-xs', getRiskColor(event.riskLevel))}>{event.riskLevel}</span>
                        <span className="text-xs text-muted-foreground">{formatTime(event.timestamp)}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 最近安全事件 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">最近安全事件</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {recentSecurityEvents.length > 0 ? (
                  recentSecurityEvents.map((event, index) => {
                    const Icon = getStatusIcon(event.result)
                    return (
                      <div key={index} className="flex items-center space-x-2 text-sm">
                        <Icon className={cn('h-4 w-4', event.result === 'success' ? 'text-green-600' : 'text-red-600')} />
                        <span className="flex-1">{event.operation}</span>
                        <Badge variant="outline" className="text-xs">
                          {event.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatTime(event.timestamp)}</span>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    没有最近的安全事件
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">合规状态</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">安全等级</span>
                    <Badge variant="outline" className={cn('text-xs', getSecurityLevelColor(securityLevel))}>
                      {securityLevel}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">操作合规性</span>
                    <span className={cn('text-sm font-medium', securityMetrics?.successRate > 95 ? 'text-green-600' : 'text-yellow-600')}>
                      {securityMetrics?.successRate || 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">风险控制</span>
                    <span className={cn('text-sm font-medium', highRiskEvents.length === 0 ? 'text-green-600' : 'text-red-600')}>
                      {highRiskEvents.length === 0 ? '良好' : '需要关注'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">审计完整性</span>
                    <span className="text-sm font-medium text-green-600">
                      {eventStats?.total > 0 ? '完整' : '待建立'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">安全建议</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {securityMetrics?.successRate < 95 && (
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span>加密成功率较低，建议检查密钥管理和算法配置</span>
                    </div>
                  )}
                  {securityMetrics?.averageEncryptionTime > 1000 && (
                    <div className="flex items-start space-x-2">
                      <Zap className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span>加密性能较低，建议启用硬件加速或优化算法</span>
                    </div>
                  )}
                  {highRiskEvents.length > 0 && (
                    <div className="flex items-start space-x-2">
                      <Shield className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span>检测到高风险事件，建议立即审查安全策略</span>
                    </div>
                  )}
                  {securityMetrics?.cacheHitRate < 50 && (
                    <div className="flex items-start space-x-2">
                      <Database className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      <span>缓存命中率较低，建议优化缓存策略</span>
                    </div>
                  )}
                  {securityMetrics?.successRate >= 95 && highRiskEvents.length === 0 && (
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>安全状态良好，继续保持当前的策略和配置</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 合规报告 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">合规报告</CardTitle>
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-1" />
                  生成报告
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{securityMetrics?.successRate || 0}%</div>
                  <div className="text-xs text-muted-foreground">操作合规率</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{eventStats?.total || 0}</div>
                  <div className="text-xs text-muted-foreground">审计事件</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{highRiskEvents.length}</div>
                  <div className="text-xs text-muted-foreground">高风险事件</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{stats?.keyUsageCount || 0}</div>
                  <div className="text-xs text-muted-foreground">密钥使用</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * 统计卡片组件
 */
function StatCard({
  title,
  value,
  icon: Icon,
  color,
  description
}: {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color: string
  description?: string
}) {
  return (
    <div className="text-center">
      <Icon className={cn('h-8 w-8 mx-auto mb-2', color)} />
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  )
}

// 解锁图标组件
function Unlock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
    </svg>
  )
}

// X图标组件
function XCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}