import { useState, useEffect, useCallback } from 'react'
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

// Mock冲突数据用于开发
const mockConflicts: (CardConflict | FolderConflict | TagConflict)[] = [
  {
    id: '1',
    type: 'card_content',
    entityType: 'card',
    entityId: 'card-1',
    timestamp: new Date(),
    sourceDevice: 'Mobile Device',
    severity: 'medium',
    status: 'pending',
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    localVersion: {
      content: {
        frontContent: {
          title: 'React Best Practices',
          text: 'Key principles for writing maintainable React code including component composition, state management, and performance optimization.',
          tags: ['react', 'frontend'],
          lastModified: new Date(Date.now() - 10 * 60 * 1000)
        },
        backContent: {
          title: 'Implementation Details',
          text: 'Use functional components with hooks, implement proper error boundaries, optimize with React.memo and useMemo for expensive calculations.',
          tags: ['react', 'frontend'],
          lastModified: new Date(Date.now() - 10 * 60 * 1000)
        }
      },
      style: {
        type: 'solid',
        backgroundColor: '#f8fafc',
        fontFamily: 'system-ui',
        fontSize: 'base',
        fontWeight: 'normal',
        textColor: '#1f2937',
        borderRadius: 'xl',
        shadow: 'md',
        borderWidth: 0
      },
      folderId: 'folder-1',
      isFlipped: false,
      updatedAt: new Date(Date.now() - 10 * 60 * 1000),
      version: 'local-1'
    },
    remoteVersion: {
      content: {
        frontContent: {
          title: 'React Best Practices - Updated',
          text: 'Key principles for writing maintainable React code including component composition, state management, performance optimization, and modern patterns.',
          tags: ['react', 'frontend', 'updated'],
          lastModified: new Date(Date.now() - 2 * 60 * 1000)
        },
        backContent: {
          title: 'Implementation Details',
          text: 'Use functional components with hooks, implement proper error boundaries, optimize with React.memo and useMemo for expensive calculations. Consider using React Query for data fetching.',
          tags: ['react', 'frontend', 'updated'],
          lastModified: new Date(Date.now() - 2 * 60 * 1000)
        }
      },
      style: {
        type: 'solid',
        backgroundColor: '#f8fafc',
        fontFamily: 'system-ui',
        fontSize: 'base',
        fontWeight: 'normal',
        textColor: '#1f2937',
        borderRadius: 'xl',
        shadow: 'md',
        borderWidth: 0
      },
      folderId: 'folder-1',
      isFlipped: false,
      updatedAt: new Date(Date.now() - 2 * 60 * 1000),
      version: 'remote-1'
    },
    conflictFields: ['frontContent.title', 'frontContent.text', 'frontContent.tags', 'backContent.text'],
    suggestions: [
      {
        type: 'merge',
        confidence: 0.8,
        reason: '内容相似度高，可以智能合并'
      }
    ]
  },
  {
    id: '2',
    type: 'folder_name',
    entityType: 'folder',
    entityId: 'folder-2',
    timestamp: new Date(),
    sourceDevice: 'Web Browser',
    severity: 'low',
    status: 'pending',
    createdAt: new Date(Date.now() - 15 * 60 * 1000),
    localVersion: {
      name: 'Learning Resources',
      color: '#3b82f6',
      icon: 'Book',
      parentId: undefined,
      cardIds: ['card-3', 'card-4'],
      isExpanded: true,
      updatedAt: new Date(Date.now() - 20 * 60 * 1000),
      version: 'local-1'
    },
    remoteVersion: {
      name: 'Study Materials',
      color: '#3b82f6',
      icon: 'Book',
      parentId: undefined,
      cardIds: ['card-3', 'card-4'],
      isExpanded: true,
      updatedAt: new Date(Date.now() - 5 * 60 * 1000),
      version: 'remote-1'
    },
    affectedCards: ['card-3', 'card-4']
  }
]

