import { ThemeProvider } from '@/components/theme-provider'
import { CardAllProvider } from '@/contexts/cardall-context'
import { StylePanelProvider } from '@/contexts/style-panel-context'
import { Dashboard } from '@/components/dashboard'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="cardall-theme">
      <CardAllProvider>
        <StylePanelProvider>
          <div className="min-h-screen bg-background">
            <Dashboard />
            <Toaster />
          </div>
        </StylePanelProvider>
      </CardAllProvider>
    </ThemeProvider>
  )
}

export default App