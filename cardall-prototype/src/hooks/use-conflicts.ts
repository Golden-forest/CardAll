// ============================================================================
// 冲突解决 Hook
// ============================================================================
// 创建时间：2025-10-06
// 功能：为CardAll项目提供数据冲突检测和解决功能
// ============================================================================

import { useState, useCallback, useEffect } from 'react'

// ============================================================================
// 类型定义
// ============================================================================

export interface Conflict {
  id: string
  type: 'card' | 'folder' | 'tag'
  itemId: string
  localVersion: number
  remoteVersion: number
  localData: any
  remoteData: any
  timestamp: Date
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'resolved' | 'ignored'
  description: string
}

export interface ConflictStats {
  total: number
  pending: number
  resolved: number
  ignored: number
  highPriority: number
  criticalPriority: number
}

export interface ConflictResolution {
  conflictId: string
  action: 'use_local' | 'use_remote' | 'merge' | 'ignore'
  reason?: string
  mergedData?: any
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useConflicts() {
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [selectedConflict, setSelectedConflict] = useState<string | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)

  // 检测冲突
  const detectConflicts = useCallback(async () => {
    setIsDetecting(true)
    
    try {
      // 模拟冲突检测过程
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 在实际应用中，这里会比较本地和远程数据的版本
      // 现在返回空数组，表示没有冲突
      const detectedConflicts: Conflict[] = []
      
      setConflicts(detectedConflicts)
      
    } catch (error) {
      console.error('Conflict detection failed:', error)
    } finally {
      setIsDetecting(false)
    }
  }, [])

  // 获取待解决的冲突
  const getPendingConflicts = useCallback(() => {
    return conflicts.filter(conflict => conflict.status === 'pending')
  }, [conflicts])

  // 获取高优先级冲突
  const getHighPriorityConflicts = useCallback(() => {
    return conflicts.filter(conflict => 
      conflict.status === 'pending' && 
      (conflict.priority === 'high' || conflict.priority === 'critical')
    )
  }, [conflicts])

  // 解决冲突
  const resolveConflict = useCallback(async (resolution: ConflictResolution) => {
    try {
      setConflicts(prev => prev.map(conflict => 
        conflict.id === resolution.conflictId
          ? { ...conflict, status: 'resolved' as const }
          : conflict
      ))

      // 在实际应用中，这里会同步解决方案到数据库
      console.log('Conflict resolved:', resolution)
      
      return true
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      return false
    }
  }, [])

  // 忽略冲突
  const ignoreConflict = useCallback(async (conflictId: string) => {
    try {
      setConflicts(prev => prev.map(conflict => 
        conflict.id === conflictId
          ? { ...conflict, status: 'ignored' as const }
          : conflict
      ))

      console.log('Conflict ignored:', conflictId)
      return true
    } catch (error) {
      console.error('Failed to ignore conflict:', error)
      return false
    }
  }, [])

  // 批量解决冲突
  const batchResolveConflicts = useCallback(async (resolutions: ConflictResolution[]) => {
    try {
      const results = await Promise.all(
        resolutions.map(resolution => resolveConflict(resolution))
      )
      
      return results.every(result => result === true)
    } catch (error) {
      console.error('Failed to batch resolve conflicts:', error)
      return false
    }
  }, [resolveConflict])

  // 自动解决冲突
  const autoResolveConflicts = useCallback(async (conflictIds?: string[]) => {
    try {
      const conflictsToResolve = conflictIds 
        ? conflicts.filter(conflict => conflictIds.includes(conflict.id))
        : getPendingConflicts()

      const resolutions: ConflictResolution[] = conflictsToResolve.map(conflict => ({
        conflictId: conflict.id,
        action: 'use_local' as const, // 默认使用本地版本
        reason: 'Auto-resolved: using local version as default'
      }))

      return await batchResolveConflicts(resolutions)
    } catch (error) {
      console.error('Failed to auto-resolve conflicts:', error)
      return false
    }
  }, [getPendingConflicts, batchResolveConflicts])

  // 清理已解决的冲突
  const cleanupResolvedConflicts = useCallback(() => {
    setConflicts(prev => prev.filter(conflict => 
      conflict.status !== 'resolved'
    ))
  }, [])

  // 统计信息
  const stats: ConflictStats = {
    total: conflicts.length,
    pending: conflicts.filter(c => c.status === 'pending').length,
    resolved: conflicts.filter(c => c.status === 'resolved').length,
    ignored: conflicts.filter(c => c.status === 'ignored').length,
    highPriority: conflicts.filter(c => 
      c.status === 'pending' && c.priority === 'high'
    ).length,
    criticalPriority: conflicts.filter(c => 
      c.status === 'pending' && c.priority === 'critical'
    ).length
  }

  // 定期检测冲突（可选）
  useEffect(() => {
    // 在实际应用中，可以定期检测冲突
    // const interval = setInterval(() => {
    //   detectConflicts()
    // }, 60000) // 每分钟检测一次

    // return () => clearInterval(interval)
  }, [detectConflicts])

  return {
    // 状态
    conflicts,
    stats,
    selectedConflict,
    isDetecting,
    
    // 操作方法
    detectConflicts,
    getPendingConflicts,
    getHighPriorityConflicts,
    resolveConflict,
    ignoreConflict,
    batchResolveConflicts,
    autoResolveConflicts,
    cleanupResolvedConflicts,
    
    // 选择管理
    setSelectedConflict,
    
    // 便利方法
    hasConflicts: conflicts.length > 0,
    hasPendingConflicts: stats.pending > 0,
    hasHighPriorityConflicts: stats.highPriority > 0 || stats.criticalPriority > 0
  }
}

// ============================================================================
// 导出类型
// ============================================================================

export type {
  Conflict,
  ConflictStats,
  ConflictResolution
}