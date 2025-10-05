import { useCards } from './use-cards'
import { useCardsDb } from './use-cards-db'
import { DataMigrationService } from '@/services/data-migration.service'
import { UniversalStorageAdapter } from '@/services/universal-storage-adapter'
import { CardAllProviderAdapter } from '@/services/cardall-provider-adapter'
import { authService } from '@/services/auth'
import { unifiedSyncSystem } from '@/services/sync-system-integration'
import { useEffect, useState, useCallback } from 'react'

/**
 * Hook 适配器状态
 */
interface AdapterState {
  mode: 'localStorage' | 'indexeddb' | 'migrating'
  isReady: boolean
  migrationProgress?: {
    stage: string
    progress: number
    message: string
  }
}

/**
 * 检查云端数据可用性
 */
async function checkCloudDataAvailability(userId: string): Promise<boolean> {
  try {
    const { supabase } = await import('@/services/supabase')

    // 检查云端卡片数据
    const { data: cards, error } = await supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_deleted', false)

    if (error) {
      console.debug('Cloud data check failed:', error)
      return false
    }

    const cardCount = cards?.length || 0
    console.debug(`Cloud data check result: ${cardCount} cards found for user ${userId}`)

    return cardCount > 0
  } catch (error) {
    console.debug('Failed to check cloud data:', error)
    return false
  }
}

/**
 * 智能确定存储模式
 *
 * 根据数据可用性和完整性智能选择最佳的存储模式
 * 优先选择有数据的存储位置，确保数据不丢失
 */
