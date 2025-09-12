import React, { useState, useEffect, useCallback, useRef } from 'react'
import { AccessibilitySettings, AccessibilityContextType, defaultSettings } from '../types/accessibility-types'

export function useAccessibilityLogic() {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings)
  const [isInitialized, setIsInitialized] = useState(false)
  const announcementsRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('accessibility-settings')
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        setSettings({ ...defaultSettings, ...parsed })
      }
      
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches
      
      if (prefersReducedMotion) {
        setSettings(prev => ({ ...prev, reducedMotion: true }))
      }
      
      if (prefersHighContrast) {
        setSettings(prev => ({ ...prev, highContrast: true }))
      }
      
      setIsInitialized(true)
    } catch (error) {
      console.error('Failed to load accessibility settings:', error)
      setIsInitialized(true)
    }
  }, [])

  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem('accessibility-settings', JSON.stringify(settings))
      } catch (error) {
        console.error('Failed to save accessibility settings:', error)
      }
    }
  }, [settings, isInitialized])

  useEffect(() => {
    if (!isInitialized) return

    const root = document.documentElement
    
    if (settings.highContrast) {
      root.classList.add('high-contrast')
    } else {
      root.classList.remove('high-contrast')
    }
    
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion')
    } else {
      root.classList.remove('reduced-motion')
    }
    
    if (settings.largeText) {
      root.classList.add('large-text')
    } else {
      root.classList.remove('large-text')
    }
    
    if (settings.colorBlindSupport) {
      root.classList.add('color-blind')
    } else {
      root.classList.remove('color-blind')
    }
    
    if (settings.focusVisible) {
      root.classList.add('focus-visible')
    } else {
      root.classList.remove('focus-visible')
    }
    
    if (settings.keyboardOnly) {
      root.classList.add('keyboard-only')
    } else {
      root.classList.remove('keyboard-only')
    }
    
    if (settings.screenReader) {
      root.setAttribute('aria-live', 'polite')
    } else {
      root.removeAttribute('aria-live')
    }
  }, [settings, isInitialized])

  const updateSetting = useCallback((key: keyof AccessibilitySettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    announce(`Accessibility setting ${key} ${value ? 'enabled' : 'disabled'}`)
  }, [])

  const toggleSetting = useCallback((key: keyof AccessibilitySettings) => {
    setSettings(prev => {
      const newValue = !prev[key]
      announce(`Accessibility setting ${key} ${newValue ? 'enabled' : 'disabled'}`)
      return { ...prev, [key]: newValue }
    })
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings)
    announce('All accessibility settings reset to default')
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return
      
      switch (e.key.toLowerCase()) {
        case 'h':
          e.preventDefault()
          toggleSetting('highContrast')
          break
        case 'r':
          e.preventDefault()
          toggleSetting('reducedMotion')
          break
        case 'l':
          e.preventDefault()
          toggleSetting('largeText')
          break
        case 's':
          e.preventDefault()
          toggleSetting('screenReader')
          break
        case 'f':
          e.preventDefault()
          toggleSetting('focusVisible')
          break
        case 'a':
          e.preventDefault()
          toggleSetting('announcements')
          break
        case 'c':
          e.preventDefault()
          toggleSetting('colorBlindSupport')
          break
        case '?':
          e.preventDefault()
          announce('Keyboard shortcuts: Alt+H (high contrast), Alt+R (reduced motion), Alt+L (large text), Alt+S (screen reader), Alt+F (focus visible), Alt+A (announcements), Alt+C (color blind), Alt+? (shortcuts)')
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleSetting])

  useEffect(() => {
    const handleFirstTab = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        updateSetting('keyboardOnly', true)
        document.removeEventListener('keydown', handleFirstTab)
      }
    }

    const handleMouseMove = () => {
      updateSetting('keyboardOnly', false)
    }

    document.addEventListener('keydown', handleFirstTab)
    document.addEventListener('mousemove', handleMouseMove)

    return () => {
      document.removeEventListener('keydown', handleFirstTab)
      document.removeEventListener('mousemove', handleMouseMove)
    }
  }, [updateSetting])

  const announce = useCallback((message: string) => {
    if (!settings.announcements) return

    if (!announcementsRef.current) {
      announcementsRef.current = document.createElement('div')
      announcementsRef.current.setAttribute('aria-live', 'polite')
      announcementsRef.current.setAttribute('aria-atomic', 'true')
      announcementsRef.current.className = 'sr-only'
      document.body.appendChild(announcementsRef.current)
    }

    const announcement = document.createElement('div')
    announcement.textContent = message
    announcementsRef.current.appendChild(announcement)

    setTimeout(() => {
      if (announcementsRef.current?.contains(announcement)) {
        announcementsRef.current.removeChild(announcement)
      }
    }, 1000)
  }, [settings.announcements])

  return {
    settings,
    updateSetting,
    toggleSetting,
    resetSettings,
    announce,
    isInitialized
  }
}