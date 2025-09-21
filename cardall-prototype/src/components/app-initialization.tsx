import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, AlertCircle, RefreshCw, FolderOpen } from 'lucide-react'
import { appInitService, InitializationStatus, InitializationResult } from '@/services/app-init'

interface AppInitializationProps {
  onInitialized: (_result: InitializationResult) => void
  onError?: (_error: string) => void
  onSkipInitialization?: () => void
}

export function AppInitialization({ onInitialized, onError, onSkipInitialization }: AppInitializationProps) {
  const [status, setStatus] = useState<InitializationStatus>({
    step: 'starting',
    progress: 0,
    message: '准备初始化...',
    isComplete: false,
    hasError: false
  })
  const [isInitializing, setIsInitializing] = useState(false)
  const [result, setResult] = useState<InitializationResult | null>(null)

  // 开始初始化
  const startInitialization = async () => {
    console.log('开始初始化流程...')
    console.log('时间戳:', new Date().toISOString())
    setIsInitializing(true)
    setResult(null)

    try {
      console.log('调用appInitService.initialize()...')
      const initResult = await appInitService.initialize()
      console.log('初始化结果:', initResult)
      console.log('结果详情:', JSON.stringify(initResult, null, 2))
      setResult(initResult)

      if (initResult.success) {
        console.log('初始化成功，准备进入应用...')
        console.log('成功时间戳:', new Date().toISOString())
        // 延迟一下让用户看到完成状态
        setTimeout(() => {
          onInitialized(initResult)
        }, 1000)
      } else {
        console.log('初始化失败:', initResult.error)
        console.log('失败时间戳:', new Date().toISOString())
      }
    } catch (error) {
      console.error('初始化过程出错:', error)
      console.error('错误时间戳:', new Date().toISOString())
      if (onError) {
        onError(error instanceof Error ? error.message : '初始化失败')
      }
    } finally {
      setIsInitializing(false)
    }
  }

  // 监听初始化状态
  useEffect(() => {
    console.log('设置状态监听器...')
    const unsubscribe = appInitService.onStatusChange((newStatus) => {
      console.log('收到状态更新:', newStatus)
      setStatus(newStatus)
    })
    console.log('状态监听器设置完成')
    return unsubscribe
  }, [])

  // 自动开始初始化
  useEffect(() => {
    startInitialization()
  }, [])

  const getStepIcon = (step: string, hasError: boolean, isComplete: boolean) => {
    if (hasError) {
      return <AlertCircle className="h-5 w-5 text-destructive" />
    }
    if (isComplete) {
      return <CheckCircle className="h-5 w-5 text-green-500" />
    }
    return <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
  }

  const getStepDescription = (step: string) => {
    const descriptions: Record<string, string> = {
      'database': '初始化本地数据库，设置数据存储结构',
      'migration-check': '检查是否有需要从localStorage迁移的数据',
      'migration': '将现有数据迁移到新的数据库结构',
      'filesystem': '请求文件系统访问权限以支持本地文件存储',
      'sync': '初始化同步服务，准备离线和在线数据同步',
      'complete': '所有组件初始化完成，应用准备就绪'
    }
    return descriptions[step] || '正在处理...'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <FolderOpen className="h-6 w-6 text-blue-600" />
            CardAll 初始化
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 进度条 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>初始化进度</span>
              <span>{status.progress}%</span>
            </div>
            <Progress value={status.progress} className="h-2" />
          </div>

          {/* 当前状态 */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            {getStepIcon(status.step, status.hasError, status.isComplete)}
            <div className="flex-1">
              <div className="font-medium">{status.message}</div>
              <div className="text-sm text-muted-foreground">
                {getStepDescription(status.step)}
              </div>
            </div>
          </div>

          {/* 错误信息 */}
          {status.hasError && status.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {status.error}
              </AlertDescription>
            </Alert>
          )}

          {/* 迁移结果 */}
          {result?.migrationResult && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                数据迁移完成: {result.migrationResult.migratedCards} 张卡片, {' '}
                {result.migrationResult.migratedFolders} 个文件夹, {' '}
                {result.migrationResult.migratedTags} 个标签, {' '}
                {result.migrationResult.migratedImages} 张图片
              </AlertDescription>
            </Alert>
          )}

          {/* 文件系统访问状态 */}
          {result && (
            <Alert variant={result.fileSystemAccess ? "default" : "destructive"}>
              <FolderOpen className="h-4 w-4" />
              <AlertDescription>
                {result.fileSystemAccess 
                  ? "文件系统访问权限已获得，支持本地文件存储"
                  : "未获得文件系统访问权限，将使用浏览器内置存储"
                }
              </AlertDescription>
            </Alert>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            {status.hasError && (
              <>
                <Button
                  onClick={startInitialization}
                  disabled={isInitializing}
                  className="flex-1"
                >
                  {isInitializing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      重试中...
                    </>
                  ) : (
                    '重试初始化'
                  )}
                </Button>
                {onSkipInitialization && (
                  <Button
                    onClick={onSkipInitialization}
                    variant="outline"
                    className="flex-1"
                  >
                    跳过初始化
                  </Button>
                )}
              </>
            )}

            {result?.success && (
              <Button
                onClick={() => onInitialized(result)}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                进入应用
              </Button>
            )}
          </div>

          {/* 帮助信息 */}
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>首次启动需要初始化数据库和同步服务</p>
            <p>如果有现有数据，将自动迁移到新的存储结构</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}