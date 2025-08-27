// Global style panel context for managing style selection across all cards

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { StylePanel } from '../components/card/styles/style-panel'
import { StyleApplicationContext } from '../types/style'

interface StylePanelState {
  isOpen: boolean
  context: StyleApplicationContext | null
}

interface StylePanelContextType {
  openStylePanel: (context: StyleApplicationContext) => void
  closeStylePanel: () => void
  isOpen: boolean
}

const StylePanelContext = createContext<StylePanelContextType | undefined>(undefined)

export const useStylePanel = () => {
  const context = useContext(StylePanelContext)
  if (!context) {
    throw new Error('useStylePanel must be used within a StylePanelProvider')
  }
  return context
}

interface StylePanelProviderProps {
  children: ReactNode
}

export const StylePanelProvider: React.FC<StylePanelProviderProps> = ({ children }) => {
  const [panelState, setPanelState] = useState<StylePanelState>({
    isOpen: false,
    context: null
  })

  const openStylePanel = (context: StyleApplicationContext) => {
    setPanelState({
      isOpen: true,
      context
    })
  }

  const closeStylePanel = () => {
    setPanelState({
      isOpen: false,
      context: null
    })
  }

  const contextValue: StylePanelContextType = {
    openStylePanel,
    closeStylePanel,
    isOpen: panelState.isOpen
  }

  return (
    <StylePanelContext.Provider value={contextValue}>
      {children}
      
      {/* Portal-rendered Style Panel */}
      {typeof window !== 'undefined' && panelState.isOpen && panelState.context && 
        createPortal(
          <StylePanel
            isOpen={panelState.isOpen}
            onClose={closeStylePanel}
            context={panelState.context}
          />,
          document.body
        )
      }
    </StylePanelContext.Provider>
  )
}