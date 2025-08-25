// Hook for managing card style selection

import { useState, useCallback } from 'react'
import { CardStyle } from '../types/card'
import { StyleApplicationContext } from '../types/style'
import { stylePersistence } from '../components/card/styles/style-persistence'

interface UseStyleSelectionProps {
  cardId: string
  currentStyle: CardStyle
  onStyleChange: (cardId: string, newStyle: CardStyle) => void
}

export const useStyleSelection = ({
  cardId,
  currentStyle,
  onStyleChange
}: UseStyleSelectionProps) => {
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const openStylePanel = useCallback(() => {
    setIsPanelOpen(true)
  }, [])

  const closeStylePanel = useCallback(() => {
    setIsPanelOpen(false)
  }, [])

  const applyStyle = useCallback((newStyle: CardStyle) => {
    onStyleChange(cardId, newStyle)
  }, [cardId, onStyleChange])

  const styleApplicationContext: StyleApplicationContext = {
    targetCardId: cardId,
    currentStyle,
    onStyleApply: applyStyle,
    onPanelClose: closeStylePanel
  }

  return {
    isPanelOpen,
    openStylePanel,
    closeStylePanel,
    styleApplicationContext
  }
}

export default useStyleSelection