import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  Cloud,
  Wifi,
  Lock,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Settings,
  RefreshCw,
  Shield,
  Database,
  Zap,
  Users,
  Clock,
  BarChart3,
  FileText,
  Download,
  Upload,
  Sync
} from 'lucide-react'
import { useAdvancedPerformanceMonitor } from '@/hooks/use-performance-monitor'
import { useDataEncryption } from '@/hooks/use-data-encryption'
import { useSecurityAudit } from '@/hooks/use-data-encryption'
import { PerformanceDashboard } from '@/components/performance/performance-dashboard'
import { SecurityDashboard } from '@/components/security/security-dashboard'

/**
 * Phase 3 控制中心主组件
 * 提供对所有Phase 3功能的集中管理界面
 */
export const Phase3ControlCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview')
  const [systemStatus, setSystemStatus] = useState({
    cloudSync: 'connected',
    offlineMode: 'disabled',
    encryption: 'active',
    performance: 'good',
    lastSync: new Date()
  })

  // 性能监控
  const {
    isInitialized: perfInitialized,
    metrics,
    alerts: perfAlerts,
    bottlenecks,
    getPerformanceSummary,
    optimizePerformance
  } = useAdvancedPerformanceMonitor()

  // 数据加密
  const {
    isInitialized: encInitialized,
    stats: encStats,
    encryptData,
    decryptData,
    generateComplianceReport
  } = useDataEncryption()

  // 安全审计
  const {
    auditLog,
    eventStats,
    highRiskEvents
  } = useSecurityAudit(null, 100)

  // 获取系统状态摘要
  const getSystemSummary = useCallback(() => {
    const perfSummary = getPerformanceSummary()

    return {
      overallHealth: perfSummary?.overallHealth || 'good',
      criticalIssues: (perfSummary?.criticalIssues || 0) + (highRiskEvents?.length || 0),
      totalAlerts: (perfAlerts?.length || 0) + (highRiskEvents?.length || 0),
      activeFeatures: [
        systemStatus.cloudSync === 'connected' ? 'cloud-sync' : null,
        systemStatus.encryption === 'active' ? 'encryption' : null,
        perfInitialized ? 'performance-monitoring' : null,
        encInitialized ? 'data-security' : null
      ].filter(Boolean)
    }
  }, [getPerformanceSummary, perfAlerts, highRiskEvents, systemStatus, perfInitialized, encInitialized])

  const systemSummary = getSystemSummary()

  // 处理系统优化
  const handleSystemOptimize = useCallback(async () => {
    try {
      await optimizePerformance()
      // 这里可以添加其他优化操作
    } catch (err) {
      console.error('系统优化失败:', err)
    }
  }, [optimizePerformance])

  // 处理数据同步
  const handleDataSync = useCallback(async () => {
    try {
      // 模拟同步操作
      setSystemStatus(prev => ({
        ...prev,
        cloudSync: 'syncing'
      }))

      // 等待同步完成
      await new Promise(resolve => setTimeout(resolve, 2000))

      setSystemStatus(prev => ({
        ...prev,
        cloudSync: 'connected',
        lastSync: new Date()
      }))
    } catch (err) {
      console.error('数据同步失败:', err)
      setSystemStatus(prev => ({
        ...prev,
        cloudSync: 'error'
      }))
    }
  }, [])

  // 处理安全扫描
  const handleSecurityScan = useCallback(async () => {
    try {
      // 生成合规报告
      await generateComplianceReport()

      // 这里可以添加更多安全扫描逻辑
    } catch (err) {
      console.error('安全扫描失败:', err)
    }
  }, [generateComplianceReport])

  return (
    <div className="space-y-6">
      {/* 头部信息 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Phase 3 控制中心</h1>
          <p className="text-gray-600">高级功能管理中心 - 云同步、安全加密、性能监控</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={handleDataSync}
            disabled={systemStatus.cloudSync === 'syncing'}
          >
            {systemStatus.cloudSync === 'syncing' ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sync className="h-4 w-4 mr-2" />
            )}
            数据同步
          </Button>
          <Button
            variant="outline"
            onClick={handleSecurityScan}
          >
            <Shield className="h-4 w-4 mr-2" />
            安全扫描
          </Button>
          <Button onClick={handleSystemOptimize}>
            <Zap className="h-4 w-4 mr-2" />
            系统优化
          </Button>
        </div>
      </div>

      {/* 系统状态概览 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>系统状态概览</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">整体健康度</p>
              <Badge
                variant={systemSummary.overallHealth === 'excellent' ? 'default' :
                         systemSummary.overallHealth === 'good' ? 'secondary' :
                         systemSummary.overallHealth === 'fair' ? 'outline' : 'destructive'}
                className="mt-1"
              >
                {systemSummary.overallHealth === 'excellent' ? '优秀' :
                 systemSummary.overallHealth === 'good' ? '良好' :
                 systemSummary.overallHealth === 'fair' ? '一般' : '较差'}
              </Badge>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">严重问题</p>
              <p className="text-2xl font-bold text-red-600">{systemSummary.criticalIssues}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">活动告警</p>
              <p className="text-2xl font-bold text-yellow-600">{systemSummary.totalAlerts}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">启用功能</p>
              <p className="text-2xl font-bold text-green-600">{systemSummary.activeFeatures.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 功能状态面板 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Cloud className="h-8 w-8 text-blue-600" />
              <Badge variant={systemStatus.cloudSync === 'connected' ? 'default' : 'secondary'}>
                {systemStatus.cloudSync === 'connected' ? '已连接' : '离线'}
              </Badge>
            </div>
            <h3 className="font-medium mb-2">云同步</h3>
            <p className="text-sm text-gray-600 mb-3">
              最后同步: {systemStatus.lastSync.toLocaleTimeString()}
            </p>
            <Progress value={systemStatus.cloudSync === 'connected' ? 100 : 0} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Lock className="h-8 w-8 text-green-600" />
              <Badge variant={systemStatus.encryption === 'active' ? 'default' : 'secondary'}>
                {systemStatus.encryption === 'active' ? '已启用' : '已禁用'}
              </Badge>
            </div>
            <h3 className="font-medium mb-2">数据加密</h3>
            <p className="text-sm text-gray-600 mb-3">
              {encStats?.totalEncryptions || 0} 次加密操作
            </p>
            <Progress value={systemStatus.encryption === 'active' ? 100 : 0} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Activity className="h-8 w-8 text-purple-600" />
              <Badge variant={perfInitialized ? 'default' : 'secondary'}>
                {perfInitialized ? '运行中' : '未启动'}
              </Badge>
            </div>
            <h3 className="font-medium mb-2">性能监控</h3>
            <p className="text-sm text-gray-600 mb-3">
              {perfAlerts?.length || 0} 个性能告警
            </p>
            <Progress value={perfInitialized ? 100 : 0} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Shield className="h-8 w-8 text-red-600" />
              <Badge variant={encInitialized ? 'default' : 'secondary'}>
                {encInitialized ? '已保护' : '未启用'}
              </Badge>
            </div>
            <h3 className="font-medium mb-2">安全审计</h3>
            <p className="text-sm text-gray-600 mb-3">
              {highRiskEvents?.length || 0} 个高风险事件
            </p>
            <Progress value={encInitialized ? 100 : 0} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* 详细功能标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">总览</TabsTrigger>
          <TabsTrigger value="performance">性能监控</TabsTrigger>
          <TabsTrigger value="security">安全加密</TabsTrigger>
          <TabsTrigger value="sync">同步管理</TabsTrigger>
          <TabsTrigger value="reports">报告分析</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 系统活动 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>系统活动</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">性能监控</span>
                    <Badge variant={perfInitialized ? 'default' : 'secondary'}>
                      {perfInitialized ? '运行中' : '已停止'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">数据加密</span>
                    <Badge variant={encInitialized ? 'default' : 'secondary'}>
                      {encInitialized ? '已启用' : '已禁用'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">云同步</span>
                    <Badge variant={systemStatus.cloudSync === 'connected' ? 'default' : 'secondary'}>
                      {systemStatus.cloudSync === 'connected' ? '已连接' : '离线'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">离线模式</span>
                    <Badge variant={systemStatus.offlineMode === 'enabled' ? 'default' : 'secondary'}>
                      {systemStatus.offlineMode === 'enabled' ? '已启用' : '已禁用'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 最近事件 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>最近事件</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {highRiskEvents?.slice(0, 5).map((event, index) => (
                    <div key={index} className="flex items-center space-x-2 p-2 bg-red-50 rounded">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm">{event.eventType}</span>
                      <span className="text-xs text-gray-500 ml-auto">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                  {perfAlerts?.slice(0, 3).map((alert, index) => (
                    <div key={index} className="flex items-center space-x-2 p-2 bg-yellow-50 rounded">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm">{alert.message}</span>
                      <span className="text-xs text-gray-500 ml-auto">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                  {(!highRiskEvents || highRiskEvents.length === 0) &&
                   (!perfAlerts || perfAlerts.length === 0) && (
                    <div className="text-center py-4">
                      <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">暂无事件</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceDashboard />
        </TabsContent>

        <TabsContent value="security">
          <SecurityDashboard />
        </TabsContent>

        <TabsContent value="sync">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 同步状态 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Sync className="h-5 w-5" />
                  <span>同步状态</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>云同步状态</span>
                    <Badge variant={systemStatus.cloudSync === 'connected' ? 'default' : 'secondary'}>
                      {systemStatus.cloudSync === 'connected' ? '已连接' : '离线'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>离线模式</span>
                    <Switch
                      checked={systemStatus.offlineMode === 'enabled'}
                      onCheckedChange={(checked) => {
                        setSystemStatus(prev => ({
                          ...prev,
                          offlineMode: checked ? 'enabled' : 'disabled'
                        }))
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>最后同步时间</span>
                    <span className="text-sm text-gray-600">
                      {systemStatus.lastSync.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>同步间隔</span>
                    <span className="text-sm text-gray-600">5 分钟</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 同步统计 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>同步统计</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>今日同步次数</span>
                    <span className="font-medium">24</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>成功同步</span>
                    <span className="font-medium text-green-600">23</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>失败同步</span>
                    <span className="font-medium text-red-600">1</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>同步数据量</span>
                    <span className="font-medium">2.4 MB</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>平均同步时间</span>
                    <span className="font-medium">1.2s</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 报告生成 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>报告生成</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button className="w-full justify-start">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    生成性能报告
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Shield className="h-4 w-4 mr-2" />
                    生成安全报告
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Database className="h-4 w-4 mr-2" />
                    生成同步报告
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    生成综合报告
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 最近报告 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Download className="h-5 w-5" />
                  <span>最近报告</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">性能报告</p>
                      <p className="text-sm text-gray-600">2024-01-20 14:30</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">安全报告</p>
                      <p className="text-sm text-gray-600">2024-01-20 10:15</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">同步报告</p>
                      <p className="text-sm text-gray-600">2024-01-19 16:45</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}