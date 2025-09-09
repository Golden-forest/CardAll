import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Home, Copy } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // 调用自定义错误处理器
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // 记录错误到控制台
    console.error('Error Boundary caught an error:', error, errorInfo)

    // 显示错误通知
    toast({
      title: "应用错误",
      description: "发生了意外错误，请刷新页面或联系支持",
      variant: "destructive"
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  handleCopyError = () => {
    const { error, errorInfo, errorId } = this.state
    const errorDetails = {
      id: errorId,
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => {
        toast({
          title: "错误信息已复制",
          description: "错误详情已复制到剪贴板"
        })
      })
      .catch(() => {
        toast({
          title: "复制失败",
          description: "无法复制错误信息",
          variant: "destructive"
        })
      })
  }

  render() {
    if (this.state.hasError) {
      // 如果有自定义fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback
      }

      // 默认错误UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <CardTitle className="text-xl text-gray-900">
                哎呀，出错了！
              </CardTitle>
              <CardDescription className="text-gray-600">
                应用遇到了意外错误。我们已经记录了这个问题，请尝试以下解决方案：
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 错误详情 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">错误信息</span>
                  <span className="text-xs text-gray-500">ID: {this.state.errorId}</span>
                </div>
                <p className="text-sm text-gray-600 font-mono">
                  {this.state.error?.message || '未知错误'}
                </p>
              </div>

              {/* 操作按钮 */}
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={this.handleReload}
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  刷新页面
                </Button>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={this.handleGoHome}
                    className="flex-1"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    返回首页
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={this.handleCopyError}
                    className="flex-1"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    复制错误
                  </Button>
                </div>
              </div>

              {/* 开发者信息 */}
              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-700 hover:text-gray-900">
                    错误详情 (开发模式)
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook风格的错误边界
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  const captureError = React.useCallback((error: Error) => {
    setError(error)
  }, [])

  const clearError = React.useCallback(() => {
    setError(null)
  }, [])

  return { captureError, clearError, error }
}

// 全局错误处理器
export function setupGlobalErrorHandlers() {
  // 处理未捕获的JavaScript错误
  window.addEventListener('error', (event) => {
    console.error('Global error handler:', event.error)
    
    toast({
      title: "JavaScript错误",
      description: event.error?.message || "发生了JavaScript错误",
      variant: "destructive"
    })
  })

  // 处理未捕获的Promise拒绝
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason)
    
    toast({
      title: "Promise错误",
      description: event.reason?.message || "Promise被拒绝",
      variant: "destructive"
    })
  })

  // 处理资源加载错误
  window.addEventListener('error', (event) => {
    if (event.target && ('src' in event.target || 'href' in event.target)) {
      console.error('Resource loading error:', event.target)
      
      toast({
        title: "资源加载失败",
        description: "无法加载页面资源",
        variant: "destructive"
      })
    }
  }, true)
}

// 错误报告工具
export class ErrorReporter {
  private static instance: ErrorReporter
  private errors: Array<{
    id: string
    error: Error
    errorInfo?: ErrorInfo
    timestamp: Date
    context?: any
  }> = []

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter()
    }
    return ErrorReporter.instance
  }

  report(error: Error, errorInfo?: ErrorInfo, context?: any) {
    const errorReport = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      error,
      errorInfo,
      timestamp: new Date(),
      context
    }

    this.errors.push(errorReport)
    
    // 限制错误报告数量
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100)
    }

    console.error('Error reported:', errorReport)
    return errorReport.id
  }

  getErrors() {
    return [...this.errors]
  }

  clearErrors() {
    this.errors = []
  }

  getErrorCount() {
    return this.errors.length
  }
}