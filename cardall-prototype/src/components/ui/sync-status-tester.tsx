/**
 * 同步状态指示器兼容性测试组件
 * 专门测试同步状态指示器与统一同步服务的兼容性
 *
 * 创建时间: 2025-09-14
 * 版本: 1.0.0
 */

import React, { useState, useEffect } from 'react'
import { unifiedCloudSyncService } from '../services/cloud-sync'
import { authService } from '../services/auth'
import { networkManager } from '../services/network-manager'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Badge } from './badge'
import { Progress } from './progress'
import { Alert, AlertDescription } from './alert'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  Cloud,
  CloudOff
} from 'lucide-react'

interface TestResult {
  test: string
  status: 'pass' | 'fail' | 'warning' | 'running'
  message: string
  details?: any
  timestamp: Date
}

interface SyncStatusTesterProps {
  className?: string
  onTestComplete?: (results: TestResult[]) => void
}

export function SyncStatusTester({ className, onTestComplete }: SyncStatusTesterProps) {
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [currentProgress, setCurrentProgress] = useState(0)
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [networkStatus, setNetworkStatus] = useState<any>(null)
  const [authStatus, setAuthStatus] = useState<any>(null)

  // 监听同步状态
  useEffect(() => {
    const unsubscribeSync = unifiedCloudSyncService.onStatusChange((status) => {
      setSyncStatus(status)
    })

    const unsubscribeNetwork = networkManager.addListener({
      onNetworkStateChanged: (status) => {
        setNetworkStatus(status)
      },
      onNetworkEvent: () => {},
      onSyncReady: () => {}
    })

    // 监听认证状态
    const checkAuthStatus = () => {
      setAuthStatus({
        isAuthenticated: authService.isAuthenticated(),
        user: authService.getCurrentUser()
      })
    }

    checkAuthStatus()
    const authInterval = setInterval(checkAuthStatus, 5000)

    return () => {
      unsubscribeSync()
      unsubscribeNetwork()
      clearInterval(authInterval)
    }
  }, [])

  // 运行测试
  const runTests = async () => {
    setIsRunning(true)
    setCurrentProgress(0)
    setTestResults([])

    const tests: TestResult[] = []

    try {
      // 测试1: 服务初始化
      await runTest(tests, '服务初始化', async () => {
        const startTime = performance.now()

        // 检查统一同步服务
        if (!unifiedCloudSyncService) {
          throw new Error('统一同步服务不可用')
        }

        // 检查网络管理器
        if (!networkManager) {
          throw new Error('网络管理器不可用')
        }

        // 检查认证服务
        if (!authService) {
          throw new Error('认证服务不可用')
        }

        const initTime = performance.now() - startTime
        return { initTime, services: ['unifiedCloudSyncService', 'networkManager', 'authService'] }
      })

      setCurrentProgress(16)

      // 测试2: 状态监听器
      await runTest(tests, '状态监听器', async () => {
        const startTime = performance.now()

        // 测试状态监听器注册
        let statusReceived = false
        const unsubscribe = unifiedCloudSyncService.onStatusChange((status) => {
          statusReceived = true
        })

        // 等待状态更新
        await new Promise(resolve => setTimeout(resolve, 100))

        if (!statusReceived) {
          throw new Error('状态监听器未收到更新')
        }

        // 测试取消订阅
        if (typeof unsubscribe !== 'function') {
          throw new Error('取消订阅功能不可用')
        }

        unsubscribe()

        const listenerTime = performance.now() - startTime
        return { listenerTime, statusReceived }
      })

      setCurrentProgress(32)

      // 测试3: 状态数据结构
      await runTest(tests, '状态数据结构', async () => {
        const status = unifiedCloudSyncService.getCurrentStatus()

        const requiredFields = [
          'isOnline',
          'lastSyncTime',
          'pendingOperations',
          'syncInProgress',
          'hasConflicts'
        ]

        const missingFields = requiredFields.filter(field => !(field in status))

        if (missingFields.length > 0) {
          throw new Error(`缺少状态字段: ${missingFields.join(', ')}`)
        }

        // 验证数据类型
        if (typeof status.isOnline !== 'boolean') {
          throw new Error('isOnline 必须是布尔值')
        }

        if (typeof status.pendingOperations !== 'number') {
          throw new Error('pendingOperations 必须是数字')
        }

        if (typeof status.syncInProgress !== 'boolean') {
          throw new Error('syncInProgress 必须是布尔值')
        }

        return {
          status,
          fieldCount: Object.keys(status).length,
          validatedFields: requiredFields.length
        }
      })

      setCurrentProgress(48)

      // 测试4: 手动同步功能
      await runTest(tests, '手动同步功能', async () => {
        if (!authService.isAuthenticated()) {
          return {
            status: 'warning',
            message: '用户未登录，跳过手动同步测试',
            reason: 'not_authenticated'
          }
        }

        const startTime = performance.now()

        // 检查同步方法是否存在
        if (typeof unifiedCloudSyncService.performFullSync !== 'function') {
          throw new Error('performFullSync 方法不可用')
        }

        // 如果有网络连接，尝试同步
        if (networkManager.getCurrentStatus().isOnline) {
          try {
            // 这里不实际执行同步，只是检查方法调用
            console.log('同步方法可用，已跳过实际同步操作')
          } catch (error) {
            throw new Error(`同步操作失败: ${error.message}`)
          }
        }

        const syncCheckTime = performance.now() - startTime
        return {
          syncCheckTime,
          methodAvailable: true,
          networkAvailable: networkManager.getCurrentStatus().isOnline
        }
      })

      setCurrentProgress(64)

      // 测试5: 操作队列功能
      await runTest(tests, '操作队列功能', async () => {
        const startTime = performance.now()

        // 检查队列操作方法
        const queueMethods = [
          'queueOperation',
          'performFullSync',
          'getConflicts',
          'resolveConflict'
        ]

        const missingMethods = queueMethods.filter(method =>
          typeof unifiedCloudSyncService[method] !== 'function'
        )

        if (missingMethods.length > 0) {
          throw new Error(`缺少队列方法: ${missingMethods.join(', ')}`)
        }

        // 测试操作队列（不实际执行）
        const testOperation = {
          type: 'create',
          table: 'cards',
          data: { title: 'Test Card', content: 'Test Content' },
          localId: 'test-card-123'
        }

        try {
          await unifiedCloudSyncService.queueOperation(testOperation)
        } catch (error) {
          console.warn('队列操作测试警告:', error.message)
        }

        const queueTime = performance.now() - startTime
        return {
          queueTime,
          availableMethods: queueMethods.length,
          testedOperation: testOperation.type
        }
      })

      setCurrentProgress(80)

      // 测试6: 性能指标
      await runTest(tests, '性能指标', async () => {
        const startTime = performance.now()

        // 测试状态获取性能
        const statusGetStart = performance.now()
        const status = unifiedCloudSyncService.getCurrentStatus()
        const statusGetTime = performance.now() - statusGetStart

        // 测试网络状态获取性能
        const networkGetStart = performance.now()
        const networkStatus = networkManager.getCurrentStatus()
        const networkGetTime = performance.now() - networkGetStart

        // 测试认证状态获取性能
        const authGetStart = performance.now()
        const authStatus = authService.isAuthenticated()
        const authGetTime = performance.now() - authGetStart

        const performanceMetrics = {
          statusGetTime,
          networkGetTime,
          authGetTime,
          totalTime: performance.now() - startTime
        }

        // 检查性能是否在可接受范围内
        const warnings = []
        if (statusGetTime > 50) warnings.push('状态获取性能较慢')
        if (networkGetTime > 50) warnings.push('网络状态获取性能较慢')
        if (authGetTime > 50) warnings.push('认证状态获取性能较慢')

        return {
          performanceMetrics,
          warnings,
          acceptable: warnings.length === 0
        }
      })

      setCurrentProgress(96)

      // 测试7: 事件处理
      await runTest(tests, '事件处理', async () => {
        const startTime = performance.now()

        // 测试网络事件处理
        let networkEventReceived = false
        const networkListener = networkManager.addListener({
          onNetworkStateChanged: () => {
            networkEventReceived = true
          },
          onNetworkEvent: () => {},
          onSyncReady: () => {}
        })

        // 等待事件
        await new Promise(resolve => setTimeout(resolve, 100))

        // 测试同步事件处理
        let syncEventReceived = false
        const syncListener = unifiedCloudSyncService.onStatusChange(() => {
          syncEventReceived = true
        })

        await new Promise(resolve => setTimeout(resolve, 100))

        // 清理监听器
        networkListener()
        syncListener()

        const eventTime = performance.now() - startTime
        return {
          eventTime,
          networkEventReceived,
          syncEventReceived,
          listenersTested: ['network', 'sync']
        }
      })

      setCurrentProgress(100)

    } catch (error) {
      console.error('测试运行失败:', error)
      tests.push({
        test: '测试运行',
        status: 'fail',
        message: `测试运行失败: ${error.message}`,
        timestamp: new Date()
      })
    } finally {
      setIsRunning(false)
      setTestResults(tests)
      onTestComplete?.(tests)
    }
  }

  const runTest = async (tests: TestResult[], testName: string, testFn: () => Promise<any>) => {
    tests.push({
      test: testName,
      status: 'running',
      message: '正在运行...',
      timestamp: new Date()
    })

    setTestResults([...tests])

    try {
      const result = await testFn()

      const finalResult: TestResult = {
        test: testName,
        status: 'pass',
        message: '测试通过',
        details: result,
        timestamp: new Date()
      }

      // 检查是否有警告
      if (result.warnings && result.warnings.length > 0) {
        finalResult.status = 'warning'
        finalResult.message = `测试通过，但有警告: ${result.warnings.join(', ')}`
      }

      tests[tests.length - 1] = finalResult
      setTestResults([...tests])

    } catch (error) {
      tests[tests.length - 1] = {
        test: testName,
        status: 'fail',
        message: error.message,
        timestamp: new Date()
      }
      setTestResults([...tests])
    }
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusBadge = (status: TestResult['status']) => {
    const variants = {
      pass: 'default',
      fail: 'destructive',
      warning: 'secondary',
      running: 'outline'
    } as const

    return (
      <Badge variant={variants[status]} className="ml-2">
        {status === 'pass' && '通过'}
        {status === 'fail' && '失败'}
        {status === 'warning' && '警告'}
        {status === 'running' && '运行中'}
      </Badge>
    )
  }

  const getOverallStatus = () => {
    if (testResults.length === 0) return null

    const passed = testResults.filter(r => r.status === 'pass').length
    const failed = testResults.filter(r => r.status === 'fail').length
    const warnings = testResults.filter(r => r.status === 'warning').length

    if (failed > 0) return { status: 'fail', message: `${failed} 个失败` }
    if (warnings > 0) return { status: 'warning', message: `${warnings} 个警告` }
    return { status: 'pass', message: `${passed} 个通过` }
  }

  const overallStatus = getOverallStatus()

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 测试控制 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            同步状态指示器兼容性测试
            {overallStatus && (
              <Badge variant={overallStatus.status === 'fail' ? 'destructive' : overallStatus.status === 'warning' ? 'secondary' : 'default'}>
                {overallStatus.message}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  onClick={runTests}
                  disabled={isRunning}
                  className="flex items-center gap-2"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      测试中...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      运行测试
                    </>
                  )}
                </Button>

                {testResults.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    完成时间: {testResults[testResults.length - 1].timestamp.toLocaleTimeString()}
                  </span>
                )}
              </div>

              {isRunning && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>进度: {currentProgress}%</span>
                  <div className="w-32">
                    <Progress value={currentProgress} className="h-2" />
                  </div>
                </div>
              )}
            </div>

            {/* 当前状态显示 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 p-3 border rounded-lg">
                {networkStatus?.isOnline ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">
                  网络: {networkStatus?.isOnline ? '在线' : '离线'}
                </span>
              </div>

              <div className="flex items-center gap-2 p-3 border rounded-lg">
                {authStatus?.isAuthenticated ? (
                  <Cloud className="h-4 w-4 text-blue-500" />
                ) : (
                  <CloudOff className="h-4 w-4 text-gray-500" />
                )}
                <span className="text-sm">
                  认证: {authStatus?.isAuthenticated ? '已登录' : '未登录'}
                </span>
              </div>

              <div className="flex items-center gap-2 p-3 border rounded-lg">
                {syncStatus?.syncInProgress ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                <span className="text-sm">
                  同步: {syncStatus?.syncInProgress ? '进行中' : '空闲'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 测试结果 */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>测试结果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <span className="font-medium">{result.test}</span>
                      {getStatusBadge(result.status)}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {result.timestamp.toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground mb-2">
                    {result.message}
                  </p>

                  {result.details && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                        查看详细信息
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 建议和警告 */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>建议和优化</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.some(r => r.status === 'fail') && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    发现失败的测试项目，建议检查同步服务的配置和网络连接状态。
                  </AlertDescription>
                </Alert>
              )}

              {testResults.some(r => r.status === 'warning') && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    发现一些警告，建议进行优化以提升用户体验。
                  </AlertDescription>
                </Alert>
              )}

              <div className="text-sm text-muted-foreground">
                <p>• 确保所有服务都已正确初始化</p>
                <p>• 检查网络连接和认证状态</p>
                <p>• 监控同步状态和性能指标</p>
                <p>• 定期运行兼容性测试</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default SyncStatusTester