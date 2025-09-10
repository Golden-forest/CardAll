import React from 'react'
import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  animate?: boolean
}

export function Skeleton({ className, animate = true }: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-gray-200 rounded-md",
        animate && "animate-pulse",
        className
      )}
    />
  )
}

interface CardSkeletonProps {
  count?: number
  showImage?: boolean
  showTags?: boolean
}

export function CardSkeleton({ count = 1, showImage = true, showTags = true }: CardSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          {/* 卡片标题 */}
          <div className="space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>

          {/* 卡片图片 */}
          {showImage && (
            <div className="aspect-video bg-gray-100 rounded-lg">
              <Skeleton className="h-full w-full" />
            </div>
          )}

          {/* 卡片标签 */}
          {showTags && (
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          )}

          {/* 卡片操作按钮 */}
          <div className="flex justify-between items-center pt-2">
            <div className="flex gap-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
            <Skeleton className="h-8 w-16 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

interface FolderSkeletonProps {
  count?: number
  showTree?: boolean
}

export function FolderSkeleton({ count = 1, showTree = false }: FolderSkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-2 p-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-8 rounded-full ml-auto" />
          
          {showTree && (
            <div className="ml-6 space-y-2">
              <div className="flex items-center gap-2 p-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-6 rounded-full ml-auto" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

interface TagSkeletonProps {
  count?: number
  showPopular?: boolean
}

export function TagSkeleton({ count = 1, showPopular = false }: TagSkeletonProps) {
  return (
    <div className="space-y-4">
      {/* 搜索框 */}
      <Skeleton className="h-10 w-full" />

      {/* 热门标签 */}
      {showPopular && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-6 w-16 rounded-full" />
            ))}
          </div>
        </div>
      )}

      {/* 所有标签 */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: count }).map((_, index) => (
            <div key={index} className="flex items-center gap-1">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-4 w-6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface DashboardSkeletonProps {
  showSidebar?: boolean
  showCards?: boolean
  showFilters?: boolean
}

export function DashboardSkeleton({ 
  showSidebar = true, 
  showCards = true, 
  showFilters = true 
}: DashboardSkeletonProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* 侧边栏骨架 */}
      {showSidebar && (
        <div className="w-80 bg-white border-r border-gray-200 p-6 space-y-6">
          {/* 用户信息 */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>

          {/* 文件夹骨架 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-6 w-16 rounded" />
            </div>
            <FolderSkeleton count={3} showTree={true} />
          </div>

          {/* 标签骨架 */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-10" />
            <TagSkeleton count={8} showPopular={true} />
          </div>
        </div>
      )}

      {/* 主内容区骨架 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部操作栏骨架 */}
        <div className="bg-white border-b border-gray-200 p-6 space-y-4">
          {/* 搜索和操作栏 */}
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-20 rounded" />
            <Skeleton className="h-10 w-20 rounded" />
            <Skeleton className="h-10 w-20 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>

          {/* 过滤器骨架 */}
          {showFilters && (
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-12 rounded" />
            </div>
          )}
        </div>

        {/* 卡片网格骨架 */}
        {showCards && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <CardSkeleton count={6} showImage={true} showTags={true} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  }

  return (
    <div className={cn("animate-spin rounded-full border-2 border-gray-300 border-t-blue-500", sizeClasses[size], className)} />
  )
}

interface LoadingOverlayProps {
  message?: string
  showSpinner?: boolean
}

export function LoadingOverlay({ message = "加载中...", showSpinner = true }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 flex flex-col items-center space-y-4">
        {showSpinner && <LoadingSpinner size="lg" />}
        <p className="text-gray-700 font-medium">{message}</p>
      </div>
    </div>
  )
}

// 页面级加载组件
interface PageLoaderProps {
  isLoading: boolean
  children: React.ReactNode
  skeleton?: React.ReactNode
  error?: Error | null
  retry?: () => void
}

export function PageLoader({ 
  isLoading, 
  children, 
  skeleton, 
  error, 
  retry 
}: PageLoaderProps) {
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="text-red-500 text-lg">加载失败</div>
          <p className="text-gray-600">{error.message}</p>
          {retry && (
            <button 
              onClick={retry}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              重试
            </button>
          )}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return skeleton || <DashboardSkeleton />
  }

  return <>{children}</>
}

// Hook风格的加载状态管理
export function useLoadingState() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  const withLoading = React.useCallback(async <T>(
    operation: () => Promise<T>
  ): Promise<T> => {
    setIsLoading(true)
    setError(null)
    
    try {
      const result = await operation()
      return result
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearError = React.useCallback(() => {
    setError(null)
  }, [])

  return {
    isLoading,
    error,
    withLoading,
    clearError,
    setIsLoading
  }
}