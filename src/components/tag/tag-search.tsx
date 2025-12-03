// Tag search and creation component

import React, { useState, useEffect } from 'react'
import { Search, Plus } from 'lucide-react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'
import { Tag as TagType } from '../../types/card'

interface TagSearchProps {
  onSearch: (query: string) => void
  onCreateTag: (name: string) => void
  searchResults: TagType[]
  searchQuery: string
  className?: string
}

export const TagSearch: React.FC<TagSearchProps> = ({
  onSearch,
  onCreateTag,
  searchResults,
  searchQuery,
  className
}) => {
  const [inputValue, setInputValue] = useState(searchQuery)

  useEffect(() => {
    setInputValue(searchQuery)
  }, [searchQuery])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    onSearch(value)
  }

  const handleCreateTag = () => {
    if (inputValue.trim()) {
      onCreateTag(inputValue.trim())
      setInputValue('')
      onSearch('')
    }
  }

  const showCreateOption = inputValue.trim() && 
    searchResults.length === 0 && 
    !searchResults.some(tag => tag.name.toLowerCase() === inputValue.toLowerCase())

  return (
    <div className={cn('space-y-3', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search tags or create new..."
          value={inputValue}
          onChange={handleInputChange}
          className="pl-11 pr-4 py-3 rounded-2xl border-gray-200/60 bg-gray-50/50 dark:border-gray-700/60 dark:bg-gray-900/50 backdrop-blur-sm focus:bg-white dark:focus:bg-gray-800 focus:border-blue-300 dark:focus:border-blue-500 transition-all duration-300"
        />
      </div>

      {/* Create New Tag Option */}
      {showCreateOption && (
        <Button
          onClick={handleCreateTag}
          variant="outline"
          className="w-full justify-start text-left rounded-xl border-dashed border-2 border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/30 transition-all duration-300 py-3"
        >
          <Plus className="h-4 w-4 mr-2 text-blue-500 dark:text-blue-400" />
          <span className="text-gray-700 dark:text-gray-300">Create tag "<span className="font-medium text-blue-600 dark:text-blue-400">{inputValue}</span>"</span>
        </Button>
      )}
    </div>
  )
}

export default TagSearch