import React, { useState } from 'react'
import { useCardAllCards, useCardAllFolders, useCardAllTags } from '@/contexts/cardall-context'
import { OptimizedMasonryGrid } from './card/optimized-masonry-grid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
  LayoutGrid,
  FolderPlus,
  Sliders,
  Shuffle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DashboardProps {
  className?: string
}

export function Dashboard({ className }: DashboardProps) {
  const { 
    cards, 
    filter, 
    setFilter, 
    viewSettings, 
    setViewSettings, 
    dispatch: cardDispatch,
    getAllTags 
  } = useCardAllCards()
  
  const { 
    folderTree, 
    selectedFolderId, 
    setSelectedFolderId,
    dispatch: folderDispatch 
  } = useCardAllFolders()
  
  const { tags, popularTags } = useCardAllTags()
  
  const { theme, setTheme } = useTheme()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [layoutSettings, setLayoutSettings] = useState({
    gap: 16,
    enableVirtualization: true,
    showLayoutControls: false
  })

  const handleCardFlip = (cardId: string) => {
    cardDispatch({ type: 'FLIP_CARD', payload: cardId })
  }

  const handleCardUpdate = (cardId: string, updates: any) => {
    cardDispatch({ 
      type: 'UPDATE_CARD', 
      payload: { id: cardId, updates } 
    })
  }

  const handleCardCopy = (cardId: string) => {
    const card = cards.find(c => c.id === cardId)
    if (card) {
      const content = card.isFlipped ? card.backContent : card.frontContent
      const textToCopy = `${content.title}\n\n${content.text}`
      navigator.clipboard.writeText(textToCopy)
      // TODO: Show toast notification
      console.log('Card content copied to clipboard')
    }
  }

  const handleCardScreenshot = (cardId: string) => {
    // TODO: Implement screenshot functionality
    console.log('Screenshot card:', cardId)
  }

  const handleCardShare = (cardId: string) => {
    // TODO: Implement share functionality
    console.log('Share card:', cardId)
  }

  const handleCreateCard = () => {
    const newCard = {
      frontContent: {
        title: 'New Card',
        text: 'Click to edit this card...',
        images: [],
        tags: [],
        lastModified: new Date()
      },
      backContent: {
        title: 'Back Side',
        text: 'Add additional content here...',
        images: [],
        tags: [],
        lastModified: new Date()
      },
      style: {
        type: 'solid' as const,
        backgroundColor: '#ffffff',
        fontFamily: 'system-ui',
        fontSize: 'base' as const,
        fontWeight: 'normal' as const,
        textColor: '#1f2937',
        borderRadius: 'xl' as const,
        shadow: 'md' as const,
        borderWidth: 0
      },
      isFlipped: false,
      folderId: selectedFolderId || undefined
    }
    
    cardDispatch({ type: 'CREATE_CARD', payload: newCard })
  }

  const handleCreateFolder = () => {
    folderDispatch({
      type: 'CREATE_FOLDER',
      payload: {
        name: 'New Folder',
        color: '#3b82f6',
        icon: 'Folder',
        cardIds: [],
        isExpanded: true
      }
    })
  }


  const handleTagFilter = (tagName: string) => {
    const isSelected = filter.tags.includes(tagName)
    setFilter({
      ...filter,
      tags: isSelected 
        ? filter.tags.filter(t => t !== tagName)
        : [...filter.tags, tagName]
    })
  }

  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId)
    setFilter({
      ...filter,
      folderId: folderId || undefined
    })
  }

  const shuffleCards = () => {
    // Trigger a re-render by updating a timestamp
    const shuffledCards = [...cards].sort(() => Math.random() - 0.5)
    // Since we can't directly modify the cards array, we'll use a different approach
    // This will cause the masonry layout to recalculate positions
    setLayoutSettings(prev => ({ ...prev, gap: prev.gap }))
  }

  const toggleLayoutControls = () => {
    setLayoutSettings(prev => ({ 
      ...prev, 
      showLayoutControls: !prev.showLayoutControls 
    }))
  }

  const renderFolderTree = (folders: any[], level = 0) => {
    return folders.map(folder => (
      <div key={folder.id} style={{ marginLeft: level * 16 }}>
        <Button
          variant={selectedFolderId === folder.id ? "secondary" : "ghost"}
          className="w-full justify-start text-sm mb-1"
          onClick={() => handleFolderSelect(folder.id)}
        >
          <Folder className="h-4 w-4 mr-2" style={{ color: folder.color }} />
          {folder.name}
          <Badge variant="secondary" className="ml-auto">
            {folder.cardIds.length}
          </Badge>
        </Button>
        {folder.children && folder.children.length > 0 && folder.isExpanded && (
          <div className="ml-4">
            {renderFolderTree(folder.children, level + 1)}
          </div>
        )}
      </div>
    ))
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
                onChange={(e) => setFilter({ ...filter, searchTerm: e.target.value })}
                className="pl-10 rounded-full"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Layout Controls Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Sliders className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Layout Settings</h4>
                    <p className="text-sm text-muted-foreground">
                      Customize the masonry layout appearance
                    </p>
                  </div>
                  
                  {/* Gap Size */}
                  <div className="space-y-2">
                    <Label>Gap Size: {layoutSettings.gap}px</Label>
                    <Slider
                      value={[layoutSettings.gap]}
                      onValueChange={([value]) => setLayoutSettings(prev => ({ ...prev, gap: value }))}
                      max={32}
                      min={8}
                      step={4}
                      className="w-full"
                    />
                  </div>

                  {/* Card Size */}
                  <div className="space-y-2">
                    <Label>Card Size</Label>
                    <div className="flex gap-2">
                      {(['small', 'medium', 'large'] as const).map(size => (
                        <Button
                          key={size}
                          variant={viewSettings.cardSize === size ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setViewSettings(prev => ({ ...prev, cardSize: size }))}
                        >
                          {size.charAt(0).toUpperCase() + size.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Virtualization */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="virtualization"
                      checked={layoutSettings.enableVirtualization}
                      onCheckedChange={(checked) => setLayoutSettings(prev => ({ ...prev, enableVirtualization: checked }))}
                    />
                    <Label htmlFor="virtualization">Enable Virtualization</Label>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <Button onClick={shuffleCards} variant="outline" className="w-full">
                      <Shuffle className="h-4 w-4 mr-2" />
                      Shuffle Cards
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
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
        <div className="flex">
          {/* Sidebar */}
          <aside className="w-64 p-4 border-r min-h-screen">
            <ScrollArea className="h-full">
              <div className="space-y-6">
                {/* Quick Actions */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Quick Actions</h3>
                  <div className="space-y-2">
                    <Button 
                      className="w-full justify-start" 
                      onClick={handleCreateCard}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Card
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={handleCreateFolder}
                    >
                      <FolderPlus className="h-4 w-4 mr-2" />
                      New Folder
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Folders */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Folders</h3>
                  <div className="space-y-1">
                    <Button 
                      variant={!selectedFolderId ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      onClick={() => handleFolderSelect(null)}
                    >
                      <Folder className="h-4 w-4 mr-2" />
                      All Cards
                      <Badge variant="secondary" className="ml-auto">
                        {cards.length}
                      </Badge>
                    </Button>
                    {renderFolderTree(folderTree)}
                  </div>
                </div>

                <Separator />

                {/* Tags */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium">Tags</h3>
                    {filter.tags.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilter({ ...filter, tags: [] })}
                        className="h-6 px-2 text-xs"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {popularTags(10).map(tag => (
                      <Button 
                        key={tag.id}
                        variant={filter.tags.includes(tag.name) ? "secondary" : "ghost"}
                        className="w-full justify-start text-sm"
                        onClick={() => handleTagFilter(tag.name)}
                      >
                        <Tag className="h-3 w-3 mr-2" style={{ color: tag.color }} />
                        {tag.name}
                        <Badge variant="secondary" className="ml-auto">
                          {tag.count}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Active Filters */}
                {(filter.tags.length > 0 || filter.searchTerm) && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-medium mb-3">Active Filters</h3>
                      <div className="space-y-2">
                        {filter.searchTerm && (
                          <div className="flex items-center gap-2">
                            <Search className="h-3 w-3" />
                            <span className="text-xs text-muted-foreground">
                              "{filter.searchTerm}"
                            </span>
                          </div>
                        )}
                        {filter.tags.map(tagName => (
                          <Badge 
                            key={tagName}
                            variant="secondary"
                            className="mr-1"
                          >
                            {tagName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </aside>

          {/* Masonry Card Grid */}
          <div className="flex-1 min-h-0">
            <OptimizedMasonryGrid
              cards={cards}
              onCardFlip={handleCardFlip}
              onCardUpdate={handleCardUpdate}
              onCardCopy={handleCardCopy}
              onCardScreenshot={handleCardScreenshot}
              onCardShare={handleCardShare}
              cardSize={viewSettings.cardSize === 'small' ? 'sm' : viewSettings.cardSize === 'large' ? 'lg' : 'md'}
              enableVirtualization={layoutSettings.enableVirtualization && cards.length > 20}
              gap={layoutSettings.gap}
              overscan={3}
            />
          </div>
        </div>
      </main>

      {/* Floating Action Button */}
      <Button
        className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-lg"
        onClick={handleCreateCard}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  )
}