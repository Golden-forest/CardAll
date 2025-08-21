import React from 'react'
import ReactDOM from 'react-dom/client'
import { Dashboard } from '@/components/dashboard'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import '@/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <Dashboard />
      <Toaster />
    </ThemeProvider>
  </React.StrictMode>,
)