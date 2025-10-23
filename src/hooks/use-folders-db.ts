import { useState, useCallback, useEffect } from 'react'
import { Folder, FolderAction, FolderFilter } from '@/types/card'
import { db, DbFolder } from '@/services/database'
// import { cloudSyncService } from '@/services/cloud-sync' // 已删除云端同步功能
// import { authService } from '@/services/auth' // 已删除认证功能

// 转换数据库文件夹到前端文件夹格式
const dbFolderToFolder = (dbFolder: DbFolder): Folder => {
  const { userId, syncVersion, pendingSync, ...folder } = dbFolder
  return {
    ...folder,
    id: folder.id || '',
    createdAt: new Date(folder.createdAt),
    updatedAt: new Date(folder.updatedAt)
  }
}

// 转换前端文件夹到数据库格式
const folderToDbFolder = (folder: Folder, userId?: string): DbFolder => {
  return {
    ...folder,
    userId,
    syncVersion: 1,
    pendingSync: true,
    updatedAt: new Date(folder.updatedAt)
  }
}

// 获取当前用户ID（云端同步功能已删除）
const getCurrentUserId = (): string | null => {
  // 认证功能已删除，返回null表示本地用户
  return null
}

export function useFoldersDb() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [filter, setFilter] = useState<FolderFilter>({
    searchTerm: '',
    showEmpty: true
  })
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 从数据库加载文件夹
  const loadFolders = useCallback(async () => {
    try {
      setIsLoading(true)
      const dbFolders = await db.folders.toArray()
      const convertedFolders = dbFolders.map(dbFolderToFolder)
      setFolders(convertedFolders)
    } catch (error) {
      console.error('Failed to load folders:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 初始化时加载数据
  useEffect(() => {
    loadFolders()
  }, [loadFolders])

  // 监听数据库变化
  useEffect(() => {
    const subscription = db.folders.hook('creating', (primKey, obj, trans) => {
      console.log('Folder creating:', primKey)
    })

    const updateSubscription = db.folders.hook('updating', (modifications, primKey, obj, trans) => {
      console.log('Folder updating:', primKey)
    })

    const deleteSubscription = db.folders.hook('deleting', (primKey, obj, trans) => {
      console.log('Folder deleting:', primKey)
    })

    return () => {
      subscription?.unsubscribe()
      updateSubscription?.unsubscribe()
      deleteSubscription?.unsubscribe()
    }
  }, [])

  // 过滤文件夹
  const filteredFolders = useCallback(() => {
    const filtered = folders.filter(folder => {
      // 搜索词过滤
      if (filter.searchTerm) {
        const searchLower = filter.searchTerm.toLowerCase()
        const matchesName = folder.name.toLowerCase().includes(searchLower)
        if (!matchesName) return false
      }

      // 父文件夹过滤
      if (filter.parentId !== undefined && folder.parentId !== filter.parentId) {
        return false
      }

      return true
    })

    // 排序文件夹
    filtered.sort((a, b) => {
      // 按创建时间降序排列
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return filtered
  }, [folders, filter])

  // 文件夹操作
  const dispatch = useCallback(async (action: FolderAction) => {
    const userId = getCurrentUserId()
    
    try {
      switch (action.type) {
        case 'CREATE_FOLDER': {
          const folderId = crypto.randomUUID()
          const newFolder: DbFolder = {
            ...action.payload,
            id: folderId,
            userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            syncVersion: 1,
            pendingSync: true
          }

          console.log('📁 useFoldersDb: Creating new folder', newFolder)
          
          const id = await db.folders.add(newFolder)
          console.log('📁 useFoldersDb: Folder added to local DB with id', id)
          
          // 云端同步功能已删除，仅保存到本地数据库
          console.log('📁 useFoldersDb: Local save completed')
          
          // 重新加载数据
          await loadFolders()
          break
        }

        case 'UPDATE_FOLDER': {
          const updates = {
            ...action.payload.updates,
            userId,
            updatedAt: new Date(),
            syncVersion: 1,
            pendingSync: true
          }

          await db.folders.update(action.payload.id, updates)
          // 云端同步功能已删除，仅更新本地数据库
          
          await loadFolders()
          break
        }

        case 'DELETE_FOLDER': {
          await db.folders.delete(action.payload)
          // 云端同步功能已删除，仅删除本地数据库
          
          await loadFolders()
          break
        }

        case 'SELECT_FOLDER':
          setSelectedFolderIds(prev => 
            prev.includes(action.payload) 
              ? prev.filter(id => id !== action.payload)
              : [...prev, action.payload]
          )
          break

        case 'DESELECT_ALL_FOLDERS':
          setSelectedFolderIds([])
          break

        case 'TOGGLE_EXPAND': {
          const folder = await db.folders.get(action.payload)
          if (folder) {
            const updates = {
              isExpanded: !folder.isExpanded,
              userId,
              updatedAt: new Date(),
              syncVersion: (folder.syncVersion || 0) + 1,
              pendingSync: true
            }

            await db.folders.update(action.payload, updates)
            // 云端同步功能已删除，仅更新本地数据库
            
            await loadFolders()
          }
          break
        }

        case 'MOVE_CARDS_TO_FOLDER': {
          const updates = {
            // 这里需要更新卡片引用，暂时简化处理
            userId,
            updatedAt: new Date(),
            syncVersion: 1,
            pendingSync: true
          }

          await db.folders.update(action.payload.folderId, updates)
          // 云端同步功能已删除，仅更新本地数据库
          
          await loadFolders()
          break
        }

        default:
          console.warn('Unknown folder action:', action)
      }
    } catch (error) {
      console.error('Folder operation failed:', error)
      throw error
    }
  }, [loadFolders])

  // 工具函数
  const getFolderById = useCallback((id: string) => {
    return folders.find(folder => folder.id === id)
  }, [folders])

  const getSelectedFolders = useCallback(() => {
    return folders.filter(folder => selectedFolderIds.includes(folder.id))
  }, [folders, selectedFolderIds])

  const getFolderHierarchy = useCallback(() => {
    const buildHierarchy = (parentId: string | null = null): Folder[] => {
      return filteredFolders()
        .filter(folder => folder.parentId === parentId)
        .map(folder => ({
          ...folder,
          children: buildHierarchy(folder.id)
        }))
    }
    
    return buildHierarchy()
  }, [filteredFolders])

  const getRootFolders = useCallback(() => {
    return filteredFolders().filter(folder => !folder.parentId)
  }, [filteredFolders])

  const getChildFolders = useCallback((parentId: string) => {
    return filteredFolders().filter(folder => folder.parentId === parentId)
  }, [filteredFolders])

  // 获取文件夹中的卡片数量（需要与卡片服务集成）
  const getFolderCardCount = useCallback((folderId: string) => {
    // 这里需要与卡片服务集成来获取准确的计数
    // 暂时返回0
    return 0
  }, [])

  return {
    folders: filteredFolders(),
    allFolders: folders,
    filter,
    setFilter,
    selectedFolderIds,
    isLoading,
    dispatch,
    getFolderById,
    getSelectedFolders,
    getFolderHierarchy,
    getRootFolders,
    getChildFolders,
    getFolderCardCount,
    loadFolders
  }
}