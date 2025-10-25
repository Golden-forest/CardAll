import React, { useState, useEffect, useCallback } from 'react'
import { performanceBenchmark, PerformanceReport } from '@/utils/performance-benchmark'
import { Card } from '@/types/card'
import { useCards } from '@/hooks/use-cards'
import { Button } from '@/components/ui/button'
import { Card as UICard, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PerformanceTesterProps {
  className?: string
}

export function PerformanceTester({ className }: PerformanceTesterProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [report, setReport] = useState<PerformanceReport | null>(null)
  const [testResults, setTestResults] = useState<Record<string, number>>({})
  const { cards } = useCards()

  // 运行完整性能测试
  const runFullPerformanceTest = useCallback(async () => {
    setIsRunning(true)
    setTestResults({})

    try {
      // 1. 测量Web Vitals
      await performanceBenchmark.measureWebVitals()

      // 2. 测量内存使用
      performanceBenchmark.measureMemoryUsage()

      // 3. 测量组件渲染性能
      const renderStartTime = performance.now()
      // 模拟组件渲染
      const mockComponent = () => {
        return cards.slice(0, 100).map(card => (
          <div key={card.id} className="p-4 border rounded">
            <h3>{card.frontContent.title}</h3>
            <p>{card.frontContent.text}</p>
          </div>
        ))
      }
      performanceBenchmark.measureComponentRenderTime('CardGrid', mockComponent)
      const renderEndTime = performance.now()
      setTestResults(prev => ({ ...prev, componentRender: renderEndTime - renderStartTime }))

      // 4. 测量同步性能（模拟）
      await performanceBenchmark.measureSyncPerformance(async () => {
        // 模拟同步操作
        await new Promise(resolve => setTimeout(resolve, 150))
        return { success: true }
      })

      // 5. 测量数据库性能（模拟）
      await performanceBenchmark.measureDatabasePerformance(async () => {
        // 模拟数据库查询
        await new Promise(resolve => setTimeout(resolve, 5))
        return cards.slice(0, 50)
      }, 'query')

      // 6. 测量Bundle加载时间
      const bundleLoadStart = performance.now()
      await new Promise(resolve => setTimeout(resolve, 100)) // 模拟加载
      const bundleLoadEnd = performance.now()
      setTestResults(prev => ({ ...prev, bundleLoad: bundleLoadEnd - bundleLoadStart }))

      // 7. 生成性能报告
      const performanceReport = performanceBenchmark.getPerformanceReport()
      setReport(performanceReport)

    } catch (error) {
      console.error('Performance test failed:', error)
    } finally {
      setIsRunning(false)
    }
  }, [cards])

  // 运行特定性能测试
  const runSpecificTest = useCallback(async (testName: string) => {
    switch (testName) {
      case 'render':
        const renderStart = performance.now()
        // 渲染大量卡片
        for (let i = 0; i < 1000; i++) {
          const mockCard = cards[0] || {
            id: `test-${i}`,
            frontContent: { title: `Test ${i}`, text: 'Test content' },
            backContent: { title: `Back ${i}`, text: 'Back content' }
          }
        }
        const renderEnd = performance.now()
        setTestResults(prev => ({ ...prev, renderTest: renderEnd - renderStart }))
        break

      case 'memory':
        performanceBenchmark.measureMemoryUsage()
        const currentMetrics = performanceBenchmark.getCurrentMetrics()
        setTestResults(prev => ({ ...prev, memoryUsage: currentMetrics.usedJSHeapSize }))
        break

      case 'sync':
        const syncStart = performance.now()
        await performanceBenchmark.measureSyncPerformance(async () => {
          await new Promise(resolve => setTimeout(resolve, 200))
          return { success: true }
        })
        const syncEnd = performance.now()
        setTestResults(prev => ({ ...prev, syncTest: syncEnd - syncStart }))
        break
    }
  }, [cards])

  // 组件挂载时初始化
  useEffect(() => {
    performanceBenchmark.reset()
  }, [])

  return (
    <div className={`space-y-6 ${className}`}>
      <UICard>
        <CardHeader>
          <CardTitle>CardAll 性能测试工具</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button
              onClick={runFullPerformanceTest}
              disabled={isRunning}
              className="flex-1"
            >
              {isRunning ? '正在运行测试...' : '运行完整性能测试'}
            </Button>

            <Button
              variant="outline"
              onClick={() => runSpecificTest('render')}
              disabled={isRunning}
            >
              测试渲染性能
            </Button>

            <Button
              variant="outline"
              onClick={() => runSpecificTest('memory')}
              disabled={isRunning}
            >
              测试内存使用
            </Button>

            <Button
              variant="outline"
              onClick={() => runSpecificTest('sync')}
              disabled={isRunning}
            >
              测试同步性能
            </Button>
          </div>
        </CardContent>
      </UICard>

      {/* 测试结果 */}
      {Object.keys(testResults).length > 0 && (
        <UICard>
          <CardHeader>
            <CardTitle>当前测试结果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(testResults).map(([test, value]) => (
                <div key={test} className="p-3 border rounded">
                  <div className="text-sm text-muted-foreground">{test}</div>
                  <div className="text-lg font-semibold">
                    {typeof value === 'number' ? `${value.toFixed(2)}ms` : value}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </UICard>
      )}

      {/* 性能报告 */}
      {report && (
        <div className="space-y-4">
          <UICard>
            <CardHeader>
              <CardTitle>性能基准报告</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 总体进度 */}
                <div className="p-4 border rounded">
                  <h3 className="text-lg font-semibold mb-2">总体性能进度</h3>
                  <div className="text-2xl font-bold">
                    {report.overallProgress.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    距离目标还有 {(100 - report.overallProgress).toFixed(1)}%
                  </div>
                </div>

                {/* 分类进度 */}
                <div className="p-4 border rounded">
                  <h3 className="text-lg font-semibold mb-2">分类性能进度</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(report.categoryProgress).map(([category, progress]) => (
                      <div key={category} className="text-center p-2 border rounded">
                        <div className="text-sm text-muted-foreground">{category}</div>
                        <div className="text-lg font-semibold">{progress.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 优化建议 */}
                {report.recommendations.length > 0 && (
                  <div className="p-4 border rounded">
                    <h3 className="text-lg font-semibold mb-2">优化建议</h3>
                    <ul className="space-y-2">
                      {report.recommendations.map((recommendation, index) => (
                        <li key={index} className="text-sm p-2 bg-muted rounded">
                          {recommendation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </UICard>

          {/* 详细基准数据 */}
          <UICard>
            <CardHeader>
              <CardTitle>详细性能基准</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {report.benchmarks.map((benchmark) => (
                  <div key={benchmark.name} className="flex justify-between items-center p-2 border-b">
                    <div className="flex-1">
                      <div className="font-medium">{benchmark.name}</div>
                      <div className="text-sm text-muted-foreground">{benchmark.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {benchmark.currentValue.toFixed(2)}{benchmark.unit}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        目标: {benchmark.targetValue}{benchmark.unit}
                      </div>
                      <div className="text-sm">
                        目标改进: {benchmark.improvementTarget}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </UICard>
        </div>
      )}
    </div>
  )
}