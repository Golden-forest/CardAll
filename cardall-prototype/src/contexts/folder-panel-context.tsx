// Folder panel context for managing folder selection panel state

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FolderSelectionPanel } from '../components/folder/folder-selection-panel'

interface FolderPanelContextType {
  isOpen: boolean
  currentCardId: string | null
  currentFolderId: string | null
  onFolderSelect: ((folderId: string | null) => void) | null
  openFolderPanel: (config: FolderPanelConfig) => void
  closeFolderPanel: () => void
}

interface FolderPanelConfig {
  targetCardId: string
  currentFolderId?: string | null
  onFolderApply: (folderId: string | null) => void
  onPanelClose?: () => void
}

const FolderPanelContext = createContext<FolderPanelContextType | undefined>(undefined)

interface FolderPanelProviderProps {
  children: ReactNode
}

export function FolderPanelProvider({ children }: FolderPanelProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentCardId, setCurrentCardId] = useState<string | null>(null)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [onFolderSelect, setOnFolderSelect] = useState<((folderId: string | null) => void) | null>(null)

  const openFolderPanel = (config: FolderPanelConfig) => {
    setCurrentCardId(config.targetCardId)
    setCurrentFolderId(config.currentFolderId || null)
    setOnFolderSelect(() => config.onFolderApply)
    setIsOpen(true)
  }

  const closeFolderPanel = () => {
    setIsOpen(false)
    setCurrentCardId(null)
    setCurrentFolderId(null)
    setOnFolderSelect(null)
  }

  const value: FolderPanelContextType = {
    isOpen,
    currentCardId,
    currentFolderId,
    onFolderSelect,
    openFolderPanel,
    closeFolderPanel
  }

  return (
    <FolderPanelContext.Provider value={value}>
      {children}
      
      {/* Portal-rendered Folder Selection Panel */}
      {typeof window !== 'undefined' && isOpen && currentCardId && 
        createPortal(
          <FolderSelectionPanel
            isOpen={isOpen}
            onClose={closeFolderPanel}
            currentCardId={currentCardId}
            currentFolderId={currentFolderId}
            onFolderSelect={onFolderSelect}
          />,
          document.body
        )
      }
    </FolderPanelContext.Provider>
  )
}

export function useFolderPanel() {
  const context = useContext(FolderPanelContext)
  if (context === undefined) {
    throw new Error('useFolderPanel must be used within a FolderPanelProvider')
  }
  return context
}