import React, { createContext, useContext } from 'react'
import { useAccessibilityLogic } from './use-accessibility-logic'
import { AccessibilityContextType, defaultSettings } from '../types/accessibility-types'
import { defaultShortcuts } from '../types/accessibility-types'

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined)

const AccessibilityProvider = (props: { children: React.ReactNode }) => {
  const accessibility = useAccessibilityLogic()
  
  return React.createElement(
    AccessibilityContext.Provider,
    { value: accessibility },
    props.children
  )
}

const useAccessibilityContext = () => {
  const context = useContext(AccessibilityContext)
  if (context === undefined) {
    throw new Error('useAccessibilityContext must be used within an AccessibilityProvider')
  }
  return context
}

const useAccessibility = () => {
  return useAccessibilityContext()
}

export { 
  AccessibilityProvider, 
  useAccessibilityContext, 
  useAccessibility,
  defaultSettings,
  defaultShortcuts
}