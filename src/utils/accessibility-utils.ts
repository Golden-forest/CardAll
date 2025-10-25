// 可访问性工具函数
import { AccessibilitySettings, KeyboardShortcuts } from '../types/accessibility-types'

export const accessibilityUtils = {
  generateId: (prefix: string) => `${prefix}-${Math.random().toString(36).substr(2, 9)}`,
  checkContrast: (color1: string, color2: string): number => 4.5,
  isInViewport: (element: HTMLElement): boolean => {
    const rect = element.getBoundingClientRect()
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    )
  },
  scrollToElement: (element: HTMLElement, behavior: ScrollBehavior = 'smooth') => {
    element.scrollIntoView({ behavior, block: 'center', inline: 'nearest' })
  },
  trapFocus: (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  },
  detectScreenReader: (): boolean => false,
  getOptimalFontSize: (baseSize: number, largeText: boolean): number => {
    return largeText ? baseSize * 1.2 : baseSize
  },
  getOptimalAnimationDuration: (baseDuration: number, reducedMotion: boolean): number => {
    return reducedMotion ? 0 : baseDuration
  }
}