import React, { useEffect, useState } from 'react'
import { Dashboard } from '@/components/dashboard'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { AuthModalEnhanced } from '@/components/auth/auth-modal-enhanced'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { CardAllProvider } from '@/contexts/cardall-context'
import { StylePanelProvider } from '@/contexts/style-panel-context'
import { TagPanelProvider } from '@/contexts/tag-panel-context'
import { AuthModalProvider, useAuthModal } from '@/contexts/auth-modal-context'
import { appInitService, type InitializationResult } from '@/services/app-init'
import { initializeDatabase } from '@/services/database'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import './globals.css'

function AppContent() {
  const { isOpen, closeModal } = useAuthModal()
  const [initializationResult, setInitializationResult] = useState<InitializationResult | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)

  // 应用初始化
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Starting app initialization...')
        
        // 监听初始化状态
        const unsubscribe = appInitService.onStatusChange((status) => {
          console.log('📊 Initialization status:', status)
        })

        // 执行初始化
        const result = await appInitService.initialize()
        setInitializationResult(result)
        
        if (!result.success) {
          setInitError(result.error || '初始化失败')
        }
        
        console.log('✅ App initialization completed:', result)
        unsubscribe()
      } catch (error) {
        console.error('❌ App initialization failed:', error)
        setInitError(error instanceof Error ? error.message : '未知错误')
      } finally {
        setIsInitializing(false)
      }
    }

    initializeApp()
  }, [])

  // 重新初始化
  const handleReinitialize = async () => {
    setIsInitializing(true)
    setInitError(null)
    
    try {
      const result = await appInitService.reinitialize()
      setInitializationResult(result)
      
      if (!result.success) {
        setInitError(result.error || '重新初始化失败')
      }
    } catch (error) {
      setInitError(error instanceof Error ? error.message : '未知错误')
    } finally {
      setIsInitializing(false)
    }
  }

  // 显示初始化加载状态
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <h2 className="text-xl font-semibold">正在初始化应用...</h2>
          <p className="text-muted-foreground">
            正在准备数据库和同步服务，请稍候...
          </p>
        </div>
      </div>
    )
  }

  // 显示初始化错误
  if (initError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <h2 className="text-xl font-semibold text-destructive">初始化失败</h2>
          <p className="text-muted-foreground">{initError}</p>
          <div className="space-y-2">
            <Button onClick={handleReinitialize} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              重新初始化
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                localStorage.clear()
                window.location.reload()
              }}
              className="w-full"
            >
              清除数据并刷新
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <CardAllProvider>
        <StylePanelProvider>
          <TagPanelProvider>
            <Dashboard />
          </TagPanelProvider>
        </StylePanelProvider>
      </CardAllProvider>
      
      {/* PWA Install Prompt */}
      <InstallPrompt />
      
      {/* Authentication Modal */}
      <AuthModalEnhanced open={isOpen} onOpenChange={closeModal} />
      
      <Toaster />
    </div>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="cardall-theme">
      <AuthModalProvider>
        <AppContent />
      </AuthModalProvider>
    </ThemeProvider>
  )
}

export default App