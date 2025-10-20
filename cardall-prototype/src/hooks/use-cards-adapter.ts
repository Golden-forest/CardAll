import { useCards } from './use-cards'
import { useCardsDb } from './use-cards-db'
import { DataMigrationService } from '@/services/data-migration.service'
import { UniversalStorageAdapter } from '@/services/universal-storage-adapter'
import { CardAllProviderAdapter } from '@/services/cardall-provider-adapter'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { AppConfig } from '@/config/app-config'

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
          }
        } catch (error) {
        }
      }
    }

    // 2. 检查localStorage数据
    let hasLocalStorageData = false
    let localStorageDataCount = 0

    try {
      const localStorageCards = localStorage.getItem('cards')
      if (localStorageCards) {
        const parsedCards = JSON.parse(localStorageCards)
        if (Array.isArray(parsedCards) && parsedCards.length > 0) {
          hasLocalStorageData = true
          localStorageDataCount = parsedCards.length
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
          }
        }
      }
    } catch (error) {
    }

    // 3. 智能选择逻辑
    if (!indexedDbAvailable) {
      return 'localStorage'
    }

    if (hasIndexedDbData && !hasLocalStorageData) {
      return 'indexeddb'
    }

    if (!hasIndexedDbData && hasLocalStorageData) {
      return 'localStorage'
    }

    if (hasIndexedDbData && hasLocalStorageData) {
      // 两个存储都有数据，选择数据量更多的
      if (indexedDbDataCount > localStorageDataCount) {
        return 'indexeddb'
      } else if (localStorageDataCount > indexedDbDataCount) {
        return 'localStorage'
      } else {
        // 数据量相同，优先使用IndexedDB（更现代化）
        return 'indexeddb'
      }
    }

    // 4. 都没有数据，检查用户偏好设置
    try {
      const userPreference = localStorage.getItem('preferredStorageMode')
      if (userPreference === 'indexeddb' && indexedDbAvailable) {
        return 'indexeddb'
      } else if (userPreference === 'localStorage') {
        return 'localStorage'
      }
    } catch (error) {
    }

    // 5. 默认策略：如果IndexedDB可用，优先使用IndexedDB
    if (indexedDbAvailable) {
      return 'indexeddb'
    }

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