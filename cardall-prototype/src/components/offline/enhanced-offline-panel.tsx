import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Wifi,
  WifiOff,
  Database,
  Activity,
  Zap,
  Shield,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Settings,
  BarChart3,
  Layers,
  Archive
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEnhancedOfflineStats } from '@/hooks/use-enhanced-offline-manager'
import { EnhancedOfflineManager, EnhancedOfflineStats } from '@/services/offline/enhanced-offline-manager'
import { OfflineOperation, OperationPriority } from '@/types/offline'

interface EnhancedOfflinePanelProps {
  manager: EnhancedOfflineManager | null
  className?: string
}

/**
 * 增强离线面板组件
 * 提供离线功能的详细监控和管理界面
 */
export function EnhancedOfflinePanel({ manager, className }: EnhancedOfflinePanelProps) {
  const { stats, isLoading, error, refresh, clearError } = useEnhancedOfflineStats(manager)

  const [activeTab, setActiveTab] = useState('overview')
  const [showDetails, setShowDetails] = useState(false)

  // 计算性能指标
  const performanceMetrics = useMemo(() => {
    if (!stats) return null

    return {
      efficiency: Math.round(stats.averageCompressionRatio * 100),
      reliability: Math.round(stats.successRate * 100),
      throughput: stats.totalOperations,
      storage: stats.versionHistorySize + stats.stateHistorySize
    }
  }, [stats])

  // 获取状态颜色
  const getStatusColor = (value: number, type: 'efficiency' | 'reliability' | 'throughput' | 'storage') => {
    const thresholds = {
      efficiency: [50, 80],
      reliability: [70, 90],
      throughput: [100, 500],
      storage: [1000, 5000]
    }

    const [low, high] = thresholds[type]

    if (value >= high) return 'text-green-600'
    if (value >= low) return 'text-yellow-600'
    return 'text-red-600'
  }

  // 获取优先级颜色
  const getPriorityColor = (priority: OperationPriority) => {
    switch (priority) {
      case OperationPriority.CRITICAL:
        return 'bg-red-500'
      case OperationPriority.HIGH:
        return 'bg-orange-500'
      case OperationPriority.MEDIUM:
        return 'bg-yellow-500'
      case OperationPriority.LOW:
        return 'bg-green-500'
      default:
        return 'bg-gray-500'
    }
  }

  // 格式化字节数
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 格式化时间
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString()
  }

  // 获取网络状态
  const getNetworkStatus = () => {
    if (typeof navigator === 'undefined' || !navigator.onLine) {
      return { status: 'offline', icon: WifiOff, color: 'text-red-600' }
    }

    return { status: 'online', icon: Wifi, color: 'text-green-600' }
  }

  const networkStatus = getNetworkStatus()
  const NetworkIcon = networkStatus.icon

  if (error) {
    return (
      <Card className={cn('border-red-200', className)}>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">错误</span>
          </div>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearError()
              refresh()
            }}
            className="mt-3"
          >
            重试
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>加载中...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!stats || !performanceMetrics) {
    return (
      <Card className={cn('border-dashed border-2', className)}>
        <CardContent className="p-6">
          <div className="text-center">
            <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">离线管理器未初始化</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('w-full max-w-4xl mx-auto', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>增强离线管理</span>
            <Badge variant="outline" className={cn('ml-2', networkStatus.color)}>
              <NetworkIcon className="h-3 w-3 mr-1" />
              {networkStatus.status}
            </Badge>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>概览</span>
            </TabsTrigger>
            <TabsTrigger value="operations" className="flex items-center space-x-2">
              <Zap className="h-4 w-4" />
              <span>操作</span>
              {stats.totalOperations > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {stats.totalOperations}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>性能</span>
            </TabsTrigger>
            <TabsTrigger value="storage" className="flex items-center space-x-2">
              <Archive className="h-4 w-4" />
              <span>存储</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="待处理操作"
                value={stats.pendingOperations}
                icon={Zap}
                color="text-blue-600"
                description="队列中等待处理的操作"
              />
              <StatCard
                title="活跃操作"
                value={stats.activeOperations}
                icon={Activity}
                color="text-green-600"
                description="正在执行的操作"
              />
              <StatCard
                title="重试操作"
                value={stats.retryOperations}
                icon={RefreshCw}
                color="text-yellow-600"
                description="等待重试的操作"
              />
              <StatCard
                title="成功率"
                value={`${Math.round(stats.successRate * 100)}%`}
                icon={CheckCircle}
                color="text-green-600"
                description="操作执行成功率"
              />
            </div>

            {/* 性能指标 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">性能指标</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">压缩效率</span>
                    <span className={cn('text-sm font-medium', getStatusColor(performanceMetrics.efficiency, 'efficiency'))}>
                      {performanceMetrics.efficiency}%
                    </span>
                  </div>
                  <Progress value={performanceMetrics.efficiency} className="h-2" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">可靠性</span>
                    <span className={cn('text-sm font-medium', getStatusColor(performanceMetrics.reliability, 'reliability'))}>
                      {performanceMetrics.reliability}%
                    </span>
                  </div>
                  <Progress value={performanceMetrics.reliability} className="h-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">系统状态</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">版本历史</span>
                    <span className="text-sm font-medium">{stats.versionHistorySize}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">状态历史</span>
                    <span className="text-sm font-medium">{stats.stateHistorySize}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">合并历史</span>
                    <span className="text-sm font-medium">{stats.mergeHistorySize}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {showDetails && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">详细信息</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">管理器状态</span>
                      <Badge variant={stats.isInitialized ? 'default' : 'secondary'}>
                        {stats.isInitialized ? '已初始化' : '未初始化'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">总操作数</span>
                      <span>{stats.totalOperations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">平均压缩比</span>
                      <span>{(stats.averageCompressionRatio * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">最后更新</span>
                      <span>{new Date().toLocaleTimeString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="operations" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <OperationQueueCard
                title="待处理队列"
                count={stats.pendingOperations}
                color="blue"
                description="等待执行的操作"
              />
              <OperationQueueCard
                title="活跃操作"
                count={stats.activeOperations}
                color="green"
                description="正在执行的操作"
              />
              <OperationQueueCard
                title="重试队列"
                count={stats.retryOperations}
                color="yellow"
                description="等待重试的操作"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">操作状态</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-sm">待处理</span>
                    </div>
                    <span className="text-sm font-medium">{stats.pendingOperations}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm">活跃</span>
                    </div>
                    <span className="text-sm font-medium">{stats.activeOperations}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span className="text-sm">重试</span>
                    </div>
                    <span className="text-sm font-medium">{stats.retryOperations}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">压缩性能</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">平均压缩比</span>
                      <span className={cn('text-sm font-medium', getStatusColor(performanceMetrics.efficiency, 'efficiency'))}>
                        {performanceMetrics.efficiency}%
                      </span>
                    </div>
                    <Progress value={performanceMetrics.efficiency} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                      数据压缩节省的存储空间
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">执行可靠性</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">成功率</span>
                      <span className={cn('text-sm font-medium', getStatusColor(performanceMetrics.reliability, 'reliability'))}>
                        {performanceMetrics.reliability}%
                      </span>
                    </div>
                    <Progress value={performanceMetrics.reliability} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                      操作成功执行的比例
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">性能统计</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{stats.totalOperations}</div>
                    <div className="text-xs text-muted-foreground">总操作数</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.activeOperations}</div>
                    <div className="text-xs text-muted-foreground">活跃操作</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">{stats.retryOperations}</div>
                    <div className="text-xs text-muted-foreground">重试操作</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">{stats.versionHistorySize}</div>
                    <div className="text-xs text-muted-foreground">版本历史</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="storage" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">存储使用情况</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">版本历史</span>
                      <span className="text-sm font-medium">{stats.versionHistorySize} 条</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">状态历史</span>
                      <span className="text-sm font-medium">{stats.stateHistorySize} 条</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">合并历史</span>
                      <span className="text-sm font-medium">{stats.mergeHistorySize} 条</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">总存储</span>
                      <span className="text-sm font-medium">
                        {formatBytes((stats.versionHistorySize + stats.stateHistorySize) * 1024)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">存储优化</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">压缩效率</span>
                      <span className={cn('text-sm font-medium', getStatusColor(performanceMetrics.efficiency, 'efficiency'))}>
                        {performanceMetrics.efficiency}%
                      </span>
                    </div>
                    <Progress value={performanceMetrics.efficiency} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                      通过压缩节省的存储空间
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">版本管理</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">版本历史记录</span>
                    <span>{stats.versionHistorySize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">状态历史记录</span>
                    <span>{stats.stateHistorySize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">合并历史记录</span>
                    <span>{stats.mergeHistorySize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">总存储大小</span>
                    <span>{formatBytes((stats.versionHistorySize + stats.stateHistorySize) * 1024)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
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
  description: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <Icon className={cn('h-8 w-8', color)} />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
      </CardContent>
    </Card>
  )
}

/**
 * 操作队列卡片组件
 */
function OperationQueueCard({
  title,
  count,
  color,
  description
}: {
  title: string
  count: number
  color: string
  description: string
}) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{count}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', colorClasses[color as keyof typeof colorClasses])}>
            <span className="text-white font-bold">{count}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}