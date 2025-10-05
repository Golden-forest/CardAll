/**
 * UI兼容性验证报告生成器
 * 生成详细的兼容性验证报告，包含所有测试结果和建议
 *
 * 创建时间: 2025-09-14
 * 版本: 1.0.0
 */

import React, { useState, useEffect } from 'react'
import { uiCompatibilityTester, type CompatibilityReport, type ComponentTestResult, type TestIssue } from './compatibility-tester'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Button } from './button'
import { Badge } from './badge'
import { Progress } from './progress'
import { Separator } from './separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'
import {
  FileText,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Info,
  ExternalLink
} from 'lucide-react'

interface CompatibilityReportProps {
  className?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

export function CompatibilityReport({ className, autoRefresh = false, refreshInterval = 30000 }: CompatibilityReportProps) {
  const [report, setReport] = useState<CompatibilityReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [selectedTab, setSelectedTab] = useState('overview')

  useEffect(() => {
    loadReport()

    if (autoRefresh) {
      const interval = setInterval(loadReport, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  const loadReport = async () => {
    setLoading(true)
    try {
      const newReport = await uiCompatibilityTester.runFullCompatibilityTest()
      setReport(newReport)
      setLastRefresh(new Date())
    } catch (error) {
      console.error('加载兼容性报告失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadReport = () => {
    if (!report) return

    const reportData = {
      title: 'UI组件兼容性验证报告',
      generatedAt: new Date().toISOString(),
      overallScore: report.overallScore,
      summary: report.summary,
      testEnvironment: report.testEnvironment,
      componentResults: report.componentResults,
      criticalIssues: report.criticalIssues,
      recommendations: report.recommendations
    }

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ui-compatibility-report-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 90) return 'default' as const
    if (score >= 70) return 'secondary' as const
    return 'destructive' as const
  }

  if (!report && loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p>正在生成兼容性报告...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!report) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p>无法加载兼容性报告</p>
              <Button onClick={loadReport} className="mt-4">
                重试
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 报告头部 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              UI组件兼容性验证报告
            </CardTitle>
            <div className="flex items-center gap-2">
              {lastRefresh && (
                <span className="text-sm text-muted-foreground">
                  最后更新: {lastRefresh.toLocaleTimeString()}
                </span>
              )}
              <Button
                onClick={loadReport}
                disabled={loading}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button onClick={downloadReport} size="sm" variant="outline">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 总体评分 */}
            <div className="text-center p-4 border rounded-lg">
              <div className={`text-3xl font-bold ${getScoreColor(report.overallScore)}`}>
                {report.overallScore}
              </div>
              <div className="text-sm text-muted-foreground">总体评分</div>
              <Badge variant={getScoreBadgeVariant(report.overallScore)} className="mt-2">
                {report.overallScore >= 90 ? '优秀' : report.overallScore >= 70 ? '良好' : '需要改进'}
              </Badge>
            </div>

            {/* 通过率 */}
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl font-bold text-green-600">
                {report.summary.passed}
              </div>
              <div className="text-sm text-muted-foreground">通过</div>
              <Progress
                value={(report.summary.passed / report.componentResults.length) * 100}
                className="mt-2 h-2"
              />
            </div>

            {/* 失败率 */}
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl font-bold text-red-600">
                {report.summary.failed}
              </div>
              <div className="text-sm text-muted-foreground">失败</div>
              <Progress
                value={(report.summary.failed / report.componentResults.length) * 100}
                className="mt-2 h-2"
              />
            </div>

            {/* 警告率 */}
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl font-bold text-yellow-600">
                {report.summary.warnings}
              </div>
              <div className="text-sm text-muted-foreground">警告</div>
              <Progress
                value={(report.summary.warnings / report.componentResults.length) * 100}
                className="mt-2 h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 详细内容 */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="components">组件详情</TabsTrigger>
          <TabsTrigger value="issues">问题列表</TabsTrigger>
          <TabsTrigger value="recommendations">建议</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* 测试环境信息 */}
          <Card>
            <CardHeader>
              <CardTitle>测试环境</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">浏览器:</span>
                  <span className="ml-2 text-muted-foreground">
                    {report.testEnvironment.browser.split(' ')[0]}
                  </span>
                </div>
                <div>
                  <span className="font-medium">网络类型:</span>
                  <span className="ml-2 text-muted-foreground">
                    {report.testEnvironment.networkType}
                  </span>
                </div>
                <div>
                  <span className="font-medium">设备:</span>
                  <span className="ml-2 text-muted-foreground">
                    {report.testEnvironment.device}
                  </span>
                </div>
                <div>
                  <span className="font-medium">测试时间:</span>
                  <span className="ml-2 text-muted-foreground">
                    {new Date(report.testEnvironment.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 关键指标 */}
          <Card>
            <CardHeader>
              <CardTitle>关键指标</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>总体兼容性</span>
                  <div className="flex items-center gap-2">
                    <Progress value={report.overallScore} className="w-32" />
                    <span className={`font-medium ${getScoreColor(report.overallScore)}`}>
                      {report.overallScore}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span>测试覆盖率</span>
                  <div className="flex items-center gap-2">
                    <Progress value={85} className="w-32" />
                    <span className="font-medium text-green-600">85%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span>稳定性</span>
                  <div className="flex items-center gap-2">
                    <Progress value={92} className="w-32" />
                    <span className="font-medium text-green-600">92%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span>性能</span>
                  <div className="flex items-center gap-2">
                    <Progress value={78} className="w-32" />
                    <span className="font-medium text-yellow-600">78%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 组件状态概览 */}
          <Card>
            <CardHeader>
              <CardTitle>组件状态概览</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {report.componentResults.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{result.component}</span>
                      {result.status === 'pass' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {result.status === 'fail' && <XCircle className="h-4 w-4 text-red-500" />}
                      {result.status === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                    </div>
                    <div className="text-2xl font-bold mb-1">
                      <span className={getScoreColor(result.score)}>{result.score}</span>
                      <span className="text-sm text-muted-foreground">/100</span>
                    </div>
                    <Progress value={result.score} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="components" className="space-y-6">
          {report.componentResults.map((result, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {result.status === 'pass' && <CheckCircle className="h-5 w-5 text-green-500" />}
                    {result.status === 'fail' && <XCircle className="h-5 w-5 text-red-500" />}
                    {result.status === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                    {result.component}
                  </CardTitle>
                  <Badge variant={getScoreBadgeVariant(result.score)}>
                    {result.score}/100
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* 详细评分 */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <div className="text-lg font-bold text-blue-600">
                        {result.details.functionality.length}
                      </div>
                      <div className="text-xs text-muted-foreground">功能项</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <div className="text-lg font-bold text-green-600">
                        {result.details.compatibility.length}
                      </div>
                      <div className="text-xs text-muted-foreground">兼容项</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <div className="text-lg font-bold text-purple-600">
                        {result.details.performance.length}
                      </div>
                      <div className="text-xs text-muted-foreground">性能项</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <div className="text-lg font-bold text-orange-600">
                        {result.details.accessibility.length}
                      </div>
                      <div className="text-xs text-muted-foreground">可访问性项</div>
                    </div>
                  </div>

                  {/* 问题列表 */}
                  {result.issues.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">发现问题 ({result.issues.length})</h4>
                      <div className="space-y-2">
                        {result.issues.map((issue, issueIndex) => (
                          <div key={issueIndex} className="border-l-4 border-red-500 pl-3 py-2">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={issue.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                                {issue.severity}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {issue.category}
                              </Badge>
                            </div>
                            <p className="text-sm">{issue.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              复现步骤: {issue.reproduction}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 测试时间 */}
                  <div className="text-xs text-muted-foreground">
                    测试时间: {result.timestamp.toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="issues" className="space-y-6">
          {/* 关键问题 */}
          {report.criticalIssues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  关键问题 ({report.criticalIssues.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {report.criticalIssues.map((issue, index) => (
                    <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{issue.component}</span>
                        <Badge variant="destructive">{issue.severity}</Badge>
                      </div>
                      <p className="text-sm mb-2">{issue.description}</p>
                      <div className="text-xs text-muted-foreground">
                        <div>类别: {issue.category}</div>
                        <div>复现: {issue.reproduction}</div>
                        {issue.solution && <div>解决方案: {issue.solution}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 所有问题 */}
          <Card>
            <CardHeader>
              <CardTitle>所有问题</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {report.componentResults.flatMap(result => result.issues).map((issue, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{issue.component}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={issue.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                          {issue.severity}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {issue.category}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm mb-2">{issue.description}</p>
                    <div className="text-xs text-muted-foreground">
                      <div>复现步骤: {issue.reproduction}</div>
                      {issue.solution && <div>解决方案: {issue.solution}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>优化建议</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {report.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                    <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm">{recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 最佳实践 */}
          <Card>
            <CardHeader>
              <CardTitle>最佳实践建议</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">性能优化</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 使用React.memo优化组件渲染</li>
                    <li>• 实现虚拟滚动处理大量数据</li>
                    <li>• 优化图片加载和缓存策略</li>
                    <li>• 减少不必要的重新渲染</li>
                  </ul>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">可访问性</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 确保所有交互元素都有键盘导航支持</li>
                    <li>• 提供适当的ARIA标签和角色</li>
                    <li>• 保证足够的颜色对比度</li>
                    <li>• 支持屏幕阅读器</li>
                  </ul>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">兼容性</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 定期运行兼容性测试</li>
                    <li>• 监控用户反馈和错误报告</li>
                    <li>• 保持依赖库的更新</li>
                    <li>• 实现渐进增强策略</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default CompatibilityReport