export function useConflicts() {
  const [conflicts, setConflicts] = useState<(CardConflict | FolderConflict | TagConflict)[]>(mockConflicts)
  const [selectedConflict, setSelectedConflict] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(false)
  const [stats, setStats] = useState<ConflictStats>({
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
      averageResolutionTime: 0
    }

    // 按类型统计
    conflicts.forEach(conflict => {
      newStats.conflictsByType[conflict.type] = (newStats.conflictsByType[conflict.type] || 0) + 1
      newStats.conflictsBySeverity[conflict.severity] = (newStats.conflictsBySeverity[conflict.severity] || 0) + 1
    })

    setStats(newStats)
  }, [conflicts])

  // 模拟自动检测冲突
  useEffect(() => {
    const interval = setInterval(() => {
      // 这里应该调用实际的冲突检测API
      // 目前使用模拟数据
    }, 30000) // 每30秒检测一次

    return () => clearInterval(interval)
  }, [])

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

  // 解决冲突
  const resolveConflict = useCallback(async (conflictId: string, resolution: ConflictResolution) => {
    setIsResolving(true)
    
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setConflicts(prev => prev.map(conflict => 
        conflict.id === conflictId 
          ? { 
              ...conflict, 
              status: 'resolved' as ConflictStatus,
              resolvedAt: new Date(),
              resolution 
            }
          : conflict
      ))
      
      setSelectedConflict(null)
      return true
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      return false
    } finally {
      setIsResolving(false)
    }
  }, [])

  // 忽略冲突
  const ignoreConflict = useCallback(async (conflictId: string) => {
    setConflicts(prev => prev.map(conflict => 
      conflict.id === conflictId 
        ? { ...conflict, status: 'ignored' as ConflictStatus }
        : conflict
    ))
    setSelectedConflict(null)
  }, [])

  // 批量解决冲突
  const batchResolveConflicts = useCallback(async (conflictIds: string[], resolution: ConflictResolution) => {
    setIsResolving(true)
    
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setConflicts(prev => prev.map(conflict => 
        conflictIds.includes(conflict.id) 
          ? { 
              ...conflict, 
              status: 'resolved' as ConflictStatus,
              resolvedAt: new Date(),
              resolution 
            }
          : conflict
      ))
      
      return true
    } catch (error) {
      console.error('Failed to batch resolve conflicts:', error)
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
    return ConflictResolutionEngine.generateSuggestions(conflict)
  }, [getConflictById])

  // 检测新冲突
  const detectConflicts = useCallback(async () => {
    // 模拟检测新冲突
    const newConflicts = await new Promise<(CardConflict | FolderConflict | TagConflict)[]>(resolve => {
      setTimeout(() => {
        // 随机生成新冲突（10%概率）
        if (Math.random() < 0.1) {
          const newConflict: CardConflict = {
            id: Date.now().toString(),
            type: 'card_content',
            entityType: 'card',
            entityId: `card-${Math.floor(Math.random() * 100)}`,
            timestamp: new Date(),
            sourceDevice: 'Unknown Device',
            severity: Math.random() > 0.7 ? 'high' : 'medium',
            status: 'pending',
            createdAt: new Date(),
            localVersion: mockConflicts[0].localVersion,
            remoteVersion: mockConflicts[0].remoteVersion,
            conflictFields: ['frontContent.title'],
            suggestions: [
              {
                type: 'keep_remote',
                confidence: 0.9,
                reason: '远程版本更新'
              }
            ]
          }
          resolve([...conflicts, newConflict])
        } else {
          resolve(conflicts)
        }
      }, 1000)
    })
    
    setConflicts(newConflicts)
    return newConflicts.filter(c => c.status === 'pending')
  }, [conflicts])

  return {
    conflicts,
    selectedConflict,
    setSelectedConflict,
    isResolving,
    stats,
    getConflictById,
    getPendingConflicts,
    getHighPriorityConflicts,
    resolveConflict,
    ignoreConflict,
    batchResolveConflicts,
    getSuggestions,
    detectConflicts
  }
}