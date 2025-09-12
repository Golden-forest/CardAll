import React from 'react'
import { Dashboard } from '@/components/dashboard'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { AuthModalEnhanced } from '@/components/auth/auth-modal-enhanced'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { CardAllProvider } from '@/contexts/cardall-context'
import { StylePanelProvider } from '@/contexts/style-panel-context'
import { TagPanelProvider } from '@/contexts/tag-panel-context'
import { AuthModalProvider, useAuthModal } from '@/contexts/auth-modal-context'
import './globals.css'

function AppContent() {
  const { isOpen, closeModal } = useAuthModal()

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