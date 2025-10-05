// Tag selection panel component (based on style-panel structure)

import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Tag as TagType } from '../../types/card'
import { TagGrid } from './tag-grid'
import { TagSearch } from './tag-search'
import { useCardAllTags } from '../../contexts/cardall-context'

interface TagPanelProps {
  isOpen: boolean
  onClose: () => void
  currentCardTags: string[]
  onTagsChange: (tags: string[]) => void
}

export const TagPanel: React.FC<TagPanelProps> = ({
  isOpen,
  onClose,
  currentCardTags,
  onTagsChange
}) => {
  const { 
    tags, 
    searchTags, 
    dispatch, 
    createTagIfNotExists 
  } = useCardAllTags()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [displayedTags, setDisplayedTags] = useState<TagType[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>(currentCardTags)

  // Update displayed tags based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      const searchResults = searchTags(searchQuery)
      setDisplayedTags(searchResults)
    } else {
      // Show all tags sorted by usage frequency, filter out deleted tags
      const sortedTags = [...tags].sort((a, b) => b.count - a.count)
      setDisplayedTags(sortedTags)
    }
  }, [searchQuery, tags, searchTags])

  // Update selected tags when currentCardTags changes
  useEffect(() => {
    setSelectedTags(currentCardTags)
  }, [currentCardTags])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const handleCreateTag = async (name: string) => {
    try {
      // Create new tag and add it to current card
      await dispatch({
        type: 'CREATE_TAG',
        payload: {
          name,
          color: '#3b82f6' // Default color, will be overridden by the hook
        }
      })

      const newSelectedTags = [...selectedTags, name]
      setSelectedTags(newSelectedTags)
      onTagsChange(newSelectedTags)
      setSearchQuery('')
    } catch (error) {
      console.error('创建标签失败:', error)
      // 即使创建失败，也添加到选中列表（本地状态）
      const newSelectedTags = [...selectedTags, name]
      setSelectedTags(newSelectedTags)
      onTagsChange(newSelectedTags)
      setSearchQuery('')
    }
  }

  const handleTagClick = (tag: TagType) => {
    const isSelected = selectedTags.includes(tag.name)
    let newSelectedTags: string[]
    
    if (isSelected) {
      // Remove tag
      newSelectedTags = selectedTags.filter(t => t !== tag.name)
    } else {
      // Add tag
      newSelectedTags = [...selectedTags, tag.name]
    }
    
    setSelectedTags(newSelectedTags)
    onTagsChange(newSelectedTags)
  }

  const handleClose = () => {
    setSearchQuery('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)', backdropFilter: 'blur(8px)' }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0" 
        onClick={handleClose}
      />
      
      {/* Panel - Responsive sizing */}
      <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 p-6 w-full max-w-sm sm:max-w-md lg:max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Manage Tags</h2>
            <p className="text-sm text-gray-500 mt-1">
              Select tags for this card
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <TagSearch
          onSearch={handleSearch}
          onCreateTag={handleCreateTag}
          searchResults={displayedTags}
          searchQuery={searchQuery}
          className="mb-4"
        />

        {/* Selected Tags Summary */}
        {selectedTags.length > 0 && (
          <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100/50">
            <p className="text-sm font-medium text-blue-700 mb-3">
              Selected tags ({selectedTags.length}):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selectedTags.map(tagName => (
                <span 
                  key={tagName}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm"
                >
                  {tagName}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tag Grid - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <TagGrid
            tags={displayedTags}
            selectedTags={selectedTags}
            onTagClick={handleTagClick}
            emptyMessage={searchQuery ? `No tags found for "${searchQuery}"` : 'No tags available'}
          />
        </div>

        {/* Footer Info */}
        <div className="text-xs text-gray-400 text-center mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-center gap-2">
            <div className="w-1 h-1 rounded-full bg-gray-300"></div>
            <span>Click tags to add/remove them from this card</span>
            <div className="w-1 h-1 rounded-full bg-gray-300"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TagPanel