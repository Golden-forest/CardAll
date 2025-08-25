import { useState, useCallback, useEffect } from 'react'
import { Folder, FolderAction } from '@/types/card'

// Mock data for development
const mockFolders: Folder[] = [
  {
    id: 'folder-1',
    name: 'Development',
    color: '#3b82f6',
    icon: 'Code',
    cardIds: ['1'],
    isExpanded: true,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-15')
  },
  {
    id: 'folder-2',
    name: 'Design Resources',
    color: '#8b5cf6',
    icon: 'Palette',
    cardIds: [],
    isExpanded: false,
    createdAt: new Date('2024-01-12'),
    updatedAt: new Date('2024-01-12')
  },
  {
    id: 'folder-3',
    name: 'Learning Notes',
    color: '#10b981',
    icon: 'BookOpen',
    cardIds: ['2'],
    parentId: 'folder-1',
    isExpanded: true,
    createdAt: new Date('2024-01-14'),
    updatedAt: new Date('2024-01-16')
  }
]

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>(mockFolders)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  // Get folder tree structure
  const getFolderTree = useCallback(() => {
    const rootFolders = folders.filter(folder => !folder.parentId)
    
    const buildTree = (parentFolders: Folder[]): (Folder & { children: Folder[] })[] => {
      return parentFolders.map(folder => ({
        ...folder,
        children: buildTree(folders.filter(f => f.parentId === folder.id))
      }))
    }

    return buildTree(rootFolders)
  }, [folders])

  // Folder actions
  const dispatch = useCallback((action: FolderAction) => {
    setFolders(prevFolders => {
      switch (action.type) {
        case 'CREATE_FOLDER':
          const newFolder: Folder = {
            ...action.payload,
            id: `folder-${Date.now()}`,
            cardIds: [],
            createdAt: new Date(),
            updatedAt: new Date()
          }
          return [...prevFolders, newFolder]

        case 'UPDATE_FOLDER':
          return prevFolders.map(folder =>
            folder.id === action.payload.id
              ? { ...folder, ...action.payload.updates, updatedAt: new Date() }
              : folder
          )

        case 'DELETE_FOLDER':
          // Move cards from deleted folder to root
          const folderToDelete = prevFolders.find(f => f.id === action.payload)
          if (folderToDelete) {
            // Also delete child folders
            const childFolders = prevFolders.filter(f => f.parentId === action.payload)
            const allFoldersToDelete = [action.payload, ...childFolders.map(f => f.id)]
            
            return prevFolders.filter(folder => !allFoldersToDelete.includes(folder.id))
          }
          return prevFolders.filter(folder => folder.id !== action.payload)

        case 'TOGGLE_FOLDER':
          return prevFolders.map(folder =>
            folder.id === action.payload
              ? { ...folder, isExpanded: !folder.isExpanded, updatedAt: new Date() }
              : folder
          )

        default:
          return prevFolders
      }
    })
  }, [])

  // Utility functions
  const getFolderById = useCallback((id: string) => {
    return folders.find(folder => folder.id === id)
  }, [folders])

  const getFolderPath = useCallback((folderId: string): Folder[] => {
    const path: Folder[] = []
    let currentFolder = getFolderById(folderId)
    
    while (currentFolder) {
      path.unshift(currentFolder)
      currentFolder = currentFolder.parentId ? getFolderById(currentFolder.parentId) : null
    }
    
    return path
  }, [folders, getFolderById])

  const addCardToFolder = useCallback((cardId: string, folderId: string) => {
    dispatch({
      type: 'UPDATE_FOLDER',
      payload: {
        id: folderId,
        updates: {
          cardIds: [...(getFolderById(folderId)?.cardIds || []), cardId]
        }
      }
    })
  }, [dispatch, getFolderById])

  const removeCardFromFolder = useCallback((cardId: string, folderId: string) => {
    const folder = getFolderById(folderId)
    if (folder) {
      dispatch({
        type: 'UPDATE_FOLDER',
        payload: {
          id: folderId,
          updates: {
            cardIds: folder.cardIds.filter(id => id !== cardId)
          }
        }
      })
    }
  }, [dispatch, getFolderById])

  const moveCardBetweenFolders = useCallback((cardId: string, fromFolderId: string | null, toFolderId: string | null) => {
    if (fromFolderId) {
      removeCardFromFolder(cardId, fromFolderId)
    }
    if (toFolderId) {
      addCardToFolder(cardId, toFolderId)
    }
  }, [addCardToFolder, removeCardFromFolder])

  const canMoveFolder = useCallback((folderId: string, targetParentId: string | null): boolean => {
    // Can't move folder to itself or its descendants
    if (folderId === targetParentId) return false
    
    let currentParent = targetParentId
    while (currentParent) {
      if (currentParent === folderId) return false
      const parentFolder = getFolderById(currentParent)
      currentParent = parentFolder?.parentId || null
    }
    
    return true
  }, [getFolderById])

  // Auto-save to localStorage
  useEffect(() => {
    const saveTimer = setTimeout(() => {
      localStorage.setItem('cardall-folders', JSON.stringify(folders))
    }, 1000)

    return () => clearTimeout(saveTimer)
  }, [folders])

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('cardall-folders')
    if (saved) {
      try {
        const parsedFolders = JSON.parse(saved)
        setFolders(parsedFolders)
      } catch (error) {
        console.error('Failed to load saved folders:', error)
      }
    }
  }, [])

  return {
    folders,
    folderTree: getFolderTree(),
    selectedFolderId,
    setSelectedFolderId,
    dispatch,
    getFolderById,
    getFolderPath,
    addCardToFolder,
    removeCardFromFolder,
    moveCardBetweenFolders,
    canMoveFolder
  }
}