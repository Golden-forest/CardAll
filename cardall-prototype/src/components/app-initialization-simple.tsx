import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, FolderOpen, Database } from 'lucide-react'
import { initializeDatabase } from '@/services/database'

interface SimpleInitializationProps {
  onInitialized: () => void
}

export function SimpleAppInitialization({ onInitialized }: SimpleInitializationProps) {
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('准备初始化...')
  const [isComplete, setIsComplete] = useState(false)
  const [hasError, setHasError] = useState(false)

  const startInitialization = async () => {
    try {
      setMessage('正在初始化数据库...')
      setProgress(25)
      
      await initializeDatabase()
      
      setMessage('数据库初始化完成')
      setProgress(75)
      
      // 模拟一些额外的初始化步骤
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setMessage('应用初始化完成')
      setProgress(100)
      setIsComplete(true)
      
      // 延迟一下让用户看到完成状态
      setTimeout(() => {
        onInitialized()
      }, 1000)
      
    } catch (error) {
      console.error('Initialization failed:', error)
      setHasError(true)
      setMessage(`初始化失败: ${  error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  useEffect(() => {
    startInitialization()
  }, [])

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
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* 当前状态 */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            {hasError ? (
              <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
                <span className="text-white text-xs">!</span>
              </div>
            ) : isComplete ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <Database className="h-5 w-5 text-blue-500" />
            )}
            <div className="flex-1">
              <div className="font-medium">{message}</div>
            </div>
          </div>

          {/* 操作按钮 */}
          {hasError && (
            <Button onClick={startInitialization} className="w-full">
              重试初始化
            </Button>
          )}

          {isComplete && (
            <Button onClick={onInitialized} className="w-full">
              <CheckCircle className="h-4 w-4 mr-2" />
              进入应用
            </Button>
          )}

          {/* 帮助信息 */}
          <div className="text-xs text-muted-foreground text-center">
            <p>正在初始化CardAll应用...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}