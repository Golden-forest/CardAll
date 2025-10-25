import React, { ReactNode } from 'react'
import { useResponsive } from '@/hooks/use-responsive'
import { cn } from '@/lib/utils'

interface ResponsiveLayoutProps {
  children: ReactNode
  className?: string
}

interface ResponsiveContainerProps {
  children: ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
}

interface ResponsiveGridProps {
  children: ReactNode
  className?: string
  cols?: {
    xs?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
    '2xl'?: number
  }
  gap?: {
    xs?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
    '2xl'?: number
  }
}

interface ResponsiveFlexProps {
  children: ReactNode
  className?: string
  direction?: 'row' | 'col'
  wrap?: boolean
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'
  align?: 'start' | 'end' | 'center' | 'baseline' | 'stretch'
  gap?: number | string
}

// Main layout wrapper with responsive behavior
export function ResponsiveLayout({ children, className }: ResponsiveLayoutProps) {
  const responsive = useResponsive()
  
  return (
    <div 
      className={cn(
        'min-h-screen bg-background transition-all duration-300',
        responsive.isMobile && 'mobile-layout',
        responsive.isTablet && 'tablet-layout',
        responsive.isDesktop && 'desktop-layout',
        responsive.orientation === 'portrait' && 'orientation-portrait',
        responsive.orientation === 'landscape' && 'orientation-landscape',
        className
      )}
    >
      {children}
    </div>
  )
}

// Responsive container with max-width control
export function ResponsiveContainer({ 
  children, 
  className, 
  maxWidth = 'xl' 
}: ResponsiveContainerProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-7xl',
    '2xl': 'max-w-screen-2xl',
    full: 'max-w-full'
  }
  
  return (
    <div 
      className={cn(
        'w-full mx-auto px-4 sm:px-6 lg:px-8',
        maxWidthClasses[maxWidth],
        className
      )}
    >
      {children}
    </div>
  )
}

// Responsive grid system
export function ResponsiveGrid({ 
  children, 
  className, 
  cols = { xs: 1, sm: 2, md: 3, lg: 4, xl: 5, '2xl': 6 },
  gap = { xs: 4, sm: 6, md: 8, lg: 10, xl: 12, '2xl': 14 }
}: ResponsiveGridProps) {
  const responsive = useResponsive()
  
  const gridClasses = Object.entries(cols)
    .map(([breakpoint, colCount]) => {
      if (colCount === undefined) return ''
      return `${breakpoint === 'xs' ? '' : `${breakpoint}:`}grid-cols-${colCount}`
    })
    .filter(Boolean)
    .join(' ')
  
  const gapClasses = `gap-${gap[responsive.currentBreakpoint] || gap.md || 8}`
  
  return (
    <div 
      className={cn(
        'grid',
        gridClasses,
        gapClasses,
        className
      )}
    >
      {children}
    </div>
  )
}

// Responsive flexbox container
export function ResponsiveFlex({
  children,
  className,
  direction = 'row',
  wrap = true,
  justify = 'start',
  align = 'stretch',
  gap = 4
}: ResponsiveFlexProps) {
  const responsive = useResponsive()
  
  const directionClasses = {
    row: 'flex-row',
    col: 'flex-col'
  }
  
  const justifyClasses = {
    start: 'justify-start',
    end: 'justify-end',
    center: 'justify-center',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly'
  }
  
  const alignClasses = {
    start: 'items-start',
    end: 'items-end',
    center: 'items-center',
    baseline: 'items-baseline',
    stretch: 'items-stretch'
  }
  
  const gapClass = typeof gap === 'number' ? `gap-${gap}` : gap
  
  return (
    <div 
      className={cn(
        'flex',
        directionClasses[direction],
        wrap && 'flex-wrap',
        justifyClasses[justify],
        alignClasses[align],
        gapClass,
        className
      )}
    >
      {children}
    </div>
  )
}

// Responsive spacing component
export function ResponsiveSpacing({ 
  size = 'md', 
  className 
}: { 
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string 
}) {
  const responsive = useResponsive()
  
  const spacingMap = {
    xs: { height: 'h-2', width: 'w-2' },
    sm: { height: 'h-4', width: 'w-4' },
    md: { height: 'h-8', width: 'w-8' },
    lg: { height: 'h-12', width: 'w-12' },
    xl: { height: 'h-16', width: 'w-16' },
    '2xl': { height: 'h-20', width: 'w-20' }
  }
  
  const spacing = spacingMap[size]
  
  return (
    <div className={cn(spacing.height, spacing.width, className)} />
  )
}

// Responsive text component
export function ResponsiveText({
  children,
  className,
  size = 'base',
  weight = 'normal',
  color = 'default'
}: {
  children: ReactNode
  className?: string
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
  weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold'
  color?: 'default' | 'muted' | 'primary' | 'secondary'
}) {
  const responsive = useResponsive()
  
  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
    '4xl': 'text-4xl'
  }
  
  const weightClasses = {
    light: 'font-light',
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold'
  }
  
  const colorClasses = {
    default: 'text-foreground',
    muted: 'text-muted-foreground',
    primary: 'text-primary',
    secondary: 'text-secondary-foreground'
  }
  
  // Adjust size for mobile
  const adjustedSize = responsive.isMobile && size === 'lg' ? 'base' : size
  
  return (
    <span 
      className={cn(
        sizeClasses[adjustedSize],
        weightClasses[weight],
        colorClasses[color],
        'transition-all duration-200',
        className
      )}
    >
      {children}
    </span>
  )
}

// Responsive button wrapper
export function ResponsiveButton({
  children,
  className,
  size = 'md',
  fullWidth = false,
  ...props
}: {
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  [key: string]: any
}) {
  const responsive = useResponsive()
  
  const sizeClasses = {
    sm: responsive.isMobile ? 'px-3 py-1.5 text-sm' : 'px-3 py-2 text-sm',
    md: responsive.isMobile ? 'px-4 py-2 text-base' : 'px-4 py-2 text-base',
    lg: responsive.isMobile ? 'px-6 py-3 text-lg' : 'px-6 py-3 text-lg'
  }
  
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        sizeClasses[size],
        fullWidth && 'w-full',
        'bg-primary text-primary-foreground hover:bg-primary/90',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// Responsive card wrapper
export function ResponsiveCard({
  children,
  className,
  padding = 'md',
  rounded = 'lg',
  shadow = 'md'
}: {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
}) {
  const responsive = useResponsive()
  
  const paddingClasses = {
    none: '',
    sm: responsive.isMobile ? 'p-2' : 'p-3',
    md: responsive.isMobile ? 'p-3' : 'p-4',
    lg: responsive.isMobile ? 'p-4' : 'p-6'
  }
  
  const roundedClasses = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl'
  }
  
  const shadowClasses = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl'
  }
  
  return (
    <div 
      className={cn(
        'bg-card text-card-foreground transition-all duration-200',
        paddingClasses[padding],
        roundedClasses[rounded],
        shadowClasses[shadow],
        'hover:shadow-lg',
        className
      )}
    >
      {children}
    </div>
  )
}