async function determineStorageMode(): Promise<'localStorage' | 'indexeddb'> {
  const storageAdapter = new UniversalStorageAdapter()

  try {
    // 1. 检查IndexedDB可用性和数据
    const indexedDbAvailable = await storageAdapter.isIndexedDBAvailable()
    let hasIndexedDbData = false
    let indexedDbDataCount = 0

    if (indexedDbAvailable) {
      hasIndexedDbData = await storageAdapter.hasIndexedDBData()

      // 获取IndexedDB中的数据量统计
      if (hasIndexedDbData) {
        try {
          const db = await import('@/services/database').then(m => m.db)
          if (db && db.isOpen()) {
            indexedDbDataCount = await db.cards.count()

            // 检查其他表的数据
            const [folders, tags, images] = await Promise.all([
              db.folders.count().catch(() => 0),
              db.tags.count().catch(() => 0),
              db.images.count().catch(() => 0)
            ])

            indexedDbDataCount += folders + tags + images
            console.debug(`IndexedDB data count: ${indexedDbDataCount} (cards: ${await db.cards.count()}, folders: ${folders}, tags: ${tags}, images: ${images})`)
          }
        } catch (error) {
          console.debug('Failed to get IndexedDB data count:', error)
        }
      }
    }

    // 2. 检查localStorage数据
    let hasLocalStorageData = false
    let localStorageDataCount = 0

    try {
      const localStorageCards = localStorage.getItem('cardall_cards')
      if (localStorageCards) {
        const parsedCards = JSON.parse(localStorageCards)
        // Handle the wrapped data structure
        const cardsData = parsedCards.data || parsedCards
        if (Array.isArray(cardsData) && cardsData.length > 0) {
          hasLocalStorageData = true
          localStorageDataCount = cardsData.length
          console.debug(`localStorage data count: ${localStorageDataCount}`)
        }
      }

      // 检查其他localStorage数据
      const otherKeys = ['folders', 'tags', 'settings']
      for (const key of otherKeys) {
        const data = localStorage.getItem(key)
        if (data) {
          try {
            const parsed = JSON.parse(data)
            if (Array.isArray(parsed) && parsed.length > 0) {
              hasLocalStorageData = true
              localStorageDataCount += parsed.length
            }
          } catch (e) {
            console.debug(`Failed to parse localStorage ${key}:`, e)
          }
        }
      }
    } catch (error) {
      console.debug('Failed to check localStorage data:', error)
    }

    // 3. 检查用户认证状态 - 已认证用户启用云同步模式
    const currentUser = authService.getCurrentUser()
    if (currentUser?.id) {
      if (indexedDbAvailable) {
        // 对于已认证用户，检查云端数据是否存在
        const hasCloudData = await checkCloudDataAvailability(currentUser.id)

        if (hasCloudData && !hasIndexedDbData) {
          // 云端有数据但本地没有，优先从云端同步
          console.debug(`用户 ${currentUser.id} 云端有数据，启动云同步模式`)
          return 'indexeddb' // 仍然使用IndexedDB，但会触发云端同步
        } else if (hasCloudData && hasIndexedDbData) {
          // 云端和本地都有数据，使用智能合并策略
          console.debug(`用户 ${currentUser.id} 云端和本地都有数据，启用智能同步模式`)
          return 'indexeddb'
        } else {
          // 云端无数据，使用本地存储
          console.debug(`用户 ${currentUser.id} 使用本地存储模式`)
          return 'indexeddb'
        }
      } else {
        console.warn(`用户 ${currentUser.id} 已认证但IndexedDB不可用，用户隔离将受限`)
      }
    }

    // 4. 智能选择逻辑
    if (!indexedDbAvailable) {
      console.debug('IndexedDB not available, using localStorage')
      return 'localStorage'
    }

    if (hasIndexedDbData && !hasLocalStorageData) {
      console.debug('Only IndexedDB has data, using IndexedDB')
      return 'indexeddb'
    }

    if (!hasIndexedDbData && hasLocalStorageData) {
      console.debug('Only localStorage has data, using localStorage')
      return 'localStorage'
    }

    if (hasIndexedDbData && hasLocalStorageData) {
      // 两个存储都有数据，选择数据量更多的
      if (indexedDbDataCount > localStorageDataCount) {
        console.debug(`Both have data, IndexedDB has more (${indexedDbDataCount} > ${localStorageDataCount}), using IndexedDB`)
        return 'indexeddb'
      } else if (localStorageDataCount > indexedDbDataCount) {
        console.debug(`Both have data, localStorage has more (${localStorageDataCount} > ${indexedDbDataCount}), using localStorage`)
        return 'localStorage'
      } else {
        // 数据量相同，优先使用IndexedDB（更现代化）
        console.debug('Both have equal data, preferring IndexedDB')
        return 'indexeddb'
      }
    }

    // 4. 都没有数据，检查用户偏好设置
    try {
      const userPreference = localStorage.getItem('preferredStorageMode')
      if (userPreference === 'indexeddb' && indexedDbAvailable) {
        console.debug('User prefers IndexedDB, using IndexedDB')
        return 'indexeddb'
      } else if (userPreference === 'localStorage') {
        console.debug('User prefers localStorage, using localStorage')
        return 'localStorage'
      }
    } catch (error) {
      console.debug('Failed to get user preference:', error)
    }

    // 5. 默认策略：如果IndexedDB可用，优先使用IndexedDB
    if (indexedDbAvailable) {
      console.debug('Default: IndexedDB available, using IndexedDB')
      return 'indexeddb'
    }

    console.debug('Default: using localStorage')
    return 'localStorage'

  } catch (error) {
    console.error('Error determining storage mode:', error)
    // 出错时回退到localStorage
    return 'localStorage'
  }
}

// 导出函数以便测试
export { determineStorageMode }

/**
 * 统一的卡片Hook适配器
 *
 * 这个适配器根据当前状态自动选择使用localStorage或IndexedDB
 * 并处理数据迁移过程
 */
