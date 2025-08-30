import { CardAllProvider } from '@/contexts/cardall-context'
import { StylePanelProvider } from '@/contexts/style-panel-context'
import { TagPanelProvider } from '@/contexts/tag-panel-context'
import { Dashboard } from '@/components/dashboard'
import { TagPanel } from '@/components/tag/tag-panel'
import { useTagPanel } from '@/contexts/tag-panel-context'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

// Inner component to use TagPanel context
function AppContent() {
  const { isOpen, currentCardTags, onTagsChange, closeTagPanel } = useTagPanel()

  return (
    <div className="min-h-screen bg-background">
      <Dashboard />
      <TagPanel
        isOpen={isOpen}
        onClose={closeTagPanel}
        currentCardTags={currentCardTags}
        onTagsChange={onTagsChange || (() => {})}
      />
      <Toaster />
    </div>
  )
}

function App() {
  return (
    <CardAllProvider>
      <StylePanelProvider>
        <TagPanelProvider>
          <AppContent />
        </TagPanelProvider>
      </StylePanelProvider>
    </CardAllProvider>
  )
}

export default App