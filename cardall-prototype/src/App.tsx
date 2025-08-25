import { ThemeProvider } from '@/components/theme-provider'
import { CardAllProvider } from '@/contexts/cardall-context'
import { Dashboard } from '@/components/dashboard'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="cardall-theme">
      <CardAllProvider>
        <div className="min-h-screen bg-background">
          <Dashboard />
          <Toaster />
        </div>
      </CardAllProvider>
    </ThemeProvider>
  )
}

export default App