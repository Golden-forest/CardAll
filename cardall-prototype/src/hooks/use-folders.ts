import { useState, useCallback, useEffect } from 'react'
import { Folder, FolderAction, FolderFilter } from '@/types/card'
import { db, DbFolder } from '@/services/database-simple'
import { cloudSyncService } from '@/services/cloud-sync'
import { authService } from '@/services/auth'
import { syncLockManager } from '@/services/sync-lock-manager'
import { toast } from '@/hooks/use-toast'

// 转换数据库文件夹到前端文件夹格式
const dbFolderToFolder = (dbFolder: DbFolder): Folder => {
  const { userId, syncVersion, pendingSync, ...folder } = dbFolder
  return {
    ...folder,
    id: folder.id || '',
    cardIds: folder.cardIds || [], // 确保cardIds字段存在，默认为空数组
    createdAt: new Date(folder.createdAt),
    updatedAt: new Date(folder.updatedAt)
  }
}

// 转换前端文件夹到数据库格式
const folderToDbFolder = (folder: Folder, userId?: string): DbFolder => {
  return {
    ...folder,
    userId,
    userType: authService.getUserType(),
    syncVersion: 1,
    pendingSync: true,
    updatedAt: new Date(folder.updatedAt)
  }
}

// 获取当前用户ID
const getCurrentUserId = (): string => {
  return authService.getCurrentUserId()
}

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [filter, setFilter] = useState<FolderFilter>({
    searchTerm: '',
    showEmpty: true
  })
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // 同步锁状态由 syncLockManager 统一管理
  // 这里保留一些状态用于UI显示
  const [isSyncing, setIsSyncing] = useState(false)

  // 从数据库加载文件夹
  const loadFolders = useCallback(async () => {
    try {
      setIsLoading(true)
      const dbFolders = await db.folders.toArray()
      const convertedFolders = dbFolders.map(dbFolderToFolder)
      console.log('📂 Loaded folders from database:', {
        count: dbFolders.length,
        dbFolders: dbFolders.map(f => ({ id: f.id, name: f.name, parentId: f.parentId })),
        convertedFolders: convertedFolders.map(f => ({ id: f.id, name: f.name, parentId: f.parentId }))
      })
      setFolders(convertedFolders)
    } catch (error) {
      console.error('Failed to load folders:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 安全的文件夹加载函数，考虑同步锁状态
  const safeLoadFolders = useCallback(async (forceReload = false, isLocalOperation = false) => {
    // 获取当前锁状态
    const lockStatus = syncLockManager.getLockStatus()
    
    // 本地操作优先级最高，强制加载
    if (isLocalOperation) {
      console.log('🔓 Local operation forcing folder reload')
    } else if (lockStatus.localLock && !forceReload) {
      console.log('🔒 Local sync lock active, skipping folder reload')
      return
    } else if (lockStatus.cloudLock && !forceReload) {
      console.log('☁️ Cloud sync lock active, skipping folder reload')
      return
    }
    
    try {
      setIsLoading(true)
      
      // 添加超时机制，防止长时间阻塞
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Folder loading timeout')), 5000)
      })
      
      const loadPromise = db.folders.toArray()
      
      // 使用 Promise.race 实现超时控制
      const dbFolders = await Promise.race([loadPromise, timeoutPromise]) as any[]
      
      const convertedFolders = dbFolders.map(dbFolderToFolder)
      console.log('📂 Safe loaded folders from database:', {
        count: dbFolders.length,
        folders: convertedFolders.map(f => ({ id: f.id, name: f.name }))
      })
      
      // 验证数据完整性
      if (Array.isArray(convertedFolders)) {
        setFolders(convertedFolders)
        
        // 如果是本地操作，添加额外的验证
        if (isLocalOperation) {
          console.log('✅ Local operation folder update completed successfully')
        }
      } else {
        console.error('❌ Invalid folder data format:', convertedFolders)
        throw new Error('Invalid folder data format')
      }
    } catch (error) {
      console.error('Failed to safely load folders:', error)
      
      // 如果是本地操作失败，尝试重试一次
      if (isLocalOperation) {
        console.log('🔄 Retrying folder load for local operation...')
        try {
          await new Promise(resolve => setTimeout(resolve, 100))
          const retryFolders = await db.folders.toArray()
          const retryConverted = retryFolders.map(dbFolderToFolder)
          setFolders(retryConverted)
          console.log('✅ Retry successful for local operation')
        } catch (retryError) {
          console.error('❌ Retry failed:', retryError)
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 初始化时加载数据
  useEffect(() => {
    loadFolders()
  }, [loadFolders])

  // 监听数据库变化并自动更新UI - 添加防抖机制
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout
    
    const debouncedLoadFolders = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        safeLoadFolders(false, true) // 标记为本地操作
      }, 200) // 200ms 防抖延迟
    }
    
    const subscription = db.folders.hook('creating', (primKey, obj, trans) => {
      console.log('Folder creating:', primKey)
      debouncedLoadFolders()
    })

    const updateSubscription = db.folders.hook('updating', (modifications, primKey, obj, trans) => {
      console.log('Folder updating:', primKey)
      debouncedLoadFolders()
    })

    const deleteSubscription = db.folders.hook('deleting', (primKey, obj, trans) => {
      console.log('Folder deleting:', primKey)
      debouncedLoadFolders()
    })

    return () => {
      subscription?.unsubscribe()
      updateSubscription?.unsubscribe()
      deleteSubscription?.unsubscribe()
      clearTimeout(debounceTimer)
    }
  }, [safeLoadFolders])

  // 过滤文件夹
  const filteredFolders = useCallback(() => {
    let filtered = folders.filter(folder => {
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
    
    // 使用同步锁管理器获取本地锁
    const lockAcquired = await syncLockManager.acquireLocalLock()
    if (!lockAcquired) {
      console.warn('🔒 Failed to acquire local sync lock, operation may conflict')
    }
    
    try {
      switch (action.type) {
        case 'CREATE_FOLDER': {
          setIsSyncing(true)
          
          try {
            const folderId = crypto.randomUUID()
            const userType = authService.getUserType()
            const newFolder: DbFolder = {
              ...action.payload,
              id: folderId,
              userId,
              userType,
              createdAt: new Date(),
              updatedAt: new Date(),
              syncVersion: 1,
              pendingSync: true
            }

            console.log('📁 Creating new folder:', newFolder)
            
            // 先完成本地数据库操作
            const id = await db.folders.add(newFolder)
            console.log('✅ Folder created in local database with id:', id)
            
            // 验证数据库写入是否成功
            await new Promise(resolve => setTimeout(resolve, 100))
            const createdFolder = await db.folders.get(folderId)
            if (createdFolder) {
              console.log('✅ Folder verified in database:', createdFolder)
            } else {
              console.error('❌ Folder not found in database after creation!')
            }
            
            // 同步作为独立后台操作
            try {
              await cloudSyncService.queueOperation({
                type: 'create',
                table: 'folders',
                data: newFolder,
                localId: folderId
              })
              console.log('🔄 Folder creation sync operation queued')
            } catch (syncError) {
              console.warn('⚠️ Failed to queue folder creation sync operation:', syncError)
              // 显示同步失败提示但不影响本地操作
              toast({
                title: "云端同步失败",
                description: "文件夹已创建，但同步到云端失败。请检查网络连接。",
                variant: "destructive"
              })
            }
            
            // 使用安全的加载函数重新加载数据，强制更新UI
            await safeLoadFolders(true, true)
            
            // 最终验证UI状态
            console.log('📊 Final UI state check:', {
              foldersCount: folders.length,
              lastFolder: folders[folders.length - 1]
            })
          } finally {
            // 释放本地锁
            syncLockManager.releaseLocalLock()
            setIsSyncing(false)
          }
          break
        }

        case 'UPDATE_FOLDER': {
          setIsSyncing(true)
          
          try {
            // 获取当前文件夹以正确递增同步版本
            const currentFolder = await db.folders.get(action.payload.id)
            const currentSyncVersion = currentFolder?.syncVersion || 0
            
            const updates = {
              ...action.payload.updates,
              userId,
              userType: authService.getUserType(),
              updatedAt: new Date(),
              syncVersion: currentSyncVersion + 1,
              pendingSync: true
            }

            console.log('📁 Updating folder:', { folderId: action.payload.id, updates })
            
            // 先完成本地数据库操作
            await db.folders.update(action.payload.id, updates)
            console.log('✅ Folder updated in local database')
            
            // 同步作为独立后台操作
            try {
              await cloudSyncService.queueOperation({
                type: 'update',
                table: 'folders',
                data: updates,
                localId: action.payload.id
              })
              console.log('🔄 Folder update sync operation queued')
            } catch (syncError) {
              console.warn('⚠️ Failed to queue folder update sync operation:', syncError)
              // 显示同步失败提示但不影响本地操作
              toast({
                title: "云端同步失败",
                description: "文件夹已更新，但同步到云端失败。请检查网络连接。",
                variant: "destructive"
              })
            }
            
            await safeLoadFolders(true, true)
          } finally {
            // 释放本地锁
            syncLockManager.releaseLocalLock()
            setIsSyncing(false)
          }
          break
        }

        case 'DELETE_FOLDER': {
          // 本地锁由 syncLockManager 统一管理
          setIsSyncing(true)
          
          try {
            console.log('🗑️ Deleting folder:', { folderId: action.payload })
            
            // 先完成本地数据库操作
            await db.folders.delete(action.payload)
            console.log('✅ Folder deleted from local database')
            
            // 同步作为独立后台操作
            try {
              await cloudSyncService.queueOperation({
                type: 'delete',
                table: 'folders',
                data: { userId },
                localId: action.payload
              })
              console.log('🔄 Folder deletion sync operation queued')
            } catch (syncError) {
              console.warn('⚠️ Failed to queue folder deletion sync operation:', syncError)
              // 显示同步失败提示但不影响本地操作
              toast({
                title: "云端同步失败",
                description: "文件夹已删除，但同步到云端失败。请检查网络连接。",
                variant: "destructive"
              })
            }
            
            await safeLoadFolders(true, true)
          } finally {
            // 释放本地锁
            syncLockManager.releaseLocalLock()
            setIsSyncing(false)
          }
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
          // 本地锁由 syncLockManager 统一管理
          setIsSyncing(true)
          
          try {
            const folder = await db.folders.get(action.payload)
            if (folder) {
              const updates = {
                isExpanded: !folder.isExpanded,
                userId,
                userType: authService.getUserType(),
                updatedAt: new Date(),
                syncVersion: (folder.syncVersion || 0) + 1,
                pendingSync: true
              }

              console.log('📂 Toggling folder expand:', { folderId: action.payload, isExpanded: updates.isExpanded })
              
              // 先完成本地数据库操作
              await db.folders.update(action.payload, updates)
              console.log('✅ Folder expand state updated in local database')
              
              // 同步作为独立后台操作
              try {
                await cloudSyncService.queueOperation({
                  type: 'update',
                  table: 'folders',
                  data: updates,
                  localId: action.payload
                })
                console.log('🔄 Folder expand sync operation queued')
              } catch (syncError) {
                console.warn('⚠️ Failed to queue folder expand sync operation:', syncError)
                // 显示同步失败提示但不影响本地操作
                toast({
                  title: "云端同步失败",
                  description: "文件夹展开状态已更新，但同步到云端失败。请检查网络连接。",
                  variant: "destructive"
                })
              }
              
              await safeLoadFolders(true, true)
            }
          } finally {
            // 释放本地锁
            syncLockManager.releaseLocalLock()
            setIsSyncing(false)
          }
          break
        }

        case 'MOVE_CARDS_TO_FOLDER': {
          // 本地锁由 syncLockManager 统一管理
          setIsSyncing(true)
          
          try {
            // 获取当前文件夹以正确递增同步版本
            const currentFolder = await db.folders.get(action.payload.folderId)
            const currentSyncVersion = currentFolder?.syncVersion || 0
            
            const updates = {
              // 这里需要更新卡片引用，暂时简化处理
              userId,
              userType: authService.getUserType(),
              updatedAt: new Date(),
              syncVersion: currentSyncVersion + 1,
              pendingSync: true
            }

            console.log('📁 Moving cards to folder:', { folderId: action.payload.folderId })
            
            // 先完成本地数据库操作
            await db.folders.update(action.payload.folderId, updates)
            console.log('✅ Folder updated for card move in local database')
            
            // 同步作为独立后台操作
            try {
              await cloudSyncService.queueOperation({
                type: 'update',
                table: 'folders',
                data: updates,
                localId: action.payload.folderId
              })
              console.log('🔄 Folder card move sync operation queued')
            } catch (syncError) {
              console.warn('⚠️ Failed to queue folder card move sync operation:', syncError)
              // 显示同步失败提示但不影响本地操作
              toast({
                title: "云端同步失败",
                description: "卡片移动已更新，但同步到云端失败。请检查网络连接。",
                variant: "destructive"
              })
            }
            
            await safeLoadFolders(true, true)
          } finally {
            // 释放本地锁
            syncLockManager.releaseLocalLock()
            setIsSyncing(false)
          }
          break
        }

        default:
          console.warn('Unknown folder action:', action)
      }
    } catch (error) {
      console.error('Folder operation failed:', error)
      throw error
    }
  }, [safeLoadFolders])

  // 工具函数
  const getFolderById = useCallback((id: string) => {
    return folders.find(folder => folder.id === id)
  }, [folders])

  const getSelectedFolders = useCallback(() => {
    return folders.filter(folder => selectedFolderIds.includes(folder.id))
  }, [folders, selectedFolderIds])

  const getFolderHierarchy = useCallback(() => {
    console.log('📊 Building folder hierarchy:', {
      totalFolders: folders.length,
      folders: folders.map(f => ({ id: f.id, name: f.name, parentId: f.parentId }))
    })
    
    const buildHierarchy = (parentId: string | null = null): Folder[] => {
      const filtered = folders.filter(folder => folder.parentId === parentId)
      console.log(`📂 Building hierarchy for parentId ${parentId}:`, {
        foundFolders: filtered.length,
        folderNames: filtered.map(f => f.name)
      })
      
      return filtered.map(folder => ({
        ...folder,
        children: buildHierarchy(folder.id)
      }))
    }
    
    const result = buildHierarchy()
    console.log('📊 Final folder hierarchy:', result)
    return result
  }, [folders])

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
    folderTree: getFolderHierarchy(),
    filter,
    setFilter,
    selectedFolderIds,
    isLoading,
    isSyncing,
    dispatch,
    getFolderById,
    getSelectedFolders,
    getFolderHierarchy,
    getRootFolders,
    getChildFolders,
    getFolderCardCount,
    loadFolders,
    safeLoadFolders
  }
}