import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { SyncStatusDisplay } from '@/components/sync/sync-status-display'
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  Filter,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { useConflicts } from '@/hooks/use-conflicts'
import { EnhancedConflictDetail } from './enhanced-conflict-detail'
import { cn } from '@/lib/utils'
import type { ConflictBase, ConflictSeverity, ConflictStatus, ConflictResolution } from '@/types/conflict'

interface ConflictPanelProps {
  isOpen: boolean
  onClose: () => void
  className?: string
}

export function ConflictPanel({ isOpen, onClose, className }: ConflictPanelProps) {
  const {
    conflicts,
    selectedConflict,
    setSelectedConflict,
    getStats,
    getPendingConflicts,
    getHighPriorityConflicts,
    resolveConflict,
    ignoreConflict,
    batchResolveConflicts,
    detectConflicts,
    refreshConflicts,
    isResolving,
    isLoading,
    error,
    syncStatus
  } = useConflicts()

  const [filterType, setFilterType] = useState<'all' | 'pending' | 'high' | 'resolved'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set())
  const [selectedConflicts, setSelectedConflicts] = useState<Set<string>>(new Set())
  const [showDetail, setShowDetail] = useState(false)
  const [detailConflictId, setDetailConflictId] = useState<string | null>(null)

  const stats = getStats()
  const pendingConflicts = getPendingConflicts()
  const highPriorityConflicts = getHighPriorityConflicts()

  const filteredConflicts = React.useMemo(() => {
    let filtered = conflicts

    // 按状态过滤
    switch (filterType) {
      case 'pending':
        filtered = pendingConflicts
        break
      case 'high':
        filtered = highPriorityConflicts
        break
      case 'resolved':
        filtered = conflicts.filter(c => c.status === 'resolved')
        break
    }

    // 按搜索词过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(conflict => {
        switch (conflict.entityType) {
          case 'card':
            return conflict.localVersion.content.frontContent.title.toLowerCase().includes(term)
          case 'folder':
            return conflict.localVersion.name.toLowerCase().includes(term)
          case 'tag':
            return conflict.localVersion.name.toLowerCase().includes(term)
          default:
            return false
        }
      })
    }

    return filtered.sort((a, b) => {
      // 高优先级在前
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity]
      if (severityDiff !== 0) return -severityDiff

      // 时间排序（最新的在前）
      return b.timestamp.getTime() - a.timestamp.getTime()
    })
  }, [conflicts, filterType, searchTerm, pendingConflicts, highPriorityConflicts])

  const handleToggleExpand = (conflictId: string) => {
    setExpandedConflicts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(conflictId)) {
        newSet.delete(conflictId)
      } else {
        newSet.add(conflictId)
      }
      return newSet
    })
  }

  const handleToggleSelect = (conflictId: string) => {
    setSelectedConflicts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(conflictId)) {
        newSet.delete(conflictId)
      } else {
        newSet.add(conflictId)
      }
      return newSet
    })
  }

  const handleViewDetail = (conflictId: string) => {
    setDetailConflictId(conflictId)
    setShowDetail(true)
  }

  const handleDetailResolve = async (conflictId: string, resolution: ConflictResolution) => {
    await resolveConflict(conflictId, resolution)
    setShowDetail(false)
    setDetailConflictId(null)
  }

  const handleDetailClose = () => {
    setShowDetail(false)
    setDetailConflictId(null)
  }

  const handleSelectAll = () => {
    if (selectedConflicts.size === filteredConflicts.length) {
      setSelectedConflicts(new Set())
    } else {
      setSelectedConflicts(new Set(filteredConflicts.map(c => c.id)))
    }
  }

  const handleBatchResolve = async (resolutionType: 'keep_local' | 'keep_remote') => {
    if (selectedConflicts.size === 0) return

    const conflictIds = Array.from(selectedConflicts)
    await batchResolveConflicts(conflictIds, {
      type: resolutionType,
      reason: `批量选择${resolutionType === 'keep_local' ? '本地' : '远程'}版本`
    })
    
    setSelectedConflicts(new Set())
  }

  const getSeverityColor = (severity: ConflictSeverity) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusIcon = (status: ConflictStatus) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'ignored':
        return <XCircle className="h-4 w-4 text-gray-500" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  if (!isOpen) return null

  return (
    <div className={cn("fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4", className)}>
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-xl">冲突管理中心</CardTitle>
              <Badge variant="outline" className="ml-2">
                {stats.pendingConflicts} 待解决
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
          
          {/* 统计信息 */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>总计: {stats.totalConflicts}</span>
            <span>已解决: {stats.resolvedConflicts}</span>
            <span>待处理: {stats.pendingConflicts}</span>
            <span>高优先级: {highPriorityConflicts.length}</span>

            {/* 同步状态 */}
            {syncStatus && (
              <>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    syncStatus.isSyncing ? 'bg-yellow-500 animate-pulse' :
                    syncStatus.networkStatus?.online ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span>
                    {syncStatus.isSyncing ? '同步中...' :
                     syncStatus.networkStatus?.online ? '在线' : '离线'}
                  </span>
                </div>
                {syncStatus.pendingOperations > 0 && (
                  <span>待同步: {syncStatus.pendingOperations}</span>
                )}
              </>
            )}
          </div>

          {/* 同步状态显示 */}
          <SyncStatusDisplay
            showDetails={true}
            compact={false}
            className="mb-4"
          />

          {/* 错误显示 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-600">{error}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  重试
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="flex-1 flex flex-col space-y-4">
          {/* 搜索和过滤 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="搜索冲突..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('all')}
              >
                全部
              </Button>
              <Button
                variant={filterType === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('pending')}
              >
                待解决
              </Button>
              <Button
                variant={filterType === 'high' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('high')}
              >
                高优先级
              </Button>
              <Button
                variant={filterType === 'resolved' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('resolved')}
              >
                已解决
              </Button>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={refreshConflicts}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>

          {/* 批量操作 */}
          {selectedConflicts.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  已选择 {selectedConflicts.size} 个冲突
                </span>
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  {selectedConflicts.size === filteredConflicts.length ? '取消全选' : '全选'}
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBatchResolve('keep_local')}
                  disabled={isResolving}
                >
                  批量保留本地
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBatchResolve('keep_remote')}
                  disabled={isResolving}
                >
                  批量保留远程
                </Button>
              </div>
            </div>
          )}

          {/* 冲突列表 */}
          <ScrollArea className="flex-1">
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">加载冲突信息...</p>
                </div>
              ) : filteredConflicts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? '没有找到匹配的冲突' : '暂无冲突'}
                </div>
              ) : (
                filteredConflicts.map((conflict) => (
                  <ConflictItem
                    key={conflict.id}
                    conflict={conflict}
                    isExpanded={expandedConflicts.has(conflict.id)}
                    isSelected={selectedConflicts.has(conflict.id)}
                    onToggleExpand={() => handleToggleExpand(conflict.id)}
                    onToggleSelect={() => handleToggleSelect(conflict.id)}
                    onSelect={() => setSelectedConflict(conflict.id)}
                    onViewDetail={() => handleViewDetail(conflict.id)}
                    onResolve={(resolution) => resolveConflict(conflict.id, resolution)}
                    onIgnore={() => ignoreConflict(conflict.id)}
                    getSeverityColor={getSeverityColor}
                    getStatusIcon={getStatusIcon}
                    isResolving={isResolving}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

// 冲突项组件
interface ConflictItemProps {
  conflict: ConflictBase
  isExpanded: boolean
  isSelected: boolean
  onToggleExpand: () => void
  onToggleSelect: () => void
  onSelect: () => void
  onViewDetail: () => void
  onResolve: (resolution: any) => Promise<void>
  onIgnore: () => void
  getSeverityColor: (severity: ConflictSeverity) => string
  getStatusIcon: (status: ConflictStatus) => React.ReactNode
  isResolving: boolean
}

function ConflictItem({
  conflict,
  isExpanded,
  isSelected,
  onToggleExpand,
  onToggleSelect,
  onSelect,
  onViewDetail,
  onResolve,
  onIgnore,
  getSeverityColor,
  getStatusIcon,
  isResolving
}: ConflictItemProps) {
  return (
    <Card 
      className={cn(
        "transition-all duration-200 cursor-pointer hover:shadow-md",
        getSeverityColor(conflict.severity),
        isSelected && "ring-2 ring-blue-500"
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              onClick={(e) => e.stopPropagation()}
              className="mt-1"
            />
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {getStatusIcon(conflict.status)}
                <Badge variant="outline" className="text-xs">
                  {conflict.severity}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {getConflictTypeLabel(conflict.type)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatTime(conflict.timestamp)}
                </span>
              </div>
              
              <h4 className="font-medium mb-1">
                {getConflictTitle(conflict)}
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                {getConflictDescription(conflict)}
              </p>
              
              {isExpanded && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">来源设备:</span>
                      <span className="ml-2">{conflict.sourceDevice}</span>
                    </div>
                    <div>
                      <span className="font-medium">冲突时间:</span>
                      <span className="ml-2">{formatTime(conflict.timestamp)}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewDetail()
                      }}
                    >
                      查看详情
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onResolve({ type: 'keep_local', reason: '保留本地版本' })
                      }}
                      disabled={isResolving}
                    >
                      保留本地
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onResolve({ type: 'keep_remote', reason: '保留远程版本' })
                      }}
                      disabled={isResolving}
                    >
                      保留远程
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onIgnore()
                      }}
                    >
                      忽略
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
            className="ml-2"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// 辅助函数
function getConflictTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'card_content': '卡片内容',
    'card_style': '卡片样式',
    'card_tags': '卡片标签',
    'card_folder': '卡片文件夹',
    'folder_name': '文件夹名称',
    'folder_structure': '文件夹结构',
    'tag_rename': '标签重命名',
    'tag_delete': '标签删除',
    'tag_color': '标签颜色'
  }
  return labels[type] || type
}

function getConflictTitle(conflict: any): string {
  switch (conflict.entityType) {
    case 'card':
      return conflict.localVersion.content.frontContent.title
    case 'folder':
      return conflict.localVersion.name
    case 'tag':
      return conflict.localVersion.name
    default:
      return '未知冲突'
  }
}

function getConflictDescription(conflict: any): string {
  switch (conflict.type) {
    case 'card_content':
      return '卡片内容在多设备上被同时编辑'
    case 'folder_name':
      return '文件夹名称与远程版本不一致'
    case 'tag_rename':
      return '标签重命名冲突'
    default:
      return '数据版本不一致'
  }
}

function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}小时前`
  return `${Math.floor(minutes / 1440)}天前`
}