import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ConflictBase,
  CardConflict,
  FolderConflict,
  TagConflict,
  ConflictResolution,
  ConflictSuggestion,
  ConflictStats,
  ConflictStatus,
  ConflictSeverity
} from '@/types/conflict'
import { ConflictResolutionEngine } from '@/utils/conflict-resolution'
import { unifiedSyncService } from '@/services/core/sync/unified-sync.service'
import type {
  UnifiedConflict,
  ConflictResolution as UnifiedConflictResolution,
  ConflictEngineMetrics
} from '@/services/sync/conflict-resolution-engine/unified-conflict-resolution-engine'

export function useConflicts() {
  const [conflicts, setConflicts] = useState<(CardConflict | FolderConflict | TagConflict)[]>([])
  const [selectedConflict, setSelectedConflict] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<ConflictEngineMetrics | null>(null)
  const [syncStatus, setSyncStatus] = useState<any>(null)

  const statsRef = useRef<ConflictStats>({
    totalConflicts: 0,
    resolvedConflicts: 0,
    pendingConflicts: 0,
    conflictsByType: {} as any,
    conflictsBySeverity: {} as any,
    averageResolutionTime: 0
  })

  // 计算冲突统计
  useEffect(() => {
    const newStats: ConflictStats = {
      totalConflicts: conflicts.length,
      resolvedConflicts: conflicts.filter(c => c.status === 'resolved').length,
      pendingConflicts: conflicts.filter(c => c.status === 'pending').length,
      conflictsByType: {} as any,
      conflictsBySeverity: {} as any,
      averageResolutionTime: calculateAverageResolutionTime()
    }

    // 按类型统计
    conflicts.forEach(conflict => {
      newStats.conflictsByType[conflict.type] = (newStats.conflictsByType[conflict.type] || 0) + 1
      newStats.conflictsBySeverity[conflict.severity] = (newStats.conflictsBySeverity[conflict.severity] || 0) + 1
    })

    statsRef.current = newStats
  }, [conflicts])

  // 初始化冲突管理
  useEffect(() => {
    initializeConflictManagement()

    // 监听同步状态变化
    const syncInterval = setInterval(() => {
      updateSyncStatus()
    }, 5000) // 每5秒更新同步状态

    return () => {
      clearInterval(syncInterval)
    }
  }, [])

  // 初始化冲突管理
  const initializeConflictManagement = async () => {
    setIsLoading(true)
    try {
      // 从统一同步服务获取冲突
      await loadConflictsFromService()
      await updateSyncStatus()
      setError(null)
    } catch (err) {
      console.error('Failed to initialize conflict management:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  // 从服务加载冲突
  const loadConflictsFromService = async () => {
    try {
      // 获取统一同步服务的冲突
      const syncConflicts = unifiedSyncService.getConflicts()

      // 转换为前端冲突格式
      const convertedConflicts = convertSyncConflictsToUIConflicts(syncConflicts)

      setConflicts(convertedConflicts)
      return convertedConflicts
    } catch (err) {
      console.error('Failed to load conflicts from service:', err)
      // 如果服务失败，返回空数组而不是错误
      return []
    }
  }

  // 转换同步服务冲突到UI冲突格式
  const convertSyncConflictsToUIConflicts = (syncConflicts: any[]): (CardConflict | FolderConflict | TagConflict)[] => {
    return syncConflicts.map(syncConflict => {
      const baseConflict: ConflictBase = {
        id: syncConflict.id,
        type: mapConflictType(syncConflict.conflictType),
        entityType: syncConflict.entityType,
        entityId: syncConflict.entityId,
        timestamp: syncConflict.detectedAt || new Date(),
        sourceDevice: syncConflict.sourceDevice || 'Unknown',
        severity: syncConflict.severity,
        status: mapConflictStatus(syncConflict.status),
        createdAt: syncConflict.detectedAt || new Date(),
        resolvedAt: syncConflict.resolvedAt,
        resolvedBy: syncConflict.resolvedBy,
        resolution: syncConflict.resolution ? mapConflictResolution(syncConflict.resolution) : undefined
      }

      switch (syncConflict.entityType) {
        case 'card':
          return {
            ...baseConflict,
            type: 'card_content',
            localVersion: syncConflict.localData,
            remoteVersion: syncConflict.cloudData,
            conflictFields: syncConflict.conflictFields || [],
            suggestions: syncConflict.suggestions?.map((s: any) => ({
              type: s.type,
              confidence: s.confidence,
              reason: s.reasoning || s.reason,
              preview: s.preview
            }))
          } as CardConflict

        case 'folder':
          return {
            ...baseConflict,
            type: 'folder_name',
            localVersion: syncConflict.localData,
            remoteVersion: syncConflict.cloudData,
            affectedCards: syncConflict.conflictDetails?.affectedEntities || []
          } as FolderConflict

        case 'tag':
          return {
            ...baseConflict,
            type: 'tag_rename',
            localVersion: syncConflict.localData,
            remoteVersion: syncConflict.cloudData,
            affectedCards: syncConflict.conflictDetails?.affectedEntities || []
          } as TagConflict

        default:
          throw new Error(`Unknown entity type: ${syncConflict.entityType}`)
      }
    })
  }

  // 映射冲突类型
  const mapConflictType = (syncType: string) => {
    const typeMap: Record<string, any> = {
      'content': 'card_content',
      'version': 'card_content',
      'structure': 'folder_structure',
      'delete': 'tag_delete',
      'field': 'card_content'
    }
    return typeMap[syncType] || 'card_content'
  }

  // 映射冲突状态
  const mapConflictStatus = (syncStatus: string): ConflictStatus => {
    const statusMap: Record<string, ConflictStatus> = {
      'pending': 'pending',
      'resolving': 'reviewing',
      'resolved': 'resolved',
      'manual_required': 'pending'
    }
    return statusMap[syncStatus] || 'pending'
  }

  // 映射冲突解决方式
  const mapConflictResolution = (syncResolution: any): ConflictResolution => {
    return {
      type: syncResolution.type,
      mergedData: syncResolution.mergedData,
      reason: syncResolution.reasoning,
      manualChanges: syncResolution.manualChanges
    }
  }

  // 计算平均解决时间
  const calculateAverageResolutionTime = (): number => {
    const resolvedConflicts = conflicts.filter(c => c.status === 'resolved' && c.resolvedAt)
    if (resolvedConflicts.length === 0) return 0

    const totalTime = resolvedConflicts.reduce((sum, conflict) => {
      return sum + (conflict.resolvedAt!.getTime() - conflict.createdAt.getTime())
    }, 0)

    return totalTime / resolvedConflicts.length
  }

  // 更新同步状态
  const updateSyncStatus = async () => {
    try {
      const status = unifiedSyncService.getStatus()
      setSyncStatus(status)

      // 自动检测新冲突
      if (status.isSyncing === false && status.networkStatus?.online) {
        await detectNewConflicts()
      }
    } catch (err) {
      console.error('Failed to update sync status:', err)
    }
  }

  // 检测新冲突
  const detectNewConflicts = async () => {
    try {
      const currentConflicts = await loadConflictsFromService()
      const newConflicts = currentConflicts.filter(c => c.status === 'pending')

      // 如果有新的冲突，触发事件或更新UI
      if (newConflicts.length > conflicts.filter(c => c.status === 'pending').length) {
        setConflicts(currentConflicts)
        // 这里可以触发通知
      }
    } catch (err) {
      console.error('Failed to detect new conflicts:', err)
    }
  }

  // 获取冲突详情
  const getConflictById = useCallback((id: string) => {
    return conflicts.find(c => c.id === id)
  }, [conflicts])

  // 获取待解决的冲突
  const getPendingConflicts = useCallback(() => {
    return conflicts.filter(c => c.status === 'pending')
  }, [conflicts])

  // 获取高优先级冲突
  const getHighPriorityConflicts = useCallback(() => {
    return conflicts.filter(c => c.severity === 'high' || c.severity === 'critical')
  }, [conflicts])

  // 获取统计信息
  const getStats = useCallback(() => {
    return { ...statsRef.current }
  }, [])

  // 解决冲突
  const resolveConflict = useCallback(async (conflictId: string, resolution: ConflictResolution) => {
    setIsResolving(true)
    setError(null)

    try {
      // 调用统一同步服务解决冲突
      const success = await unifiedSyncService.resolveConflict(
        conflictId,
        resolution.type as 'local' | 'cloud' | 'merge',
        resolution.mergedData
      )

      if (success) {
        // 更新本地状态
        setConflicts(prev => prev.map(conflict =>
          conflict.id === conflictId
            ? {
                ...conflict,
                status: 'resolved' as ConflictStatus,
                resolvedAt: new Date(),
                resolvedBy: 'user',
                resolution
              }
            : conflict
        ))

        setSelectedConflict(null)

        // 刷新同步状态
        await updateSyncStatus()

        return true
      } else {
        throw new Error('Failed to resolve conflict via sync service')
      }
    } catch (err) {
      console.error('Failed to resolve conflict:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    } finally {
      setIsResolving(false)
    }
  }, [])

  // 忽略冲突
  const ignoreConflict = useCallback(async (conflictId: string) => {
    try {
      // 在同步服务中标记为忽略
      const conflict = conflicts.find(c => c.id === conflictId)
      if (!conflict) return

      // 这里可以调用服务API来忽略冲突
      // 目前先更新本地状态
      setConflicts(prev => prev.map(conflict =>
        conflict.id === conflictId
          ? { ...conflict, status: 'ignored' as ConflictStatus }
          : conflict
      ))

      setSelectedConflict(null)
    } catch (err) {
      console.error('Failed to ignore conflict:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [conflicts])

  // 批量解决冲突
  const batchResolveConflicts = useCallback(async (conflictIds: string[], resolution: ConflictResolution) => {
    setIsResolving(true)
    setError(null)

    try {
      // 批量解决冲突
      const results = await Promise.allSettled(
        conflictIds.map(conflictId =>
          unifiedSyncService.resolveConflict(
            conflictId,
            resolution.type as 'local' | 'cloud' | 'merge',
            resolution.mergedData
          )
        )
      )

      const successfulResolves = results.filter(r => r.status === 'fulfilled').length
      const failedResolves = results.filter(r => r.status === 'rejected').length

      if (successfulResolves > 0) {
        // 更新本地状态
        setConflicts(prev => prev.map(conflict =>
          conflictIds.includes(conflict.id)
            ? {
                ...conflict,
                status: 'resolved' as ConflictStatus,
                resolvedAt: new Date(),
                resolvedBy: 'user',
                resolution
              }
            : conflict
        ))
      }

      if (failedResolves > 0) {
        throw new Error(`${failedResolves} conflicts failed to resolve`)
      }

      // 刷新同步状态
      await updateSyncStatus()

      return true
    } catch (err) {
      console.error('Failed to batch resolve conflicts:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    } finally {
      setIsResolving(false)
    }
  }, [])

  // 获取冲突解决建议
  const getSuggestions = useCallback((conflictId: string): ConflictSuggestion[] => {
    const conflict = getConflictById(conflictId)
    if (!conflict) return []

    // 使用智能冲突解决引擎生成建议
    const engineSuggestions = ConflictResolutionEngine.generateSuggestions(conflict)

    // 添加基于同步服务的建议
    const syncSuggestions = unifiedSyncService.getConflict(conflictId)?.suggestions || []

    // 合并并去重建议
    const allSuggestions = [...engineSuggestions, ...syncSuggestions.map((s: any) => ({
      type: s.type,
      confidence: s.confidence,
      reason: s.reasoning || s.reason,
      preview: s.preview
    }))]

    // 按置信度排序
    return allSuggestions.sort((a, b) => b.confidence - a.confidence)
  }, [getConflictById])

  // 检测新冲突
  const detectConflicts = useCallback(async () => {
    setIsLoading(true)
    try {
      // 执行同步以检测新冲突
      const syncResult = await unifiedSyncService.sync({
        type: 'incremental',
        direction: 'bidirectional'
      })

      // 加载更新后的冲突
      const updatedConflicts = await loadConflictsFromService()
      const newConflicts = updatedConflicts.filter(c => c.status === 'pending')

      setConflicts(updatedConflicts)

      return newConflicts
    } catch (err) {
      console.error('Failed to detect conflicts:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 自动解决冲突
  const autoResolveConflicts = useCallback(async (): Promise<number> => {
    setIsResolving(true)
    try {
      const resolvedCount = await unifiedSyncService.autoResolveConflicts()

      // 刷新冲突列表
      await loadConflictsFromService()
      await updateSyncStatus()

      return resolvedCount
    } catch (err) {
      console.error('Failed to auto-resolve conflicts:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      return 0
    } finally {
      setIsResolving(false)
    }
  }, [])

  // 获取冲突详情（完整信息）
  const getConflictDetails = useCallback(async (conflictId: string) => {
    try {
      const conflict = getConflictById(conflictId)
      if (!conflict) return null

      // 获取同步服务中的详细信息
      const syncConflict = unifiedSyncService.getConflict(conflictId)

      return {
        ...conflict,
        syncDetails: syncConflict,
        suggestions: getSuggestions(conflictId)
      }
    } catch (err) {
      console.error('Failed to get conflict details:', err)
      return null
    }
  }, [getConflictById, getSuggestions])

  // 刷新冲突列表
  const refreshConflicts = useCallback(async () => {
    setIsLoading(true)
    try {
      await loadConflictsFromService()
      await updateSyncStatus()
      setError(null)
    } catch (err) {
      console.error('Failed to refresh conflicts:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 清除错误
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    // 状态
    conflicts,
    selectedConflict,
    setSelectedConflict,
    isResolving,
    isLoading,
    error,
    syncStatus,
    metrics,
    stats: { ...statsRef.current },

    // 方法
    getConflictById,
    getPendingConflicts,
    getHighPriorityConflicts,
    getStats,
    resolveConflict,
    ignoreConflict,
    batchResolveConflicts,
    getSuggestions,
    detectConflicts,
    autoResolveConflicts,
    getConflictDetails,
    refreshConflicts,
    clearError
  }
}