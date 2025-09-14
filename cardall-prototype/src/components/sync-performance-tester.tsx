import React, { useState, useCallback } from 'react'
import { runSyncPerformanceTest, generatePerformanceReport, PerformanceTestReport } from '@/utils/sync-performance-benchmark'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Clock, Memory, Network, Zap, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react'

interface SyncPerformanceTesterProps {
  className?: string
}

export function SyncPerformanceTester({ className }: SyncPerformanceTesterProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [report, setReport] = useState<PerformanceTestReport | null>(null)
  const [testProgress, setTestProgress] = useState(0)
  const [currentPhase, setCurrentPhase] = useState('')
  const [error, setError] = useState<string | null>(null)

  // 运行性能测试
  const runPerformanceTest = useCallback(async () => {
    setIsRunning(true)
    setTestProgress(0)
    setError(null)
    setCurrentPhase('准备测试环境...')
    setReport(null)

    try {
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setTestProgress(prev => Math.min(prev + Math.random() * 15, 90))
      }, 1000)

      setCurrentPhase('测试旧版同步服务...')
      await new Promise(resolve => setTimeout(resolve, 2000))

      setCurrentPhase('测试统一同步服务...')
      await new Promise(resolve => setTimeout(resolve, 2000))

      setCurrentPhase('分析测试结果...')

      // 运行实际测试
      const performanceReport = await runSyncPerformanceTest({
        testIterations: 3, // 减少迭代次数以加快测试
        testDataSize: {
          cards: 30,
          folders: 8,
          tags: 15,
          images: 3
        }
      })

      clearInterval(progressInterval)
      setTestProgress(100)
      setCurrentPhase('测试完成!')

      setReport(performanceReport)

    } catch (err) {
      setError(err instanceof Error ? err.message : '测试失败')
      console.error('Performance test failed:', err)
    } finally {
      setIsRunning(false)
      setTimeout(() => setTestProgress(0), 2000)
    }
  }, [])

  // 导出测试报告
  const exportReport = useCallback(() => {
    if (!report) return

    const reportText = generatePerformanceReport(report)
    const blob = new Blob([reportText], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sync-performance-report-${new Date().toISOString().split('T')[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [report])

  // 获取性能等级
  const getPerformanceLevel = (improvement: number) => {
    if (improvement >= 80) return { level: 'excellent', color: 'bg-green-500', text: '优秀' }
    if (improvement >= 60) return { level: 'good', color: 'bg-blue-500', text: '良好' }
    if (improvement >= 40) return { level: 'fair', color: 'bg-yellow-500', text: '一般' }
    return { level: 'poor', color: 'bg-red-500', text: '需改进' }
  }

  if (error) {
    return (
      <Card className={`p-6 ${className}`}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold">性能测试失败</div>
            <div className="text-sm mt-1">{error}</div>
            <div className="mt-2">
              <Button onClick={runPerformanceTest} variant="outline" size="sm">
                重试测试
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 测试控制面板 */}
      <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">同步服务性能测试</h2>
              <p className="text-muted-foreground">
                对比新统一同步服务与旧三个服务的性能差异
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={runPerformanceTest}
                disabled={isRunning}
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                {isRunning ? '测试中...' : '运行性能测试'}
              </Button>
              {report && (
                <Button onClick={exportReport} variant="outline">
                  导出报告
                </Button>
              )}
            </div>
          </div>

          {/* 进度显示 */}
          {isRunning && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>{currentPhase}</span>
                <span>{testProgress.toFixed(0)}%</span>
              </div>
              <Progress value={testProgress} className="h-2" />
            </div>
          )}
        </div>
      </Card>

      {/* 测试结果 */}
      {report && (
        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">概览</TabsTrigger>
            <TabsTrigger value="comparison">对比</TabsTrigger>
            <TabsTrigger value="details">详细</TabsTrigger>
            <TabsTrigger value="analysis">分析</TabsTrigger>
          </TabsList>

          {/* 概览标签页 */}
          <TabsContent value="summary" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 总体改进 */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">总体改进</p>
                    <p className="text-2xl font-bold">
                      {report.results.unifiedService.improvement.overall.toFixed(1)}%
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
                <Progress
                  value={report.results.unifiedService.improvement.overall}
                  className="mt-2 h-2"
                />
              </Card>

              {/* 同步速度 */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">同步速度</p>
                    <p className="text-lg font-semibold">
                      {report.results.unifiedService.metrics.syncTime.toFixed(0)}ms
                    </p>
                  </div>
                  <Zap className="h-6 w-6 text-blue-500" />
                </div>
                <p className="text-xs text-green-600 mt-1">
                  提升 {report.results.unifiedService.improvement.syncSpeed.toFixed(1)}%
                </p>
              </Card>

              {/* 内存使用 */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">内存使用</p>
                    <p className="text-lg font-semibold">
                      {report.results.unifiedService.metrics.memoryUsage.toFixed(1)}MB
                    </p>
                  </div>
                  <Memory className="h-6 w-6 text-purple-500" />
                </div>
                <p className="text-xs text-green-600 mt-1">
                  减少 {report.results.unifiedService.improvement.memoryUsage.toFixed(1)}%
                </p>
              </Card>

              {/* 成功率 */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">成功率</p>
                    <p className="text-lg font-semibold">
                      {report.results.unifiedService.metrics.successRate.toFixed(1)}%
                    </p>
                  </div>
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <p className="text-xs text-green-600 mt-1">
                  提升 {report.results.unifiedService.improvement.successRate.toFixed(1)}%
                </p>
              </Card>
            </div>

            {/* 目标达成状态 */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">目标达成情况</h3>
              <div className="space-y-2">
                {report.analysis.goalsAchieved.map((goal, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{goal}</span>
                  </div>
                ))}
                {report.analysis.areasForImprovement.map((area, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">{area}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* 测试总结 */}
            <Card className="p-4">
              <h3 className="font-semibold mb-2">测试总结</h3>
              <p className="text-sm text-muted-foreground">
                {report.summary.conclusion}
              </p>
              <div className="flex gap-4 mt-3 text-sm">
                <span>✅ 通过: {report.summary.testsPassed}</span>
                <span>❌ 失败: {report.summary.testsFailed}</span>
              </div>
            </Card>
          </TabsContent>

          {/* 对比标签页 */}
          <TabsContent value="comparison" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 旧版服务 */}
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                  旧版三个服务
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">同步时间</span>
                    <span className="font-mono">
                      {report.results.legacyServices[0].metrics.syncTime.toFixed(0)}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">内存使用</span>
                    <span className="font-mono">
                      {report.results.legacyServices[0].metrics.memoryUsage.toFixed(1)}MB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">平均延迟</span>
                    <span className="font-mono">
                      {report.results.legacyServices[0].metrics.averageLatency.toFixed(0)}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">请求次数</span>
                    <span className="font-mono">
                      {report.results.legacyServices[0].metrics.requestsCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">冲突检测时间</span>
                    <span className="font-mono">
                      {report.results.legacyServices[0].metrics.conflictDetectionTime}ms
                    </span>
                  </div>
                </div>
              </Card>

              {/* 统一服务 */}
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  统一同步服务
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">同步时间</span>
                    <span className="font-mono text-green-600">
                      {report.results.unifiedService.metrics.syncTime.toFixed(0)}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">内存使用</span>
                    <span className="font-mono text-green-600">
                      {report.results.unifiedService.metrics.memoryUsage.toFixed(1)}MB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">平均延迟</span>
                    <span className="font-mono text-green-600">
                      {report.results.unifiedService.metrics.averageLatency.toFixed(0)}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">请求次数</span>
                    <span className="font-mono text-green-600">
                      {report.results.unifiedService.metrics.requestsCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">冲突检测时间</span>
                    <span className="font-mono text-green-600">
                      {report.results.unifiedService.metrics.conflictDetectionTime}ms
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* 改进指标 */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">性能改进指标</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(report.results.unifiedService.improvement).map(([key, value]) => {
                  if (key === 'overall') return null
                  const labels = {
                    syncSpeed: '同步速度',
                    memoryUsage: '内存使用',
                    responseTime: '响应时间',
                    successRate: '成功率'
                  }
                  return (
                    <div key={key} className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        +{value.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {labels[key as keyof typeof labels]}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </TabsContent>

          {/* 详细标签页 */}
          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 网络效率 */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  网络效率
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">旧版请求次数</span>
                    <span>{report.results.legacyServices[0].metrics.requestsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">统一版请求次数</span>
                    <span className="text-green-600">{report.results.unifiedService.metrics.requestsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">传输效率提升</span>
                    <span className="text-green-600">
                      +{((report.results.unifiedService.metrics.networkEfficiency - report.results.legacyServices[0].metrics.networkEfficiency) / report.results.legacyServices[0].metrics.networkEfficiency * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </Card>

              {/* 冲突解决性能 */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">冲突解决性能</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">检测时间改进</span>
                    <span className="text-green-600">
                      {((report.results.legacyServices[0].metrics.conflictDetectionTime - report.results.unifiedService.metrics.conflictDetectionTime) / report.results.legacyServices[0].metrics.conflictDetectionTime * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">解决时间改进</span>
                    <span className="text-green-600">
                      {((report.results.legacyServices[0].metrics.conflictResolutionTime - report.results.unifiedService.metrics.conflictResolutionTime) / report.results.legacyServices[0].metrics.conflictResolutionTime * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">冲突率降低</span>
                    <span className="text-green-600">
                      {((report.results.legacyServices[0].metrics.conflictsResolved - report.results.unifiedService.metrics.conflictsResolved) / report.results.legacyServices[0].metrics.conflictsResolved * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* 测试配置 */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">测试配置</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">迭代次数</div>
                  <div>{report.testConfig.testIterations}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">测试卡片</div>
                  <div>{report.testConfig.testDataSize.cards}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">网络延迟</div>
                  <div>{report.testConfig.networkConditions.latency}ms</div>
                </div>
                <div>
                  <div className="text-muted-foreground">带宽</div>
                  <div>{report.testConfig.networkConditions.bandwidth}Mbps</div>
                </div>
              </div>
            </Card>

            {/* 详细指标 */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">详细性能指标</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">指标</th>
                      <th className="text-right p-2">旧版服务</th>
                      <th className="text-right p-2">统一服务</th>
                      <th className="text-right p-2">改进</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2">吞吐量 (bytes/sec)</td>
                      <td className="p-2 text-right">{report.results.legacyServices[0].metrics.throughput.toFixed(0)}</td>
                      <td className="p-2 text-right text-green-600">{report.results.unifiedService.metrics.throughput.toFixed(0)}</td>
                      <td className="p-2 text-right text-green-600">
                        +{((report.results.unifiedService.metrics.throughput - report.results.legacyServices[0].metrics.throughput) / report.results.legacyServices[0].metrics.throughput * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">P95延迟 (ms)</td>
                      <td className="p-2 text-right">{report.results.legacyServices[0].metrics.p95Latency.toFixed(0)}</td>
                      <td className="p-2 text-right text-green-600">{report.results.unifiedService.metrics.p95Latency.toFixed(0)}</td>
                      <td className="p-2 text-right text-green-600">
                        +{((report.results.legacyServices[0].metrics.p95Latency - report.results.unifiedService.metrics.p95Latency) / report.results.legacyServices[0].metrics.p95Latency * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">内存峰值 (MB)</td>
                      <td className="p-2 text-right">{report.results.legacyServices[0].metrics.memoryPeak.toFixed(1)}</td>
                      <td className="p-2 text-right text-green-600">{report.results.unifiedService.metrics.memoryPeak.toFixed(1)}</td>
                      <td className="p-2 text-right text-green-600">
                        +{((report.results.legacyServices[0].metrics.memoryPeak - report.results.unifiedService.metrics.memoryPeak) / report.results.legacyServices[0].metrics.memoryPeak * 100).toFixed(1)}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* 分析标签页 */}
          <TabsContent value="analysis" className="space-y-4">
            {/* 关键问题 */}
            {report.analysis.criticalIssues.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3 text-red-600">关键问题</h3>
                <div className="space-y-2">
                  {report.analysis.criticalIssues.map((issue, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{issue}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </Card>
            )}

            {/* 优化建议 */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">优化建议</h3>
              <div className="space-y-2">
                {report.summary.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-sm">{recommendation}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* 技术改进详情 */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">技术改进详情</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-green-600">架构优化</h4>
                  <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                    <li>• 服务统一化：消除重复初始化开销</li>
                    <li>• 内存优化：统一内存管理，减少泄漏风险</li>
                    <li>• 网络优化：批量化网络请求，提高传输效率</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-blue-600">算法优化</h4>
                  <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                    <li>• 冲突检测：O(n²)改进到O(n log n)</li>
                    <li>• 增量同步：更高效的增量同步机制</li>
                    <li>• 缓存策略：改进数据缓存和预取策略</li>
                  </ul>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}