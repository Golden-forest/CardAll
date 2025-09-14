/**
 * UI兼容性测试演示页面
 * 展示所有UI组件与新统一同步服务的兼容性测试功能
 *
 * 创建时间: 2025-09-14
 * 版本: 1.0.0
 */

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Button } from './button'
import { Badge } from './badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'
import { Separator } from './separator'
import { SyncStatusTester } from './sync-status-tester'
import { CompatibilityReport } from './compatibility-report'
import { useUICompatibility } from './compatibility-tester'
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  BarChart3,
  FileText,
  Monitor,
  Smartphone,
  Tablet,
  Accessibility,
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  RefreshCw
} from 'lucide-react'

export function CompatibilityDemo() {
  const [activeTab, setActiveTab] = useState('overview')
  const { runTest, results, loading, error } = useUICompatibility()

  const completedTests = results.length
  const passedTests = results.filter(r => r.status === 'pass').length
  const failedTests = results.filter(r => r.status === 'fail').length
  const warningTests = results.filter(r => r.status === 'warning').length

  const runAllTests = async () => {
    await runTest()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">UI组件兼容性验证</h1>
          <p className="text-gray-600">
            验证所有UI组件与新统一同步服务的兼容性
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Activity className="h-4 w-4" />
            <span>实时监控和测试</span>
          </div>
        </div>

        {/* 快速统计 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-gray-600">已完成测试</p>
                <p className="text-2xl font-bold">{completedTests}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-gray-600">通过测试</p>
                <p className="text-2xl font-bold text-green-600">{passedTests}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-gray-600">失败测试</p>
                <p className="text-2xl font-bold text-red-600">{failedTests}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-gray-600">警告</p>
                <p className="text-2xl font-bold text-yellow-600">{warningTests}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </CardContent>
          </Card>
        </div>

        {/* 主要内容区域 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>兼容性测试控制台</span>
              <Button onClick={runAllTests} disabled={loading}>
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    测试中...
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4 mr-2" />
                    运行全部测试
                  </>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">测试失败</span>
                </div>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">概览</TabsTrigger>
                <TabsTrigger value="sync-status">同步状态</TabsTrigger>
                <TabsTrigger value="components">组件测试</TabsTrigger>
                <TabsTrigger value="report">详细报告</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* 测试概览 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 兼容性状态 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        兼容性状态
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">统一同步服务</span>
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            已集成
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">网络管理器</span>
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            正常
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">离线管理器</span>
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            就绪
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">认证服务</span>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            待验证
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 系统状态 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        系统状态
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Wifi className="h-4 w-4 text-green-500" />
                            <span className="text-sm">网络连接</span>
                          </div>
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            在线
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Cloud className="h-4 w-4 text-blue-500" />
                            <span className="text-sm">同步状态</span>
                          </div>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            空闲
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-purple-500" />
                            <span className="text-sm">性能</span>
                          </div>
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            良好
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Accessibility className="h-4 w-4 text-orange-500" />
                            <span className="text-sm">可访问性</span>
                          </div>
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                            优化中
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 测试范围 */}
                <Card>
                  <CardHeader>
                    <CardTitle>测试范围</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Monitor className="h-5 w-5 text-blue-500" />
                          <span className="font-medium">同步状态指示器</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          验证同步状态显示和用户交互功能
                        </p>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Monitor className="h-5 w-5 text-green-500" />
                          <span className="font-medium">卡片组件</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          测试卡片与同步服务的集成和性能
                        </p>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Monitor className="h-5 w-5 text-purple-500" />
                          <span className="font-medium">文件夹管理</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          验证文件夹操作和同步兼容性
                        </p>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Monitor className="h-5 w-5 text-orange-500" />
                          <span className="font-medium">标签管理</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          测试标签功能与同步服务的集成
                        </p>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Smartphone className="h-5 w-5 text-pink-500" />
                          <span className="font-medium">离线模式</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          验证离线状态下的UI行为和数据同步
                        </p>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Tablet className="h-5 w-5 text-indigo-500" />
                          <span className="font-medium">响应式设计</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          测试不同设备尺寸下的兼容性
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 最近测试结果 */}
                {results.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>最近测试结果</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {results.slice(-5).map((result, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded">
                            <div className="flex items-center gap-3">
                              {result.status === 'pass' && <CheckCircle className="h-4 w-4 text-green-500" />}
                              {result.status === 'fail' && <XCircle className="h-4 w-4 text-red-500" />}
                              {result.status === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                              <span className="font-medium">{result.component}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={result.status === 'pass' ? 'default' : result.status === 'fail' ? 'destructive' : 'secondary'}>
                                {result.score}/100
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {result.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="sync-status">
                <SyncStatusTester />
              </TabsContent>

              <TabsContent value="components">
                <div className="space-y-6">
                  {/* 组件测试摘要 */}
                  <Card>
                    <CardHeader>
                      <CardTitle>组件测试摘要</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {results.length === 0 ? (
                        <div className="text-center py-8">
                          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">暂无测试结果，请先运行测试</p>
                          <Button onClick={runAllTests} className="mt-4">
                            运行测试
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {results.map((result, index) => (
                            <div key={index} className="border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{result.component}</span>
                                {result.status === 'pass' && <CheckCircle className="h-4 w-4 text-green-500" />}
                                {result.status === 'fail' && <XCircle className="h-4 w-4 text-red-500" />}
                                {result.status === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                              </div>
                              <div className="text-2xl font-bold mb-1">
                                <span className={
                                  result.score >= 90 ? 'text-green-600' :
                                  result.score >= 70 ? 'text-yellow-600' : 'text-red-600'
                                }>
                                  {result.score}
                                </span>
                                <span className="text-sm text-gray-500">/100</span>
                              </div>
                              <div className="text-xs text-gray-500">
                                测试时间: {result.timestamp.toLocaleTimeString()}
                              </div>
                              <div className="mt-2 space-y-1">
                                <div className="text-xs">
                                  <span className="text-blue-600">功能: {result.details.functionality.length}</span>
                                </div>
                                <div className="text-xs">
                                  <span className="text-green-600">兼容: {result.details.compatibility.length}</span>
                                </div>
                                <div className="text-xs">
                                  <span className="text-purple-600">性能: {result.details.performance.length}</span>
                                </div>
                                <div className="text-xs">
                                  <span className="text-orange-600">可访问性: {result.details.accessibility.length}</span>
                                </div>
                              </div>
                              {result.issues.length > 0 && (
                                <div className="mt-2">
                                  <Badge variant="destructive" className="text-xs">
                                    {result.issues.length} 个问题
                                  </Badge>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* 详细问题列表 */}
                  {results.some(r => r.issues.length > 0) && (
                    <Card>
                      <CardHeader>
                        <CardTitle>发现的问题</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {results
                            .filter(r => r.issues.length > 0)
                            .flatMap(result =>
                              result.issues.map(issue => ({
                                ...issue,
                                component: result.component
                              }))
                            )
                            .map((issue, index) => (
                              <div key={index} className="border-l-4 border-red-500 pl-4 py-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium">{issue.component}</span>
                                  <Badge variant={issue.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                                    {issue.severity}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600">{issue.description}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  类别: {issue.category} | 复现: {issue.reproduction}
                                </p>
                              </div>
                            ))
                          }
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="report">
                <CompatibilityReport />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* 使用说明 */}
        <Card>
          <CardHeader>
            <CardTitle>使用说明</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">快速开始</h4>
                <ol className="text-sm space-y-1 text-gray-600">
                  <li>1. 点击"运行全部测试"按钮开始兼容性验证</li>
                  <li>2. 查看同步状态指示器的专项测试结果</li>
                  <li>3. 检查各组件的详细测试报告</li>
                  <li>4. 导出测试报告用于分析和存档</li>
                </ol>
              </div>

              <div>
                <h4 className="font-medium mb-2">最佳实践</h4>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• 定期运行兼容性测试确保功能正常</li>
                  <li>• 关注测试结果中的警告和错误信息</li>
                  <li>• 根据建议优化UI组件和同步集成</li>
                  <li>• 监控生产环境中的用户体验反馈</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 页脚 */}
        <div className="text-center text-sm text-gray-500">
          <p>UI组件兼容性验证工具 v1.0.0</p>
          <p>支持与统一同步服务的完整集成测试</p>
        </div>
      </div>
    </div>
  )
}

export default CompatibilityDemo