export function useCardsAdapter() {
  const [adapterState, setAdapterState] = useState<AdapterState>({
    mode: 'localStorage',
    isReady: false
  })

  const localStorageData = useCards()
  const indexedDbData = useCardsDb()

  // 初始化适配器
  useEffect(() => {
    const initializeAdapter = async () => {
      try {
        setAdapterState(prev => ({ ...prev, mode: 'migrating', isReady: false }))

        // 检查是否需要迁移
        const migrationService = DataMigrationService.getInstance()
        const needsMigration = await migrationService.needsMigration()

        if (needsMigration) {
          // 执行迁移
          await migrationService.migrate({
            createBackup: true,
            validateData: true,
            cleanupAfterSuccess: true,
            progressCallback: (progress) => {
              setAdapterState(prev => ({
                ...prev,
                migrationProgress: {
                  stage: progress.stage,
                  progress: progress.progress,
                  message: progress.message
                }
              }))
            }
          })
        }

        // 使用智能的存储模式选择
        const finalMode = await determineStorageMode()

        // 初始化云同步服务
        const currentUser = authService.getCurrentUser()
        if (currentUser?.id) {
          console.log(`初始化云同步服务，用户: ${currentUser.id}`)
          await cloudSyncService.initialize()
        }

        setAdapterState({
          mode: finalMode,
          isReady: true
        })

      } catch (error) {
        console.error('Failed to initialize adapter:', error)
        // 迁移失败，回退到localStorage
        setAdapterState({
          mode: 'localStorage',
          isReady: true
        })
      }
    }

    initializeAdapter()
  }, [])

  // 根据当前模式选择数据源
  const currentData = adapterState.mode === 'indexeddb' ? indexedDbData : localStorageData

  // 添加迁移相关的状态和方法
  const retryMigration = useCallback(async () => {
    setAdapterState(prev => ({ ...prev, mode: 'migrating', isReady: false }))

    try {
      const migrationService = DataMigrationService.getInstance()
      const success = await migrationService.migrate({
        createBackup: true,
        validateData: true,
        cleanupAfterSuccess: true,
        progressCallback: (progress) => {
          setAdapterState(prev => ({
            ...prev,
            migrationProgress: {
              stage: progress.stage,
              progress: progress.progress,
              message: progress.message
            }
          }))
        }
      })

      if (success) {
        setAdapterState({
          mode: 'indexeddb',
          isReady: true
        })
      } else {
        setAdapterState({
          mode: 'localStorage',
          isReady: true
        })
      }
    } catch (error) {
      console.error('Migration retry failed:', error)
      setAdapterState({
        mode: 'localStorage',
        isReady: true
      })
    }
  }, [])

  const rollbackMigration = useCallback(async () => {
    try {
      const migrationService = DataMigrationService.getInstance()
      const success = await migrationService.rollback()

      if (success) {
        setAdapterState({
          mode: 'localStorage',
          isReady: true
        })
      }
    } catch (error) {
      console.error('Rollback failed:', error)
    }
  }, [])

  // 云同步功能
  const performCloudSync = useCallback(async () => {
    try {
      const result = await cloudSyncService.performSync()
      console.log('云同步结果:', result)
      return result
    } catch (error) {
      console.error('云同步失败:', error)
      throw error
    }
  }, [])

  const getCloudSyncStatus = useCallback(() => {
    return cloudSyncService.getSyncStatus()
  }, [])

  return {
    // 当前数据源的所有属性和方法
    ...currentData,

    // 适配器状态和方法
    adapterState,
    storageMode: adapterState.mode,
    isReady: adapterState.isReady,
    migrationProgress: adapterState.migrationProgress,
    retryMigration,
    rollbackMigration,

    // 云同步功能
    performCloudSync,
    getCloudSyncStatus,

    // 工具方法
    isUsingLocalStorage: adapterState.mode === 'localStorage',
    isUsingIndexedDB: adapterState.mode === 'indexeddb',
    isMigrating: adapterState.mode === 'migrating'
  }
}

/**
 * 便捷Hook，用于获取适配器状态
 */
export function useStorageAdapter() {
  const adapter = useCardsAdapter()
  return {
    mode: adapter.storageMode,
    isReady: adapter.isReady,
    migrationProgress: adapter.migrationProgress,
    retryMigration: adapter.retryMigration,
    rollbackMigration: adapter.rollbackMigration
  }
}

/**
 * 创建新的卡片Hook，自动处理存储模式
 */
export function useCardsWithAdapter() {
  const adapter = useCardsAdapter()

  // 在迁移过程中，可能需要特殊处理
  if (!adapter.isReady) {
    return {
      ...adapter,
      cards: [],
      allCards: [],
      isLoading: true,
      // 禁用所有操作直到就绪
      dispatch: async () => { throw new Error('System not ready') }
    }
  }

  return adapter
}