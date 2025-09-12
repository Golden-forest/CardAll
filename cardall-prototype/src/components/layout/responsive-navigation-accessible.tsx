import React, { useState, useRef, useEffect, useCallback } from 'react'
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
  Trash,
  ChevronDown,
  ChevronRight
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
  ariaLabel?: string
  shortcut?: string
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
  const [activeNavItem, setActiveNavItem] = useState<string>(currentPath)
  const announcementsRef = useRef<HTMLDivElement>(null)

  // 导航项目
  const navItems: NavItem[] = [
    {
      id: 'home',
      label: '首页',
      icon: <Home className="w-4 h-4" />,
      path: '/',
      showOnMobile: true,
      showOnDesktop: true,
      ariaLabel: 'Go to home page',
      shortcut: '1'
    },
    {
      id: 'folders',
      label: '文件夹',
      icon: <FolderOpen className="w-4 h-4" />,
      path: '/folders',
      showOnMobile: true,
      showOnDesktop: true,
      ariaLabel: 'Go to folders',
      shortcut: '2'
    },
    {
      id: 'tags',
      label: '标签',
      icon: <Tag className="w-4 h-4" />,
      path: '/tags',
      showOnMobile: true,
      showOnDesktop: true,
      ariaLabel: 'Go to tags',
      shortcut: '3'
    },
    {
      id: 'starred',
      label: '收藏',
      icon: <Star className="w-4 h-4" />,
      path: '/starred',
      showOnMobile: false,
      showOnDesktop: true,
      ariaLabel: 'Go to starred items',
      shortcut: '4'
    },
    {
      id: 'archive',
      label: '归档',
      icon: <Archive className="w-4 h-4" />,
      path: '/archive',
      showOnMobile: false,
      showOnDesktop: true,
      ariaLabel: 'Go to archive',
      shortcut: '5'
    },
    {
      id: 'trash',
      label: '回收站',
      icon: <Trash className="w-4 h-4" />,
      path: '/trash',
      badge: 0,
      showOnMobile: false,
      showOnDesktop: true,
      ariaLabel: 'Go to trash',
      shortcut: '6'
    }
  ]

  // 关闭菜单当点击外部
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 聚焦搜索输入当打开时
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isSearchOpen])

  // 屏幕阅读器公告
  const announce = useCallback((message: string) => {
    if (!announcementsRef.current) return
    
    const announcement = document.createElement('div')
    announcement.setAttribute('role', 'status')
    announcement.setAttribute('aria-live', 'polite')
    announcement.setAttribute('aria-atomic', 'true')
    announcement.className = 'sr-only'
    announcement.textContent = message
    
    announcementsRef.current.appendChild(announcement)
    
    setTimeout(() => {
      if (announcementsRef.current?.contains(announcement)) {
        announcementsRef.current.removeChild(announcement)
      }
    }, 1000)
  }, [])

  // 处理搜索
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (onSearch) {
      onSearch(searchQuery)
      announce(`Searching for: ${searchQuery}`)
    }
  }, [onSearch, searchQuery, announce])

  // 处理导航
  const handleNavigate = useCallback((path: string, label: string) => {
    if (onNavigate) {
      onNavigate(path)
      setActiveNavItem(path)
      setIsMenuOpen(false)
      announce(`Navigated to ${label}`)
    }
  }, [onNavigate, announce])

  // 键盘快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在搜索或编辑，忽略快捷键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Ctrl/Cmd + K 打开搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
        announce('Search opened')
      }

      // 数字键导航
      if (e.key >= '1' && e.key <= '6') {
        const index = parseInt(e.key) - 1
        const navItem = navItems[index]
        if (navItem) {
          e.preventDefault()
          handleNavigate(navItem.path, navItem.label)
        }
      }

      // N 键创建新卡片
      if (e.key === 'n' && !e.repeat) {
        e.preventDefault()
        if (onCreateCard) {
          onCreateCard()
          announce('New card created')
        }
      }

      // M 键切换菜单
      if (e.key === 'm' && !e.repeat) {
        e.preventDefault()
        setIsMenuOpen(prev => {
          const newState = !prev
          announce(newState ? 'Menu opened' : 'Menu closed')
          return newState
        })
      }

      // / 键聚焦搜索
      if (e.key === '/' && !e.repeat) {
        e.preventDefault()
        setIsSearchOpen(true)
        announce('Search opened')
      }

      // Escape 键关闭所有弹窗
      if (e.key === 'Escape') {
        if (isSearchOpen) {
          setIsSearchOpen(false)
          announce('Search closed')
        }
        if (isMenuOpen) {
          setIsMenuOpen(false)
          announce('Menu closed')
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCreateCard, handleNavigate, announce, isSearchOpen, isMenuOpen, navItems])

  // 移动端底部导航
  const MobileBottomNav = () => (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border md:hidden"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around py-2">
        {navItems
          .filter(item => item.showOnMobile)
          .map(item => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.path, item.label)}
              className={cn(
                'flex flex-col items-center justify-center p-2 rounded-lg transition-colors min-w-[60px] relative',
                activeNavItem === item.path 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
              aria-label={item.ariaLabel || item.label}
              aria-current={activeNavItem === item.path ? 'page' : undefined}
            >
              {item.icon}
              <span className="text-xs mt-1">{item.label}</span>
              {item.shortcut && (
                <span className="absolute top-1 right-1 text-xs text-muted-foreground">
                  {item.shortcut}
                </span>
              )}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" aria-hidden="true"></span>
              )}
            </button>
          ))}
        
        <button
          onClick={onCreateCard}
          className="flex flex-col items-center justify-center p-2 rounded-lg transition-colors min-w-[60px] text-primary hover:bg-primary/10"
          aria-label="Create new card (N key)"
        >
          <Plus className="w-4 h-4" />
          <span className="text-xs mt-1">新建</span>
        </button>
      </div>
    </nav>
  )

  // 桌面端侧边栏导航
  const DesktopSidebar = () => (
    <aside 
      className="hidden md:flex md:w-64 lg:w-72 flex-col border-r border-border bg-background/95 backdrop-blur"
      role="navigation"
      aria-label="Desktop sidebar navigation"
    >
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
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
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
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onSignOut}
              aria-label="Sign out"
            >
              <LogIn className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button 
            onClick={onSignIn} 
            className="w-full"
            aria-label="Sign in"
          >
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
            type="search"
            placeholder="搜索卡片... (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            aria-label="Search cards"
          />
        </form>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 p-4 space-y-1" role="navigation" aria-label="Main navigation">
        {navItems
          .filter(item => item.showOnDesktop)
          .map(item => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.path, item.label)}
              className={cn(
                'w-full flex items-center space-x-3 px-3 py-2 text-sm rounded-md transition-colors relative',
                activeNavItem === item.path
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
              aria-label={item.ariaLabel || item.label}
              aria-current={activeNavItem === item.path ? 'page' : undefined}
            >
              {item.icon}
              <span className="flex-1 text-left">{item.label}</span>
              {item.shortcut && (
                <span className="text-xs text-muted-foreground">
                  {item.shortcut}
                </span>
              )}
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
        <Button 
          onClick={onCreateCard} 
          className="w-full"
          aria-label="Create new card (N key)"
        >
          <Plus className="w-4 h-4 mr-2" />
          新建卡片
        </Button>
      </div>
    </aside>
  )

  // 移动端顶部导航
  const MobileTopNav = () => (
    <header className="md:hidden flex items-center justify-between p-4 bg-background/95 backdrop-blur border-b border-border">
      <div className="flex items-center space-x-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={isMenuOpen}
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
          aria-label="Open search"
          aria-expanded={isSearchOpen}
        >
          <Search className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCreateCard}
          aria-label="Create new card"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>
    </header>
  )

  // 移动端搜索覆盖层
  const MobileSearchOverlay = () => (
    <div 
      className={cn(
        'fixed inset-0 z-50 bg-background/95 backdrop-blur md:hidden',
        isSearchOpen ? 'block' : 'hidden'
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSearchOpen(false)}
            aria-label="Close search"
          >
            <X className="w-5 h-5" />
          </Button>
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="搜索卡片..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              aria-label="Search cards"
            />
          </form>
        </div>
      </div>
      
      {/* 搜索快捷键提示 */}
      <div className="p-4 text-sm text-muted-foreground">
        <p>快捷键:</p>
        <ul className="mt-2 space-y-1">
          <li>• 1-6: 导航到对应页面</li>
          <li>• N: 创建新卡片</li>
          <li>• M: 切换菜单</li>
          <li>• /: 搜索</li>
          <li>• Esc: 关闭弹窗</li>
        </ul>
      </div>
    </div>
  )

  // 移动端菜单覆盖层
  const MobileMenuOverlay = () => (
    <div 
      className={cn(
        'fixed inset-0 z-50 bg-background/95 backdrop-blur md:hidden',
        isMenuOpen ? 'block' : 'hidden'
      )}
      ref={menuRef}
      role="dialog"
      aria-modal="true"
      aria-label="Main menu"
    >
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">菜单</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMenuOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* 用户部分 */}
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
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onSignOut}
              aria-label="Sign out"
            >
              <LogIn className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button 
            onClick={onSignIn} 
            className="w-full"
            aria-label="Sign in"
          >
            <LogIn className="w-4 h-4 mr-2" />
            登录
          </Button>
        )}
      </div>

      {/* 导航项目 */}
      <nav className="p-4 space-y-1" role="navigation" aria-label="Main navigation">
        {navItems
          .filter(item => item.showOnMobile)
          .map(item => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.path, item.label)}
              className={cn(
                'w-full flex items-center space-x-3 px-3 py-3 text-left rounded-md transition-colors',
                activeNavItem === item.path
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
              aria-label={item.ariaLabel || item.label}
              aria-current={activeNavItem === item.path ? 'page' : undefined}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.shortcut && (
                <span className="text-xs text-muted-foreground">
                  {item.shortcut}
                </span>
              )}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
      </nav>
      
      {/* 快捷键提示 */}
      <div className="p-4 mt-4 border-t border-border">
        <h3 className="text-sm font-medium mb-2">键盘快捷键</h3>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• 数字键 1-6: 快速导航</li>
          <li>• N: 创建新卡片</li>
          <li>• Ctrl+K 或 /: 搜索</li>
          <li>• M: 打开/关闭菜单</li>
          <li>• Esc: 关闭弹窗</li>
        </ul>
      </div>
    </div>
  )

  return (
    <div className={cn('relative', className)}>
      {/* 屏幕阅读器公告区域 */}
      <div ref={announcementsRef} className="sr-only" aria-live="polite" />
      
      {/* 桌面端侧边栏 */}
      <DesktopSidebar />
      
      {/* 移动端顶部导航 */}
      <MobileTopNav />
      
      {/* 移动端搜索覆盖层 */}
      <MobileSearchOverlay />
      
      {/* 移动端菜单覆盖层 */}
      <MobileMenuOverlay />
      
      {/* 移动端底部导航 */}
      <MobileBottomNav />
      
      {/* 移动端底部导航间距 */}
      <div className="h-16 md:hidden" />
    </div>
  )
}