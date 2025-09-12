import React, { useState, useRef, useEffect } from 'react'
import { useResponsive } from '@/hooks/use-responsive'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  Menu, 
  X, 
  Search, 
  Plus, 
  User, 
  LogIn,
  Settings,
  Bell,
  Home,
  FolderOpen,
  Tag,
  Star,
  Archive,
  Trash
} from 'lucide-react'

interface ResponsiveNavigationProps {
  user?: any
  onSearch?: (query: string) => void
  onCreateCard?: () => void
  onSignIn?: () => void
  onSignOut?: () => void
  onNavigate?: (path: string) => void
  currentPath?: string
  className?: string
}

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  path: string
  badge?: number
  showOnMobile?: boolean
  showOnDesktop?: boolean
}

export function ResponsiveNavigation({
  user,
  onSearch,
  onCreateCard,
  onSignIn,
  onSignOut,
  onNavigate,
  currentPath = '/',
  className
}: ResponsiveNavigationProps) {
  const responsive = useResponsive()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Navigation items
  const navItems: NavItem[] = [
    {
      id: 'home',
      label: '首页',
      icon: <Home className="w-4 h-4" />,
      path: '/',
      showOnMobile: true,
      showOnDesktop: true
    },
    {
      id: 'folders',
      label: '文件夹',
      icon: <FolderOpen className="w-4 h-4" />,
      path: '/folders',
      showOnMobile: true,
      showOnDesktop: true
    },
    {
      id: 'tags',
      label: '标签',
      icon: <Tag className="w-4 h-4" />,
      path: '/tags',
      showOnMobile: true,
      showOnDesktop: true
    },
    {
      id: 'starred',
      label: '收藏',
      icon: <Star className="w-4 h-4" />,
      path: '/starred',
      showOnMobile: false,
      showOnDesktop: true
    },
    {
      id: 'archive',
      label: '归档',
      icon: <Archive className="w-4 h-4" />,
      path: '/archive',
      showOnMobile: false,
      showOnDesktop: true
    },
    {
      id: 'trash',
      label: '回收站',
      icon: <Trash className="w-4 h-4" />,
      path: '/trash',
      badge: 0, // TODO: Get actual count
      showOnMobile: false,
      showOnDesktop: true
    }
  ]

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isSearchOpen])

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (onSearch) {
      onSearch(searchQuery)
    }
  }

  // Handle navigation
  const handleNavigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path)
    }
    setIsMenuOpen(false)
  }

  // Mobile bottom navigation
  const MobileBottomNav = () => (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border md:hidden">
      <div className="flex items-center justify-around py-2">
        {navItems
          .filter(item => item.showOnMobile)
          .map(item => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.path)}
              className={cn(
                'flex flex-col items-center justify-center p-2 rounded-lg transition-colors min-w-[60px]',
                currentPath === item.path 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {item.icon}
              <span className="text-xs mt-1">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
          ))}
        
        <button
          onClick={onCreateCard}
          className="flex flex-col items-center justify-center p-2 rounded-lg transition-colors min-w-[60px] text-primary hover:bg-primary/10"
        >
          <Plus className="w-4 h-4" />
          <span className="text-xs mt-1">新建</span>
        </button>
      </div>
    </div>
  )

  // Desktop sidebar navigation
  const DesktopSidebar = () => (
    <div className="hidden md:flex md:w-64 lg:w-72 flex-col border-r border-border bg-background/95 backdrop-blur">
      {/* Logo and user section */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            CardAll
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
        
        {user ? (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.email}</p>
              <p className="text-xs text-muted-foreground">已登录</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              <LogIn className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button onClick={onSignIn} className="w-full">
            <LogIn className="w-4 h-4 mr-2" />
            登录
          </Button>
        )}
      </div>

      {/* Search section */}
      <div className="p-4 border-b border-border">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="搜索卡片..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </form>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems
          .filter(item => item.showOnDesktop)
          .map(item => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.path)}
              className={cn(
                'w-full flex items-center space-x-3 px-3 py-2 text-sm rounded-md transition-colors',
                currentPath === item.path
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {item.icon}
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
      </nav>

      {/* Create card button */}
      <div className="p-4 border-t border-border">
        <Button onClick={onCreateCard} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          新建卡片
        </Button>
      </div>
    </div>
  )

  // Mobile top navigation
  const MobileTopNav = () => (
    <div className="md:hidden flex items-center justify-between p-4 bg-background/95 backdrop-blur border-b border-border">
      <div className="flex items-center space-x-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsMenuOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">CardAll</h1>
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsSearchOpen(true)}
        >
          <Search className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCreateCard}
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>
    </div>
  )

  // Mobile search overlay
  const MobileSearchOverlay = () => (
    <div 
      className={cn(
        'fixed inset-0 z-50 bg-background/95 backdrop-blur md:hidden',
        isSearchOpen ? 'block' : 'hidden'
      )}
    >
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSearchOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="搜索卡片..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </form>
        </div>
      </div>
    </div>
  )

  // Mobile menu overlay
  const MobileMenuOverlay = () => (
    <div 
      className={cn(
        'fixed inset-0 z-50 bg-background/95 backdrop-blur md:hidden',
        isMenuOpen ? 'block' : 'hidden'
      )}
      ref={menuRef}
    >
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">菜单</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* User section */}
      <div className="p-4 border-b border-border">
        {user ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-xs text-muted-foreground">已登录</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              <LogIn className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button onClick={onSignIn} className="w-full">
            <LogIn className="w-4 h-4 mr-2" />
            登录
          </Button>
        )}
      </div>

      {/* Navigation items */}
      <nav className="p-4 space-y-1">
        {navItems
          .filter(item => item.showOnMobile)
          .map(item => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.path)}
              className={cn(
                'w-full flex items-center space-x-3 px-3 py-3 text-left rounded-md transition-colors',
                currentPath === item.path
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
      </nav>
    </div>
  )

  return (
    <div className={cn('relative', className)}>
      {/* Desktop sidebar */}
      <DesktopSidebar />
      
      {/* Mobile top navigation */}
      <MobileTopNav />
      
      {/* Mobile search overlay */}
      <MobileSearchOverlay />
      
      {/* Mobile menu overlay */}
      <MobileMenuOverlay />
      
      {/* Mobile bottom navigation */}
      <MobileBottomNav />
      
      {/* Spacer for mobile bottom nav */}
      <div className="h-16 md:hidden" />
    </div>
  )
}