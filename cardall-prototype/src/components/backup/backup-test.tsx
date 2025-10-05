/**
 * 备份功能测试组件
 * 
 * 用于测试和验证备份功能的各项特性
 */

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { 
  enhancedLocalBackupService,
  initializeEnhancedBackup
} from '@/services/enhanced-local-backup-service'
import { 
  Database, 
  Shield, 
  CheckCircle, 
  AlertTriangle,
  Play,
  RefreshCw
} from 'lucide-react'

interface TestResult {
  testName: string
  status: 'success' | 'error' | 'pending'
  message: string
  details?: any
  timestamp: Date
}

export function BackupTest() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [logOutput, setLogOutput] = useState('')

  const addTestResult = (result: Omit<TestResult, 'timestamp'>) => {
    const newResult: TestResult = {
      ...result,
      timestamp: new Date()
    }
    setTestResults(prev => [...prev, newResult])
    
    const logMessage = `[${newResult.timestamp.toISOString()}] ${result.testName}: ${result.status.toUpperCase()} - ${result.message}\n`
    setLogOutput(prev => prev + logMessage)
  }

  const log = (message: string) => {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}\n`
    setLogOutput(prev => prev + logMessage)
    console.log(message)
  }

  const initializeService = async () => {
    try {
      log('正在初始化备份服务...')
      await initializeEnhancedBackup({
        autoBackupEnabled: false, // 测试时禁用自动备份
        integrityCheckEnabled: false, // 测试时禁用自动检查
        cleanupOldBackups: false,
        maxAutoBackups: 3,
        backupRetentionDays: 7,
        maxBackupStorageSize: 50 * 1024 * 1024 // 50MB
      })
      setIsInitialized(true)
      log('备份服务初始化成功')
      addTestResult({
        testName: '服务初始化',
        status: 'success',
        message: '备份服务初始化成功'
      })
    } catch (error) {
      log(`备份服务初始化失败: ${error}`)
      addTestResult({
        testName: '服务初始化',
        status: 'error',
        message: `初始化失败: ${error}`,
        details: error
      })
    }
  }

  const runAllTests = async () => {
    if (!isInitialized) {
      await initializeService()
    }

    setIsRunning(true)
    setTestResults([])
    setLogOutput('')

    log('开始运行备份功能测试...')

    // 测试1: 创建手动备份
    try {
      log('测试1: 创建手动备份')
      const backupId = await enhancedLocalBackupService.createManualBackup({
        name: 'TestBackup_' + Date.now(),
        description: '测试备份',
        tags: ['test']
      })
      log(`备份创建成功: ${backupId}`)
      addTestResult({
        testName: '创建手动备份',
        status: 'success',
        message: `备份创建成功，ID: ${backupId.substring(0, 8)}...`,
        details: { backupId }
      })
    } catch (error) {
      log(`备份创建失败: ${error}`)
      addTestResult({
        testName: '创建手动备份',
        status: 'error',
        message: `备份创建失败: ${error}`,
        details: error
      })
    }

    // 测试2: 获取备份列表
    try {
      log('测试2: 获取备份列表')
      const backupList = await enhancedLocalBackupService.getBackupList()
      log(`获取到 ${backupList.length} 个备份`)
      addTestResult({
        testName: '获取备份列表',
        status: 'success',
        message: `成功获取 ${backupList.length} 个备份`,
        details: { backupCount: backupList.length }
      })
    } catch (error) {
      log(`获取备份列表失败: ${error}`)
      addTestResult({
        testName: '获取备份列表',
        status: 'error',
        message: `获取备份列表失败: ${error}`,
        details: error
      })
    }

    // 测试3: 数据导出
    try {
      log('测试3: 数据导出')
      await enhancedLocalBackupService.exportDataAsJSON({
        includeCards: true,
        includeFolders: true,
        includeTags: true,
        includeImages: false, // 测试时不包含图片
        includeSettings: true,
        filename: 'test_export'
      })
      log('数据导出成功')
      addTestResult({
        testName: '数据导出',
        status: 'success',
        message: '数据导出成功，文件已下载'
      })
    } catch (error) {
      log(`数据导出失败: ${error}`)
      addTestResult({
        testName: '数据导出',
        status: 'error',
        message: `数据导出失败: ${error}`,
        details: error
      })
    }

    // 测试4: 获取备份统计
    try {
      log('测试4: 获取备份统计')
      const statistics = await enhancedLocalBackupService.getBackupStatistics()
      log(`备份统计: 总数${statistics.totalBackups}, 存储${statistics.storageUsage}字节`)
      addTestResult({
        testName: '获取备份统计',
        status: 'success',
        message: `统计信息获取成功，总备份: ${statistics.totalBackups}`,
        details: statistics
      })
    } catch (error) {
      log(`获取备份统计失败: ${error}`)
      addTestResult({
        testName: '获取备份统计',
        status: 'error',
        message: `获取备份统计失败: ${error}`,
        details: error
      })
    }

    // 测试5: 配置更新
    try {
      log('测试5: 配置更新')
      const newConfig = {
        autoBackupEnabled: true,
        autoBackupInterval: 12 * 60 * 60 * 1000, // 12小时
        maxAutoBackups: 5
      }
      await enhancedLocalBackupService.updateConfig(newConfig)
      log('配置更新成功')
      addTestResult({
        testName: '配置更新',
        status: 'success',
        message: '配置更新成功',
        details: newConfig
      })
    } catch (error) {
      log(`配置更新失败: ${error}`)
      addTestResult({
        testName: '配置更新',
        status: 'error',
        message: `配置更新失败: ${error}`,
        details: error
      })
    }

    // 测试6: 完整性检查（如果启用）
    try {
      log('测试6: 数据完整性检查')
      const result = await enhancedLocalBackupService.runIntegrityCheck()
      log(`完整性检查完成，发现 ${result.summary.totalIssues} 个问题`)
      addTestResult({
        testName: '数据完整性检查',
        status: 'success',
        message: `检查完成，发现问题: ${result.summary.totalIssues}`,
        details: {
          totalIssues: result.summary.totalIssues,
          criticalIssues: result.summary.criticalIssues,
          autoFixed: result.autoFixed
        }
      })
    } catch (error) {
      log(`完整性检查失败: ${error}`)
      addTestResult({
        testName: '数据完整性检查',
        status: 'error',
        message: `完整性检查失败: ${error}`,
        details: error
      })
    }

    log('所有测试完成')
    setIsRunning(false)
  }

  const clearResults = () => {
    setTestResults([])
    setLogOutput('')
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
      default:
        return <Shield className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-700">成功</Badge>
      case 'error':
        return <Badge className="bg-red-100 text-red-700">失败</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">进行中</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-700">未知</Badge>
    }
  }

  const successCount = testResults.filter(r => r.status === 'success').length
  const errorCount = testResults.filter(r => r.status === 'error').length

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">备份功能测试</h1>
          <p className="text-muted-foreground">测试和验证备份功能的各项特性</p>
        </div>
        <div className="flex items-center gap-2">
          {isInitialized ? (
            <Badge className="bg-green-100 text-green-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              已初始化
            </Badge>
          ) : (
            <Badge className="bg-yellow-100 text-yellow-700">
              <AlertTriangle className="h-3 w-3 mr-1" />
              未初始化
            </Badge>
          )}
        </div>
      </div>

      {/* 控制面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            测试控制
          </CardTitle>
          <CardDescription>
            运行备份功能的各种测试用例
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={runAllTests} 
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              {isRunning ? '测试运行中...' : '运行所有测试'}
            </Button>
            
            {!isInitialized && (
              <Button 
                variant="outline" 
                onClick={initializeService}
                disabled={isRunning}
              >
                初始化服务
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={clearResults}
              disabled={isRunning}
            >
              清除结果
            </Button>
          </div>

          {testResults.length > 0 && (
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                成功: {successCount}
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                失败: {errorCount}
              </span>
              <span className="flex items-center gap-1">
                <Database className="h-4 w-4 text-blue-500" />
                总计: {testResults.length}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 测试结果 */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>测试结果</CardTitle>
            <CardDescription>
              各项测试的执行结果和详细信息
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <div className="mt-1">
                    {getStatusIcon(result.status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{result.testName}</h4>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(result.status)}
                        <span className="text-xs text-muted-foreground">
                          {result.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {result.message}
                    </p>
                    {result.details && (
                      <details className="mt-2">
                        <summary className="text-xs text-blue-600 cursor-pointer">
                          查看详细信息
                        </summary>
                        <pre className="text-xs bg-background p-2 rounded mt-1 overflow-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 日志输出 */}
      {logOutput && (
        <Card>
          <CardHeader>
            <CardTitle>运行日志</CardTitle>
            <CardDescription>
              详细的测试执行日志
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={logOutput}
              readOnly
              className="font-mono text-xs"
              rows={10}
              placeholder="测试日志将在这里显示..."
            />
          </CardContent>
        </Card>
      )}

      {/* 测试说明 */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>测试说明</AlertTitle>
        <AlertDescription>
          <div className="mt-2 space-y-2 text-sm">
            <div><strong>初始化测试</strong>: 验证备份服务能否正常初始化</div>
            <div><strong>备份创建测试</strong>: 验证手动备份功能是否正常</div>
            <div><strong>备份列表测试</strong>: 验证能否正确获取备份列表</div>
            <div><strong>数据导出测试</strong>: 验证数据导出功能是否正常</div>
            <div><strong>统计信息测试</strong>: 验证备份统计功能是否正常</div>
            <div><strong>配置更新测试</strong>: 验证配置更新功能是否正常</div>
            <div><strong>完整性检查测试</strong>: 验证数据完整性检查功能</div>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}