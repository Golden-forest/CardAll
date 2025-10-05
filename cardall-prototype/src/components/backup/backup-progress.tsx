/**
 * 备份进度组件 (Backup Progress)
 * 
 * 显示备份操作的实时进度
 */

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Database, 
  FileText,
  Settings,
  Save
} from 'lucide-react'
import type { BackupProgress as BackupProgressType } from '@/types/backup'

interface BackupProgressProps {
  progress: BackupProgressType | null
  isActive: boolean
  onComplete?: () => void
  className?: string
}

export function BackupProgress({ 
  progress, 
  isActive, 
  onComplete, 
  className 
}: BackupProgressProps) {
  const [showCompletion, setShowCompletion] = useState(false)

  useEffect(() => {
    if (progress?.stage === 'completed' && isActive) {
      setShowCompletion(true)
      onComplete?.()
      
      // 3秒后隐藏完成状态
      const timer = setTimeout(() => {
        setShowCompletion(false)
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [progress?.stage, isActive, onComplete])

  if (!progress || !isActive) {
    return null
  }

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'preparing':
        return <Settings className="h-4 w-4" />
      case 'collecting':
        return <Database className="h-4 w-4" />
      case 'processing':
        return <FileText className="h-4 w-4" />
      case 'compressing':
        return <Save className="h-4 w-4" />
      case 'saving':
        return <Save className="h-4 w-4" />
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      case 'error':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200'
    }
  }

  const formatTime = (milliseconds: number): string => {
    const seconds = Math.round(milliseconds / 1000)
    if (seconds < 60) {
      return `${seconds}秒`
    }
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}分${remainingSeconds}秒`
  }

  const getElapsedTime = (): string => {
    const now = Date.now()
    const elapsed = now - progress.startTime.getTime()
    return formatTime(elapsed)
  }

  const isActiveStage = (stage: string): boolean => {
    return progress.stage === stage || 
           (progress.stage === 'completed' && stage === 'saving') ||
           (progress.stage === 'error' && stage === progress.stage)
  }

  const stages = [
    { key: 'preparing', label: '准备备份', description: '初始化备份环境' },
    { key: 'collecting', label: '收集数据', description: '从数据库收集数据' },
    { key: 'processing', label: '处理数据', description: '格式化和处理数据' },
    { key: 'compressing', label: '压缩数据', description: '压缩备份数据' },
    { key: 'saving', label: '保存备份', description: '保存到本地存储' },
    { key: 'completed', label: '完成', description: '备份创建成功' }
  ]

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStageIcon(progress.stage)}
            <CardTitle className="text-lg">备份进度</CardTitle>
          </div>
          <Badge className={getStageColor(progress.stage)}>
            {progress.message}
          </Badge>
        </div>
        {progress.stage !== 'completed' && progress.stage !== 'error' && (
          <CardDescription>
            已用时间: {getElapsedTime()}
            {progress.estimatedTimeRemaining > 0 && 
              ` | 预计剩余: ${formatTime(progress.estimatedTimeRemaining)}`
            }
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 进度条 */}
        {progress.stage !== 'completed' && progress.stage !== 'error' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>总体进度</span>
              <span>{progress.progress}%</span>
            </div>
            <Progress value={progress.progress} className="w-full" />
          </div>
        )}

        {/* 阶段指示器 */}
        <div className="space-y-3">
          <div className="text-sm font-medium">备份阶段</div>
          <div className="space-y-2">
            {stages.map((stage, index) => {
              const isStageActive = isActiveStage(stage.key)
              const isCompleted = progress.stage === 'completed' || 
                               (stages.findIndex(s => s.key === progress.stage) > index)
              
              return (
                <div 
                  key={stage.key}
                  className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    isStageActive ? 'bg-blue-50 border border-blue-200' : 
                    isCompleted ? 'bg-green-50' : 'bg-muted/30'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isStageActive ? 'bg-blue-600 text-white' :
                    isCompleted ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <span className="text-xs">{index + 1}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{stage.label}</div>
                    <div className="text-xs text-muted-foreground">{stage.description}</div>
                  </div>
                  {getStageIcon(stage.key)}
                </div>
              )
            })}
          </div>
        </div>

        {/* 错误信息 */}
        {progress.stage === 'error' && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              <div className="font-medium">备份失败</div>
              {progress.details && (
                <div className="mt-1 text-sm">
                  {typeof progress.details === 'string' 
                    ? progress.details 
                    : progress.details?.message || '未知错误'
                  }
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* 完成状态 */}
        {showCompletion && progress.stage === 'completed' && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
              <div className="font-medium">备份创建成功！</div>
              <div className="text-sm mt-1">
                备份已完成并保存到本地存储
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* 详细信息 */}
        {progress.details && progress.stage !== 'error' && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div>开始时间: {progress.startTime.toLocaleString('zh-CN')}</div>
            {progress.details.cardCount !== undefined && (
              <div>卡片数量: {progress.details.cardCount}</div>
            )}
            {progress.details.folderCount !== undefined && (
              <div>文件夹数量: {progress.details.folderCount}</div>
            )}
            {progress.details.tagCount !== undefined && (
              <div>标签数量: {progress.details.tagCount}</div>
            )}
            {progress.details.imageCount !== undefined && (
              <div>图片数量: {progress.details.imageCount}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}