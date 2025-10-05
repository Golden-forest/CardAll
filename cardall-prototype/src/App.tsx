import React from 'react'
import { Dashboard } from '@/components/dashboard'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { CardAllProvider } from '@/contexts/cardall-context'
import { StylePanelProvider } from '@/contexts/style-panel-context'
import { TagPanelProvider } from '@/contexts/tag-panel-context'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import './globals.css'

// 导入数据导出工具（用于备份）
import '@/utils/data-export'

interface AppProps {
  initializationError?: string
}

function AppContent({ initializationError }: AppProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* 初始化错误提示 */}
      {initializationError && (
        <div className="border-b bg-destructive/5">
          <div className="container mx-auto px-4 py-2">
            <Alert variant="destructive" className="mb-0">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {initializationError}
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      <CardAllProvider>
        <StylePanelProvider>
          <TagPanelProvider>
            <Dashboard />
          </TagPanelProvider>
        </StylePanelProvider>
      </CardAllProvider>

      {/* PWA Install Prompt */}
      <InstallPrompt />

      <Toaster />
    </div>
  )
}

function App({ initializationError }: AppProps) {
  return (
    <ThemeProvider defaultTheme="light" storageKey="cardall-theme">
      <AppContent initializationError={initializationError} />
    </ThemeProvider>
  )
}

export default App