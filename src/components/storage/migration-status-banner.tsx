import React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Database,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  RotateCcw,
  Loader2
} from 'lucide-react'
import { useStorageAdapter } from '@/hooks/use-cards-adapter'
import { CardAllProviderAdapter } from '@/services/cardall-provider-adapter'

interface MigrationStatusBannerProps {
  className?: string
}

export function MigrationStatusBanner({ className }: MigrationStatusBannerProps) {
  const {
    mode,
    isReady,
    migrationProgress,
    retryMigration,
    rollbackMigration
  } = useStorageAdapter()

  // 如果系统已经就绪且不是迁移模式，不显示横幅
  if (isReady && mode !== 'migrating') {
    return null
  }

  // 系统正在迁移中
  if (mode === 'migrating' && migrationProgress) {
    return (
      <div className={`border-b bg-background ${className}`}>
        <div className="container px-4 py-3">
          <Alert className="mb-0">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle className="flex items-center gap-2">
              数据迁移中
              <Badge variant="outline">
                {Math.round(migrationProgress.progress)}%
              </Badge>
            </AlertTitle>
            <AlertDescription className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {migrationProgress.message}
                </p>
                <Progress value={migrationProgress.progress} className="w-full" />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Database className="h-3 w-3" />
                <span>正在从 localStorage 迁移到 IndexedDB...</span>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  // 系统未就绪（初始化中）
  if (!isReady) {
    return (
      <div className={`border-b bg-background ${className}`}>
        <div className="container px-4 py-3">
          <Alert className="mb-0">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>系统初始化中</AlertTitle>
            <AlertDescription>
              正在准备数据存储系统，请稍候...
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  // 迁移失败或回退到localStorage
  return (
    <div className={`border-b bg-background ${className}`}>
      <div className="container px-4 py-3">
        <Alert className="mb-0">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <AlertTitle className="flex items-center gap-2">
            使用 localStorage 模式
            <Badge variant="outline">降级运行</Badge>
          </AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="text-sm">
              系统当前使用 localStorage 存储数据。IndexedDB 迁移可能遇到了问题。
            </p>
            <div className="flex items-center gap-2">
              <Database className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-muted-foreground">
                当前存储模式: localStorage
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={retryMigration}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                重试迁移
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={rollbackMigration}
                className="flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                回滚备份
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}

interface StorageModeIndicatorProps {
  className?: string
  showLabel?: boolean
}

export function StorageModeIndicator({ className, showLabel = true }: StorageModeIndicatorProps) {
  const { mode, isReady, isUsingIndexedDB, isUsingLocalStorage } = useStorageAdapter()

  if (!isReady) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        {showLabel && <span className="text-sm text-muted-foreground">初始化中...</span>}
      </div>
    )
  }

  if (isUsingIndexedDB) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Database className="h-4 w-4 text-green-500" />
        {showLabel && (
          <>
            <span className="text-sm">IndexedDB</span>
            <CheckCircle className="h-3 w-3 text-green-500" />
          </>
        )}
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Database className="h-4 w-4 text-orange-500" />
      {showLabel && (
        <>
          <span className="text-sm">localStorage</span>
          <AlertTriangle className="h-3 w-3 text-orange-500" />
        </>
      )}
    </div>
  )
}