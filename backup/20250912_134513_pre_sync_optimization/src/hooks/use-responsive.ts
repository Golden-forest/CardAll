import { useState, useEffect } from 'react'

export interface Breakpoint {
  name: string
  minWidth: number
  maxWidth?: number
}

export const breakpoints: Breakpoint[] = [
  { name: 'xs', minWidth: 0, maxWidth: 639 },
  { name: 'sm', minWidth: 640, maxWidth: 767 },
  { name: 'md', minWidth: 768, maxWidth: 1023 },
  { name: 'lg', minWidth: 1024, maxWidth: 1279 },
  { name: 'xl', minWidth: 1280, maxWidth: 1535 },
  { name: '2xl', minWidth: 1536 }
]

export type BreakpointName = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export interface DeviceInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isTouchDevice: boolean
  screenWidth: number
  screenHeight: number
  currentBreakpoint: BreakpointName
  orientation: 'portrait' | 'landscape'
}

export function useResponsive(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    isTouchDevice: false,
    screenWidth: 0,
    screenHeight: 0,
    currentBreakpoint: 'md',
    orientation: 'landscape'
  })

  useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      
      // Determine current breakpoint
      const currentBreakpoint = breakpoints.reduce((prev, curr) => {
        return width >= curr.minWidth ? curr.name : prev
      }, 'xs' as BreakpointName)
      
      // Determine device type
      const isMobile = width < 768
      const isTablet = width >= 768 && width < 1024
      const isDesktop = width >= 1024
      
      // Check for touch device
      const isTouchDevice = 'ontouchstart' in window || 
        navigator.maxTouchPoints > 0 || 
        (navigator as any).msMaxTouchPoints > 0
      
      // Determine orientation
      const orientation = width > height ? 'landscape' : 'portrait'
      
      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktop,
        isTouchDevice,
        screenWidth: width,
        screenHeight: height,
        currentBreakpoint,
        orientation
      })
    }

    // Initial update
    updateDeviceInfo()

    // Add event listeners
    window.addEventListener('resize', updateDeviceInfo)
    window.addEventListener('orientationchange', updateDeviceInfo)

    return () => {
      window.removeEventListener('resize', updateDeviceInfo)
      window.removeEventListener('orientationchange', updateDeviceInfo)
    }
  }, [])

  return deviceInfo
}

// Responsive value helper
export function getResponsiveValue<T>(
  values: Partial<Record<BreakpointName, T>>,
  currentBreakpoint: BreakpointName,
  defaultValue: T
): T {
  const breakpointOrder: BreakpointName[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl']
  const currentIndex = breakpointOrder.indexOf(currentBreakpoint)
  
  // Find the nearest defined value for the current or smaller breakpoint
  for (let i = currentIndex; i >= 0; i--) {
    const bp = breakpointOrder[i]
    if (values[bp] !== undefined) {
      return values[bp]!
    }
  }
  
  return defaultValue
}

// Grid columns helper
export function getGridColumns(deviceInfo: DeviceInfo): number {
  const columnsMap: Partial<Record<BreakpointName, number>> = {
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 5,
    '2xl': 6
  }
  
  return getResponsiveValue(columnsMap, deviceInfo.currentBreakpoint, 3)
}

// Card size helper
export function getCardSize(deviceInfo: DeviceInfo): 'sm' | 'md' | 'lg' {
  if (deviceInfo.isMobile) return 'sm'
  if (deviceInfo.isTablet) return 'md'
  return 'lg'
}

// Spacing helper
export function getSpacing(deviceInfo: DeviceInfo): number {
  const spacingMap: Partial<Record<BreakpointName, number>> = {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 28,
    '2xl': 32
  }
  
  return getResponsiveValue(spacingMap, deviceInfo.currentBreakpoint, 20)
}