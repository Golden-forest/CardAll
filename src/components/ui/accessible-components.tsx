import React, { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { X, ChevronDown, ChevronUp, Info } from 'lucide-react'

// 可访问的警告框组件
interface AccessibleAlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error'
  title: string
  description?: string
  actions?: React.ReactNode
  onClose?: () => void
  className?: string
  autoClose?: boolean
  autoCloseDelay?: number
}

export function AccessibleAlert({
  variant = 'info',
  title,
  description,
  actions,
  onClose,
  className,
  autoClose = false,
  autoCloseDelay = 5000
}: AccessibleAlertProps) {
  const [isVisible, setIsVisible] = useState(true)
  const alertRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        handleClose()
      }, autoCloseDelay)
      
      return () => clearTimeout(timer)
    }
  }, [autoClose, autoCloseDelay])

  const handleClose = useCallback(() => {
    setIsVisible(false)
    onClose?.()
  }, [onClose])

  if (!isVisible) return null

  const variantStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100',
    success: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950 dark:border-green-800 dark:text-green-100',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-100',
    error: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-100'
  }

  const variantIcons = {
    info: <Info className="w-4 h-4" />,
    success: <Info className="w-4 h-4" />,
    warning: <Info className="w-4 h-4" />,
    error: <Info className="w-4 h-4" />
  }

  return (
    <div
      ref={alertRef}
      className={cn(
        'relative p-4 rounded-lg border transition-all duration-200',
        variantStyles[variant],
        className
      )}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-3">
          {variantIcons[variant]}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium mb-1">{title}</h3>
          {description && (
            <p className="text-sm opacity-90 mb-2">{description}</p>
          )}
          {actions && (
            <div className="flex gap-2 mt-2">
              {actions}
            </div>
          )}
        </div>
        
        {onClose && (
          <Button
            size="sm"
            variant="ghost"
            className="flex-shrink-0 ml-2 h-6 w-6 p-0 opacity-60 hover:opacity-100"
            onClick={handleClose}
            aria-label="Close alert"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

// 可访问的手风琴组件
interface AccordionItemProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  disabled?: boolean
  className?: string
}

interface AccessibleAccordionProps {
  items: AccordionItemProps[]
  allowMultiple?: boolean
  className?: string
}

export function AccessibleAccordion({ items, allowMultiple = false, className }: AccessibleAccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    // 默认打开的项目
    const defaultOpen = new Set<string>()
    items.forEach((item, index) => {
      if (item.defaultOpen) {
        defaultOpen.add(index.toString())
      }
    })
    setOpenItems(defaultOpen)
  }, [items])

  const toggleItem = useCallback((index: string) => {
    setOpenItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        if (!allowMultiple) {
          newSet.clear()
        }
        newSet.add(index)
      }
      return newSet
    })
  }, [allowMultiple])

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item, index) => {
        const itemIndex = index.toString()
        const isOpen = openItems.has(itemIndex)
        const itemId = `accordion-item-${itemIndex}`
        const headerId = `${itemId}-header`
        const contentId = `${itemId}-content`

        return (
          <div key={itemIndex} className="border border-border rounded-lg">
            <h3>
              <button
                type="button"
                className={cn(
                  'flex items-center justify-between w-full p-4 text-left font-medium transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  item.disabled && 'opacity-50 cursor-not-allowed'
                )}
                onClick={() => !item.disabled && toggleItem(itemIndex)}
                aria-expanded={isOpen}
                aria-controls={contentId}
                id={headerId}
                disabled={item.disabled}
              >
                <span>{item.title}</span>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </h3>
            
            <div
              id={contentId}
              role="region"
              aria-labelledby={headerId}
              className={cn(
                'overflow-hidden transition-all duration-200',
                isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              )}
            >
              <div className="p-4 pt-0">
                {item.children}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 可访问的进度条组件
interface AccessibleProgressProps {
  value: number
  max?: number
  label?: string
  showValue?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'success' | 'warning' | 'error'
}

export function AccessibleProgress({
  value,
  max = 100,
  label,
  showValue = true,
  className,
  size = 'md',
  variant = 'default'
}: AccessibleProgressProps) {
  const percentage = Math.min((value / max) * 100, 100)

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-4',
    lg: 'h-6'
  }

  const variantClasses = {
    default: 'bg-primary',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500'
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex justify-between text-sm">
          <span>{label}</span>
          {showValue && (
            <span>{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      
      <div
        className={cn(
          'w-full bg-muted rounded-full overflow-hidden',
          sizeClasses[size]
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label || 'Progress'}
      >
        <div
          className={cn(
            'h-full transition-all duration-300 ease-out rounded-full',
            variantClasses[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

// 可访问的标签页组件
interface TabProps {
  id: string
  label: string
  children: React.ReactNode
  disabled?: boolean
}

interface AccessibleTabsProps {
  tabs: TabProps[]
  defaultTab?: string
  className?: string
  onTabChange?: (tabId: string) => void
}

export function AccessibleTabs({ tabs, defaultTab, className, onTabChange }: AccessibleTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId)
    onTabChange?.(tabId)
  }, [onTabChange])

  return (
    <div className={cn('space-y-4', className)}>
      {/* Tab List */}
      <div
        className="flex space-x-1 border-b border-border"
        role="tablist"
        aria-label="Tabs"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const tabId = `tab-${tab.id}`
          const panelId = `tabpanel-${tab.id}`

          return (
            <button
              key={tab.id}
              id={tabId}
              type="button"
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                'border-b-2 border-transparent',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                isActive
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:border-muted',
                tab.disabled && 'opacity-50 cursor-not-allowed'
              )}
              onClick={() => !tab.disabled && handleTabChange(tab.id)}
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              disabled={tab.disabled}
              tabIndex={isActive ? 0 : -1}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Panels */}
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        const panelId = `tabpanel-${tab.id}`
        const tabId = `tab-${tab.id}`

        return (
          <div
            key={tab.id}
            id={panelId}
            role="tabpanel"
            aria-labelledby={tabId}
            tabIndex={0}
            className={cn(
              'transition-opacity duration-200',
              isActive ? 'opacity-100' : 'opacity-0 hidden'
            )}
          >
            {tab.children}
          </div>
        )
      })}
    </div>
  )
}

// 可访问的工具提示组件
interface AccessibleTooltipProps {
  content: string
  children: React.ReactNode
  className?: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

export function AccessibleTooltip({ content, children, className, placement = 'top' }: AccessibleTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  const showTooltip = useCallback(() => setIsVisible(true), [])
  const hideTooltip = useCallback(() => setIsVisible(false), [])

  const placementClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  }

  const arrowClasses = {
    top: 'top-full left-1/2 transform -translate-x-1/2 border-t-4 border-l-4 border-r-4 border-transparent border-t-current',
    bottom: 'bottom-full left-1/2 transform -translate-x-1/2 border-b-4 border-l-4 border-r-4 border-transparent border-b-current',
    left: 'left-full top-1/2 transform -translate-y-1/2 border-l-4 border-t-4 border-b-4 border-transparent border-l-current',
    right: 'right-full top-1/2 transform -translate-y-1/2 border-r-4 border-t-4 border-b-4 border-transparent border-r-current'
  }

  return (
    <div className="relative inline-block">
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-block"
      >
        {children}
      </div>
      
      {isVisible && (
        <div
          ref={tooltipRef}
          className={cn(
            'absolute z-50 px-3 py-2 text-sm bg-popover border border-border rounded-md shadow-md',
            'animate-in fade-in-50 zoom-in-90',
            placementClasses[placement],
            className
          )}
          role="tooltip"
        >
          {content}
          <div className={cn('absolute w-0 h-0 border-4 border-transparent', arrowClasses[placement])} />
        </div>
      )}
    </div>
  )
}

// 可访问的模态框组件
interface AccessibleModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function AccessibleModal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className, 
  size = 'md' 
}: AccessibleModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      // 保存之前聚焦的元素
      previouslyFocusedElement.current = document.activeElement as HTMLElement
      
      // 聚焦到模态框
      modalRef.current?.focus()
      
      // 阻止背景滚动
      document.body.style.overflow = 'hidden'
      
      // 捕获焦点
      const handleFocus = (e: FocusEvent) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          e.preventDefault()
          modalRef.current.focus()
        }
      }
      
      document.addEventListener('focus', handleFocus, true)
      
      return () => {
        document.removeEventListener('focus', handleFocus, true)
        document.body.style.overflow = ''
        
        // 恢复焦点到之前元素
        previouslyFocusedElement.current?.focus()
      }
    }
  }, [isOpen])

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div
          ref={modalRef}
          className={cn(
            'relative bg-background border border-border rounded-lg shadow-xl',
            'animate-in fade-in-90 zoom-in-90',
            sizeClasses[size],
            'w-full max-h-[90vh] overflow-y-auto',
            className
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 
              id="modal-title" 
              className="text-lg font-semibold"
            >
              {title}
            </h2>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {/* 内容 */}
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}