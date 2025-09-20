import { useCards } from './use-cards'
import { useCardsDb } from './use-cards-db'
import { DataMigrationService } from '@/services/data-migration.service'
import { UniversalStorageAdapter } from '@/services/universal-storage-adapter'
import { CardAllProviderAdapter } from '@/services/cardall-provider-adapter'
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

        // 检查IndexedDB数据
        const storageAdapter = new UniversalStorageAdapter()
        const indexedDbAvailable = await storageAdapter.isIndexedDBAvailable()
        const hasIndexedDbData = await storageAdapter.hasIndexedDBData()

        const finalMode = indexedDbAvailable && hasIndexedDbData ? 'indexeddb' : 'localStorage'

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