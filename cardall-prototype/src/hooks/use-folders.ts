import { useState, useCallback, useEffect } from 'react'
import { Folder, FolderAction } from '@/types/card'
import { secureStorage } from '@/utils/secure-storage'
import { db } from '@/services/database'

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
  // 使用状态初始化函数，避免每次渲染都创建空数组
  const [folders, setFolders] = useState<Folder[]>(() => {
    // 尝试从localStorage加载上次的状态作为初始值
    try {
      const savedFolders = secureStorage.get<Folder[]>('folders_state_backup', {
        validate: true,
        encrypt: true
      })
      return savedFolders || []
    } catch {
      return []
    }
  })
  const [isInitialized, setIsInitialized] = useState<boolean>(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [isConsistent, setIsConsistent] = useState<boolean>(true)

  // Get folder tree structure
  const getFolderTree = useCallback(() => {
    const rootFolders = folders.filter(folder => !folder.parentId)

    const buildTree = (parentFolders: Folder[]): (Folder & { children: Folder[] })[] => {
      return parentFolders.map(folder => {
        // 确保文件夹有正确的展开状态
        const children = buildTree(folders.filter(f => f.parentId === folder.id))
        const hasChildren = children.length > 0

        // 如果有子文件夹但展开状态未定义，默认展开
        const isExpanded = folder.isExpanded !== undefined ? folder.isExpanded : (hasChildren ? true : false)

        return {
          ...folder,
          isExpanded,
          children
        }
      })
    }

    return buildTree(rootFolders)
  }, [folders])

  // Folder actions with enhanced error handling and logging
  const dispatch = useCallback((action: FolderAction) => {
    console.log('🎯 Folder Action dispatched:', action.type, action.payload)

    setFolders(prevFolders => {
      try {
        switch (action.type) {
          case 'CREATE_FOLDER':
            console.log('➕ Creating new folder...')
            const newFolder: Folder = {
              ...action.payload,
              id: `folder-${Date.now()}`,
              cardIds: [],
              createdAt: new Date(),
              updatedAt: new Date()
            }
            console.log('✅ New folder created:', newFolder.id, newFolder.name)
            return [...prevFolders, newFolder]

          case 'UPDATE_FOLDER':
            console.log('📝 Updating folder:', action.payload.id)
            const updatedFolders = prevFolders.map(folder =>
              folder.id === action.payload.id
                ? {
                    ...folder,
                    ...action.payload.updates,
                    updatedAt: new Date()
                  }
                : folder
            )
            console.log('✅ Folder updated:', action.payload.id)
            return updatedFolders

          case 'DELETE_FOLDER':
            console.log('🗑️ Deleting folder:', action.payload)
            const folderToDelete = prevFolders.find(f => f.id === action.payload)
            if (folderToDelete) {
              // Get all child folders recursively
              const getAllChildFolders = (parentId: string): string[] => {
                const children = prevFolders.filter(f => f.parentId === parentId)
                const childIds = children.map(f => f.id)
                const grandChildIds = children.flatMap(child => getAllChildFolders(child.id))
                return [...childIds, ...grandChildIds]
              }

              const allChildFolderIds = getAllChildFolders(action.payload)
              const allFoldersToDelete = [action.payload, ...allChildFolderIds]

              // Get all card IDs from folders to be deleted
              const allCardIdsToDelete = prevFolders
                .filter(folder => allFoldersToDelete.includes(folder.id))
                .flatMap(folder => folder.cardIds)

              console.log('📋 Folders to delete:', allFoldersToDelete.length)
              console.log('📋 Cards to delete:', allCardIdsToDelete.length)

              // Trigger card deletion through callback if provided
              if ('onDeleteCards' in action && action.onDeleteCards && allCardIdsToDelete.length > 0) {
                console.log('🔄 Triggering card deletion callback...')
                action.onDeleteCards(allCardIdsToDelete)
              }

              const remainingFolders = prevFolders.filter(folder => !allFoldersToDelete.includes(folder.id))
              console.log('✅ Folder deleted successfully. Remaining folders:', remainingFolders.length)
              return remainingFolders
            }
            console.warn('⚠️ Folder to delete not found:', action.payload)
            return prevFolders.filter(folder => folder.id !== action.payload)

          case 'TOGGLE_FOLDER':
            console.log('🔄 Toggling folder expansion:', action.payload)
            const toggledFolders = prevFolders.map(folder =>
              folder.id === action.payload
                ? {
                    ...folder,
                    isExpanded: folder.isExpanded !== undefined ? !folder.isExpanded : true,
                    updatedAt: new Date(),
                    syncVersion: (folder.syncVersion || 1) + 1,
                    pendingSync: true
                  }
                : folder
            )
            console.log('✅ Folder toggled:', action.payload)
            return toggledFolders

          default:
            console.warn('⚠️ Unknown folder action:', action.type)
            return prevFolders
        }
      } catch (error) {
        console.error('❌ Error in folder dispatch:', error)
        return prevFolders // Return previous state on error
      }
    })

    // 云端同步功能已删除，仅本地操作
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
      currentParent = parentFolder?.parentId ?? null
    }

    return true
  }, [getFolderById])

  // 优化的数据一致性检查，减少不必要的修复操作
  const checkDataConsistency = useCallback(async () => {
    try {
      // 只有在有数据时才检查一致性
      if (folders.length === 0) {
        console.log('📋 没有文件夹数据，跳过一致性检查')
        setIsConsistent(true)
        return true
      }

      console.log('🔍 开始检查文件夹数据一致性...')

      // 检查IndexedDB中的数据
      const dbFolders = await db.folders.toArray()
      const dbFolderIds = new Set(dbFolders.map(f => f.id))
      const currentFolderIds = new Set(folders.map(f => f.id))

      console.log('📊 数据统计:')
      console.log('  - 内存中文件夹:', folders.length)
      console.log('  - IndexedDB中文件夹:', dbFolders.length)

      let isDataConsistent = true

      // 检查数据完整性（但允许短暂的不一致）
      if (folders.length > 0 && dbFolders.length === 0) {
        console.warn('⚠️ 内存中有数据但IndexedDB为空，可能正在同步中')
        // 不立即标记为不一致，等待后续同步
      }

      const missingInDb = folders.filter(f => !dbFolderIds.has(f.id))
      const extraInDb = dbFolders.filter(f => !currentFolderIds.has(f.id))

      // 只有在差异较大时才标记为不一致
      if (missingInDb.length > 0) {
        console.warn('❌ 发现IndexedDB中缺失的文件夹:', missingInDb.map(f => f.id))
        isDataConsistent = false
      }

      // 对于多余的数据，如果不是很多，可能是正常的删除操作
      if (extraInDb.length > 0 && extraInDb.length > 3) {
        console.warn('⚠️ 发现IndexedDB中多余的文件夹:', extraInDb.map(f => f.id))
        isDataConsistent = false
      }

      // 检查同步字段完整性（仅在数据不为空时）
      if (folders.length > 0) {
        const foldersWithoutSync = folders.filter(f => !f.syncVersion || f.pendingSync === undefined)
        if (foldersWithoutSync.length > 0) {
          console.warn('⚠️ 发现缺少同步字段的文件夹:', foldersWithoutSync.map(f => f.id))
          // 仅在确实需要时才自动修复同步字段
          const repairedFolders = folders.map(folder => ({
            ...folder,
            syncVersion: folder.syncVersion || 1,
            pendingSync: folder.pendingSync || false,
            userId: folder.userId || 'default'
          }))
          // 只在确实有变化时才更新状态
          if (JSON.stringify(repairedFolders) !== JSON.stringify(folders)) {
            setFolders(repairedFolders)
            console.log('✅ 自动修复同步字段完成')
          }
        }
      }

      // 检查是否有需要恢复的数据（谨慎处理）
      const needsRestore = secureStorage.get<boolean>('folder_data_needs_restore', {
        validate: true
      })

      if (needsRestore && folders.length === 0) {
        console.log('🔄 发现需要恢复的文件夹数据，且当前无数据')
        const backupFolders = secureStorage.get<Folder[]>('folders_backup', {
          validate: true,
          encrypt: true
        })

        if (backupFolders && backupFolders.length > 0) {
          console.log('💾 从备份恢复文件夹数据:', backupFolders.length)
          setFolders(backupFolders)

          // 清理恢复标记
          secureStorage.remove('folder_data_needs_restore')
          secureStorage.remove('folders_backup')

          // 重新保存到IndexedDB
          try {
            await db.folders.clear()
            await db.folders.bulkAdd(backupFolders)
            console.log('✅ 恢复的文件夹数据已保存到IndexedDB')
            isDataConsistent = true
          } catch (error) {
            console.error('❌ 恢复数据保存失败:', error)
          }
        }
      }

      setIsConsistent(isDataConsistent)
      console.log('🎯 文件夹数据一致性检查完成:', isDataConsistent ? '✅ 一致' : '❌ 不一致')

      return isDataConsistent
    } catch (error) {
      console.error('❌ 数据一致性检查失败:', error)
      setIsConsistent(false)
      return false
    }
  }, [folders])

  // 强制数据修复
  const forceDataRepair = useCallback(async () => {
    try {
      console.log('开始强制修复文件夹数据...')

      // 1. 备份当前数据
      secureStorage.set('folders_repair_backup', folders, {
        validate: true,
        encrypt: true
      })

      // 2. 清空IndexedDB
      await db.folders.clear()

      // 3. 重新保存当前数据
      await db.folders.bulkAdd(folders)

      // 4. 清理所有临时标记
      secureStorage.remove('folder_data_needs_restore')
      secureStorage.remove('folders_backup')

      // 5. 标记迁移完成
      secureStorage.set('folder_migration_complete', true, {
        validate: true
      })

      console.log('文件夹数据强制修复完成')
      setIsConsistent(true)

      return true
    } catch (error) {
      console.error('强制修复文件夹数据失败:', error)
      return false
    }
  }, [folders])

  // 修复的数据加载逻辑，仅在组件挂载时执行一次
  useEffect(() => {
    const loadFolders = async () => {
      // 如果已经初始化过，跳过加载
      if (isInitialized) {
        console.log('📁 文件夹数据已初始化，跳过加载')
        return
      }

      try {
        console.log('🔄 开始加载文件夹数据...')

        let foldersToLoad: Folder[] = []

        // 优先使用内存中的数据（如果有）
        if (folders.length > 0) {
          console.log('📋 使用内存中的文件夹数据:', folders.length)
          foldersToLoad = folders
        } else {
          // 尝试从 IndexedDB 加载数据
          try {
            const dbFolders = await db.folders.toArray()
            console.log('📊 从 IndexedDB 查找到文件夹:', dbFolders.length)

            if (dbFolders.length > 0) {
              // 确保数据格式正确，添加默认同步字段和展开状态
              foldersToLoad = dbFolders.map(folder => {
                const children = dbFolders.filter(f => f.parentId === folder.id)
                const hasChildren = children.length > 0

                return {
                  ...folder,
                  cardIds: folder.cardIds || [],
                  syncVersion: folder.syncVersion || 1,
                  pendingSync: folder.pendingSync || false,
                  userId: folder.userId || 'default',
                  isExpanded: folder.isExpanded !== undefined ? folder.isExpanded : (hasChildren ? true : false)
                }
              })
              console.log('✅ 使用 IndexedDB 中的文件夹数据')

              // 立即更新状态，不等待同步完成
              setFolders(foldersToLoad)
            } else {
              // 检查是否有迁移标记，避免重复初始化默认数据
              const migrationComplete = secureStorage.get<boolean>('folder_migration_complete', {
                validate: true
              })

              if (migrationComplete) {
                console.log('🔄 迁移已完成但无数据，可能数据被清空，保持空状态')
                setIsInitialized(true)
                return
              }

              // 首次使用，初始化默认数据
              console.log('🎯 首次使用，初始化默认文件夹数据')
              foldersToLoad = mockFolders.map(folder => ({
                ...folder,
                syncVersion: 1,
                pendingSync: false,
                userId: 'default',
                isExpanded: folder.isExpanded !== undefined ? folder.isExpanded : true
              }))

              // 保存默认数据到 IndexedDB
              await db.folders.clear()
              await db.folders.bulkAdd(foldersToLoad)

              // 标记初始化完成
              secureStorage.set('folder_migration_complete', true, {
                validate: true
              })

              console.log('✅ 默认文件夹数据已保存到 IndexedDB')
              setFolders(foldersToLoad)
            }
          } catch (dbError) {
            console.error('❌ 从 IndexedDB 加载失败:', dbError)

            // 如果IndexedDB加载失败，尝试从localStorage恢复
            try {
              const backupFolders = secureStorage.get<Folder[]>('folders_state_backup', {
                validate: true,
                encrypt: true
              })

              if (backupFolders && backupFolders.length > 0) {
                console.log('💾 从localStorage备份恢复文件夹数据:', backupFolders.length)
                foldersToLoad = backupFolders.map(folder => ({
                  ...folder,
                  isExpanded: folder.isExpanded !== undefined ? folder.isExpanded : true
                }))
                setFolders(foldersToLoad)
              } else {
                // 只有在完全没有数据时才使用默认数据
                foldersToLoad = mockFolders.map(folder => ({
                  ...folder,
                  syncVersion: 1,
                  pendingSync: false,
                  userId: 'default',
                  isExpanded: folder.isExpanded !== undefined ? folder.isExpanded : true
                }))
                console.log('🚨 使用默认文件夹数据作为应急方案')
                setFolders(foldersToLoad)
              }
            } catch (backupError) {
              console.error('❌ 从备份恢复失败:', backupError)
              // 最后的应急方案
              foldersToLoad = mockFolders.map(folder => ({
                ...folder,
                syncVersion: 1,
                pendingSync: false,
                userId: 'default',
                isExpanded: folder.isExpanded !== undefined ? folder.isExpanded : true
              }))
              setFolders(foldersToLoad)
            }
          }
        }

        setIsInitialized(true)
        console.log('🎉 文件夹数据加载完成，共', foldersToLoad.length, '个文件夹')

        // 在后台进行数据验证，不阻塞UI
        setTimeout(async () => {
          try {
            // 验证数据一致性
            const isConsistent = await checkDataConsistency()
            if (!isConsistent) {
              console.warn('⚠️ 数据一致性检查失败，尝试修复...')
              await forceDataRepair()
            }

            // 解耦的同步服务会在后台自动处理同步
            // 不需要在这里手动触发同步
            console.log('📁 文件夹数据加载完成，解耦同步服务将自动处理云端同步')
          } catch (error) {
            console.error('❌ 后台数据处理失败:', error)
            // 处理失败不影响已加载的数据显示
          }
        }, 1000)

      } catch (error) {
        console.error('❌ 加载文件夹数据失败:', error)
        setIsInitialized(true)
      }
    }

    loadFolders()
  }, [isInitialized]) // 只依赖 isInitialized，避免重复加载

  // 修复的数据保存机制，防止意外覆盖和频繁保存
  useEffect(() => {
    // 如果还没有完成初始化，跳过保存操作
    if (!isInitialized) {
      console.log('⏳ 数据初始化未完成，跳过保存操作')
      return
    }

    // 如果没有数据变化，跳过保存操作
    if (folders.length === 0) {
      console.log('📋 没有文件夹数据，跳过保存操作')
      return
    }

    const saveFolders = async () => {
      try {
        console.log('💾 开始保存文件夹数据到IndexedDB...')

        // 先检查 IndexedDB 中是否已有数据，避免意外覆盖
        const existingFolders = await db.folders.toArray()
        const existingIds = new Set(existingFolders.map(f => f.id))
        const currentIds = new Set(folders.map(f => f.id))

        // 如果 IndexedDB 中有数据但当前没有数据，可能是数据被意外清空，不执行保存
        if (existingFolders.length > 0 && folders.length === 0) {
          console.warn('⚠️ 检测到数据可能被清空，跳过保存以避免覆盖')
          return
        }

        // 确保所有文件夹都有必要的同步字段和展开状态
        const normalizedFolders = folders.map(folder => {
          const children = folders.filter(f => f.parentId === folder.id)
          const hasChildren = children.length > 0

          return {
            ...folder,
            syncVersion: folder.syncVersion || 1,
            pendingSync: folder.pendingSync || false,
            userId: folder.userId || 'default',
            isExpanded: folder.isExpanded !== undefined ? folder.isExpanded : (hasChildren ? true : false),
            updatedAt: new Date() // 确保更新时间正确
          }
        })

        // 使用事务确保数据一致性
        await db.transaction('rw', db.folders, async () => {
          // 只有在当前数据与现有数据不同时才执行删除操作
          if (currentIds.size > 0) {
            // 删除已不存在的文件夹
            const foldersToDelete = existingFolders.filter(f => !currentIds.has(f.id))
            if (foldersToDelete.length > 0) {
              await db.folders.bulkDelete(foldersToDelete.map(f => f.id!))
              console.log('🗑️ 删除已不存在的文件夹:', foldersToDelete.length)
            }
          }

          // 更新现有文件夹
          const foldersToUpdate = normalizedFolders.filter(f => existingIds.has(f.id))
          for (const folder of foldersToUpdate) {
            await db.folders.update(folder.id, folder)
          }
          console.log('📝 更新现有文件夹:', foldersToUpdate.length)

          // 添加新文件夹
          const foldersToAdd = normalizedFolders.filter(f => !existingIds.has(f.id))
          if (foldersToAdd.length > 0) {
            await db.folders.bulkAdd(foldersToAdd)
            console.log('➕ 添加新文件夹:', foldersToAdd.length)
          }
        })

        // 保存到localStorage作为备份，用于快速恢复
        try {
          secureStorage.set('folders_state_backup', folders, {
            validate: true,
            encrypt: true
          })
          console.log('💾 文件夹状态已备份到localStorage')
        } catch (backupError) {
          console.warn('⚠️ 备份到localStorage失败:', backupError)
        }

        console.log('✅ 文件夹数据保存成功，共', normalizedFolders.length, '个文件夹')

        // 验证保存结果（仅在保存了数据时）
        setTimeout(async () => {
          try {
            const savedFolders = await db.folders.toArray()
            console.log('🔍 验证保存结果: IndexedDB中现有', savedFolders.length, '个文件夹')

            // 验证保存的数据是否正确
            if (savedFolders.length !== normalizedFolders.length) {
              console.warn('⚠️ 保存的数据数量不匹配')
            }

            const isConsistent = await checkDataConsistency()
            if (!isConsistent) {
              console.warn('⚠️ 保存后数据一致性检查失败')
            }
          } catch (error) {
            console.error('❌ 验证保存结果失败:', error)
          }
        }, 500)

      } catch (error) {
        console.error('❌ 保存文件夹数据到IndexedDB失败:', error)

        // 增强的错误恢复机制
        console.warn('🔄 尝试重新保存文件夹数据...')
        try {
          // 规范化数据后重新保存
          const normalizedFolders = folders.map(folder => {
            const children = folders.filter(f => f.parentId === folder.id)
            const hasChildren = children.length > 0

            return {
              ...folder,
              syncVersion: folder.syncVersion || 1,
              pendingSync: folder.pendingSync || false,
              userId: folder.userId || 'default',
              isExpanded: folder.isExpanded !== undefined ? folder.isExpanded : (hasChildren ? true : false),
              updatedAt: new Date()
            }
          })

          // 先检查是否有现有数据，避免清空
          const existingFolders = await db.folders.toArray()
          if (existingFolders.length > 0 && folders.length > 0) {
            // 如果现有数据不为空，只更新不删除
            for (const folder of normalizedFolders) {
              await db.folders.put(folder)
            }
            console.log('✅ 文件夹数据更新保存成功')
          } else {
            // 只有在确认需要时才清空并重新保存
            await db.folders.clear()
            await db.folders.bulkAdd(normalizedFolders)
            console.log('✅ 文件夹数据重新保存成功')
          }
        } catch (retryError) {
          console.error('❌ 重新保存文件夹数据失败:', retryError)

          // 最后的应急方案：将数据保存到localStorage作为临时备份
          console.warn('💾 将文件夹数据临时保存到localStorage')
          secureStorage.set('folders_backup', folders, {
            validate: true,
            encrypt: true
          })

          // 标记需要手动恢复
          secureStorage.set('folder_data_needs_restore', true, {
            validate: true
          })

          console.error('🚨 文件夹数据保存失败，已创建备份')
        }
      }
    }

    // 防抖保存机制（减少到500ms，提高响应性）
    const saveTimer = setTimeout(saveFolders, 500)
    return () => clearTimeout(saveTimer)
  }, [folders.length, isInitialized, folders]) // 添加folders依赖以捕获内容变化

  // 定期数据一致性检查（每30秒）
  useEffect(() => {
    const consistencyCheckInterval = setInterval(async () => {
      if (isConsistent) {
        await checkDataConsistency()
      }
    }, 30000) // 30秒检查一次

    return () => clearInterval(consistencyCheckInterval)
  }, [isConsistent, checkDataConsistency])

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
    canMoveFolder,
    isConsistent,
    checkDataConsistency,
    forceDataRepair
  }
}