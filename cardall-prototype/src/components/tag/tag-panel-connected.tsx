// Connected TagPanel component that uses TagPanelContext
import React from 'react'
import { useTagPanel } from '../../contexts/tag-panel-context'
import { TagPanel } from './tag-panel'

export const ConnectedTagPanel: React.FC = () => {
  const { 
    isOpen, 
    currentCardTags, 
    onTagsChange, 
    closeTagPanel 
  } = useTagPanel()

  // Don't render if panel is not open or no callback is provided
  if (!isOpen || !onTagsChange) return null

  return (
    <TagPanel
      isOpen={isOpen}
      onClose={closeTagPanel}
      currentCardTags={currentCardTags}
      onTagsChange={onTagsChange}
    />
  )
}

export default ConnectedTagPanel