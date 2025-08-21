import React, { useState, useEffect } from 'react'
import { Card, CardFilter } from '@/types/card'
import { CardGrid } from './card/card-grid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ThemeProvider } from '@/components/theme-provider'
import { 
  Plus, 
  Search, 
  Filter, 
  Moon, 
  Sun, 
  Settings,
  Folder,
  Tag,
  Grid3X3,
  LayoutGrid
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'

interface DashboardProps {
  className?: string
}

export function Dashboard({ className }: DashboardProps) {
  const [cards, setCards] = useState<Card[]>([])
  const [filteredCards, setFilteredCards] = useState<Card[]>([])
  const [filter, setFilter] = useState<CardFilter>({
    searchTerm: '',
    tags: []
  })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('masonry')
  const { theme, setTheme } = useTheme()

  // Initialize with sample cards
  useEffect(() => {
    const sampleCards: Card[] = [
      {
        id: '1',
        frontContent: {
          title: 'Welcome to CardAll',
          text: 'This is your first knowledge card. Click to flip and see the back!',
          images: [],
          tags: []
        },
        backContent: {
          title: 'Card Back',
          text: 'This is the back of the card. You can add tags and additional content here.',
          images: [],
          tags: ['welcome', 'tutorial']
        },
        theme: { type: 'gradient', style: 'ocean' },
        isFlipped: false,
        position: { x: 0, y: 0 },
        size: { width: 300, height: 400 },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        frontContent: {
          title: 'Design System',
          text: 'CardAll uses Apple-inspired design with large rounded corners and smooth animations.',
          images: [],
          tags: []
        },
        backContent: {
          title: 'Technical Details',
          text: 'Built with React, TypeScript, and Shadcn UI components.',
          images: [],
          tags: ['design', 'react', 'typescript']
        },
        theme: { type: 'solid', style: 'primary' },
        isFlipped: false,
        position: { x: 0, y: 0 },
        size: { width: 300, height: 400 },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '3',
        frontContent: {
          title: 'Features',
          text: 'Drag & drop, magnetic snap, real-time editing, and much more!',
          images: [],
          tags: []
        },
        backContent: {
          title: 'Coming Soon',
          text: 'More features are being developed including folders, advanced search, and sharing.',
          images: [],
          tags: ['features', 'roadmap']
        },
        theme: { type: 'gradient', style: 'purple' },
        isFlipped: false,
        position: { x: 0, y: 0 },
        size: { width: 300, height: 400 },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
    setCards(sampleCards)
    setFilteredCards(sampleCards)
  }, [])

  // Filter cards based on search and tags
  useEffect(() => {
    let filtered = cards

    if (filter.searchTerm) {
      filtered = filtered.filter(card => 
        card.frontContent.title.toLowerCase().includes(filter.searchTerm.toLowerCase()) ||
        card.frontContent.text.toLowerCase().includes(filter.searchTerm.toLowerCase()) ||
        card.backContent.title.toLowerCase().includes(filter.searchTerm.toLowerCase()) ||
        card.backContent.text.toLowerCase().includes(filter.searchTerm.toLowerCase())
      )
    }

    if (filter.tags.length > 0) {
      filtered = filtered.filter(card =>
        filter.tags.some(tag => 
          card.frontContent.tags.includes(tag) || 
          card.backContent.tags.includes(tag)
        )
      )
    }

    setFilteredCards(filtered)
  }, [cards, filter])

  const handleCardUpdate = (cardId: string, updates: Partial<Card>) => {
    setCards(prev => prev.map(card => 
      card.id === cardId ? { ...card, ...updates, updatedAt: new Date() } : card
    ))
  }

  const handleCardCopy = (cardId: string) => {
    const card = cards.find(c => c.id === cardId)
    if (card) {
      const content = card.isFlipped ? card.backContent : card.frontContent
      const textToCopy = `${content.title}\n\n${content.text}`
      navigator.clipboard.writeText(textToCopy)
      // Show toast notification
      console.log('Card content copied to clipboard')
    }
  }

  const handleCardScreenshot = (cardId: string) => {
    // Implement screenshot functionality
    console.log('Screenshot card:', cardId)
  }

  const handleCardShare = (cardId: string) => {
    // Implement share functionality
    console.log('Share card:', cardId)
  }

  const handleCreateCard = (cardData: any) => {
    const newCard: Card = {
      ...cardData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    }
    setCards(prev => [newCard, ...prev])
  }

  return (
    <div className={cn("min-h-screen bg-background", className)}>
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">CA</span>
            </div>
            <h1 className="text-xl font-bold">CardAll</h1>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search cards..."
                value={filter.searchTerm}
                onChange={(e) => setFilter(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="pl-10 rounded-full"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode(viewMode === 'grid' ? 'masonry' : 'grid')}
            >
              {viewMode === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto">
        {/* Sidebar */}
        <div className="flex">
          <aside className="w-64 p-4 border-r min-h-screen">
            <div className="space-y-6">
              {/* Quick Actions */}
              <div>
                <h3 className="text-sm font-medium mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <Button 
                    className="w-full justify-start" 
                    onClick={() => setShowCreateModal(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Card
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Folder className="h-4 w-4 mr-2" />
                    New Folder
                  </Button>
                </div>
              </div>

              {/* Folders */}
              <div>
                <h3 className="text-sm font-medium mb-3">Folders</h3>
                <div className="space-y-1">
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    <Folder className="h-4 w-4 mr-2" />
                    All Cards ({cards.length})
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    <Folder className="h-4 w-4 mr-2" />
                    Favorites
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    <Folder className="h-4 w-4 mr-2" />
                    Recent
                  </Button>
                </div>
              </div>

              {/* Tags */}
              <div>
                <h3 className="text-sm font-medium mb-3">Tags</h3>
                <div className="space-y-1">
                  {Array.from(new Set(cards.flatMap(card => [...card.frontContent.tags, ...card.backContent.tags]))).map(tag => (
                    <Button 
                      key={tag}
                      variant="ghost" 
                      className="w-full justify-start text-sm"
                      onClick={() => {
                        const isSelected = filter.tags.includes(tag)
                        setFilter(prev => ({
                          ...prev,
                          tags: isSelected 
                            ? prev.tags.filter(t => t !== tag)
                            : [...prev.tags, tag]
                        }))
                      }}
                    >
                      <Tag className="h-3 w-3 mr-2" />
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Card Grid */}
          <div className="flex-1">
            <CardGrid
              cards={filteredCards}
              onCardUpdate={handleCardUpdate}
              onCardCopy={handleCardCopy}
              onCardScreenshot={handleCardScreenshot}
              onCardShare={handleCardShare}
              className={viewMode === 'grid' ? 'grid-cols-3' : ''}
            />
          </div>
        </div>
      </main>

      {/* Floating Action Button */}
      <Button
        className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-lg"
        onClick={() => setShowCreateModal(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  )
}