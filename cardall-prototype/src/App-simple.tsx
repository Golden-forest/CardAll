import React, { useState } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { SimpleAppInitialization } from '@/components/app-initialization-simple'
import { SimpleDatabaseTest } from '@/components/database-test-simple'
import { ImageTest } from '@/components/image-test'
import { AuthModal } from '@/components/auth/auth-modal'
import { SyncStatusIndicator } from '@/components/sync/sync-status'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { PWAStatus } from '@/components/pwa/pwa-status'
import { Button } from '@/components/ui/button'
import { Database, Home, Image, User, Cloud } from 'lucide-react'
import './globals.css'

// 简化版本的App，用于测试基础功能
function SimpleApp() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [currentView, setCurrentView] = useState<'home' | 'database' | 'image' | 'auth'>('home')
  const [showAuthModal, setShowAuthModal] = useState(false)

  const handleInitialized = () => {
    setIsInitialized(true)
  }

  return (
    <ThemeProvider defaultTheme="light" storageKey="cardall-theme">
      <div className="min-h-screen bg-background">
        {!isInitialized ? (
          <SimpleAppInitialization onInitialized={handleInitialized} />
        ) : (
          <>
            {/* 顶部导航栏 */}
            <div className="fixed top-4 left-4 right-4 z-50 flex justify-between items-center">
              {/* 左侧导航按钮 */}
              <div className="flex gap-2">
                <Button
                  onClick={() => setCurrentView('home')}
                  variant={currentView === 'home' ? 'default' : 'outline'}
                  size="sm"
                  className="bg-white shadow-lg"
                >
                  <Home className="h-4 w-4 mr-2" />
                  主页
                </Button>
                <Button
                  onClick={() => setCurrentView('database')}
                  variant={currentView === 'database' ? 'default' : 'outline'}
                  size="sm"
                  className="bg-white shadow-lg"
                >
                  <Database className="h-4 w-4 mr-2" />
                  数据库
                </Button>
                <Button
                  onClick={() => setCurrentView('image')}
                  variant={currentView === 'image' ? 'default' : 'outline'}
                  size="sm"
                  className="bg-white shadow-lg"
                >
                  <Image className="h-4 w-4 mr-2" />
                  图片测试
                </Button>
              </div>

              {/* 右侧状态和认证 */}
              <div className="flex items-center gap-2">
                <PWAStatus />
                <SyncStatusIndicator />
                <Button
                  onClick={() => setShowAuthModal(true)}
                  variant="outline"
                  size="sm"
                  className="bg-white shadow-lg"
                >
                  <User className="h-4 w-4 mr-2" />
                  账户
                </Button>
              </div>
            </div>

            {/* 内容区域 */}
            {currentView === 'database' && <SimpleDatabaseTest />}
            {currentView === 'image' && <ImageTest />}
            {currentView === 'home' && (
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center space-y-4">
                  <h1 className="text-4xl font-bold text-foreground">CardAll</h1>
                  <p className="text-muted-foreground">第三阶段：Supabase集成</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 max-w-2xl">
                    <Button
                      onClick={() => setCurrentView('database')}
                      variant="outline"
                      className="h-20 flex-col"
                    >
                      <Database className="h-6 w-6 mb-2" />
                      数据库测试
                    </Button>
                    <Button
                      onClick={() => setCurrentView('image')}
                      variant="outline"
                      className="h-20 flex-col"
                    >
                      <Image className="h-6 w-6 mb-2" />
                      图片处理测试
                    </Button>
                    <Button
                      onClick={() => setShowAuthModal(true)}
                      variant="outline"
                      className="h-20 flex-col"
                    >
                      <Cloud className="h-6 w-6 mb-2" />
                      云端同步
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    选择功能模块进行测试
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* 认证模态框 */}
      {/* 认证模态框 */}
      <AuthModal 
        open={showAuthModal} 
        onOpenChange={setShowAuthModal} 
      />
      
      {/* PWA 安装提示 */}
      <InstallPrompt />
      
      <Toaster />
    </ThemeProvider>
  )
}

export default SimpleApp
