import React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  ExternalLink
} from 'lucide-react'
import { useConflicts } from '@/hooks/use-conflicts'
import { cn } from '@/lib/utils'

interface ConflictBannerProps {
  className?: string
  onOpenConflictPanel?: () => void
}

export function ConflictBanner({ className, onOpenConflictPanel }: ConflictBannerProps) {
  const { 
    stats, 
    getHighPriorityConflicts, 
    detectConflicts,
    setSelectedConflict 
  } = useConflicts()

  const highPriorityConflicts = getHighPriorityConflicts()
  const hasConflicts = stats.pendingConflicts > 0

  if (!hasConflicts) {
    return null
  }

  const handleRefresh = async () => {
    await detectConflicts()
  }

  const handleOpenConflict = (conflictId: string) => {
    setSelectedConflict(conflictId)
    onOpenConflictPanel?.()
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500 text-white'
      case 'high':
        return 'bg-orange-500 text-white'
      case 'medium':
        return 'bg-yellow-500 text-white'
      case 'low':
        return 'bg-blue-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* 主要冲突通知 */}
      <Alert className="border-orange-200 bg-orange-50">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertTitle className="text-orange-800">
          检测到数据冲突
        </AlertTitle>
        <AlertDescription className="text-orange-700">
          发现 {stats.pendingConflicts} 个待解决的数据冲突，建议及时处理以避免数据丢失。
          {highPriorityConflicts.length > 0 && (
            <span className="ml-2 font-medium">
              其中 {highPriorityConflicts.length} 个需要立即处理。
            </span>
          )}
        </AlertDescription>
        
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenConflictPanel}
              className="text-orange-700 border-orange-300 hover:bg-orange-100"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              查看所有冲突
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="text-orange-600 hover:bg-orange-100"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新检测
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-orange-700 bg-orange-100">
              总计: {stats.totalConflicts}
            </Badge>
            <Badge variant="destructive" className="bg-red-100 text-red-700">
              待解决: {stats.pendingConflicts}
            </Badge>
          </div>
        </div>
      </Alert>

      {/* 高优先级冲突快速预览 */}
      {highPriorityConflicts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-red-700">高优先级冲突</h4>
            <Badge variant="destructive" className="text-xs">
              {highPriorityConflicts.length} 个
            </Badge>
          </div>
          
          {highPriorityConflicts.slice(0, 3).map((conflict) => (
            <Alert 
              key={conflict.id} 
              className="border-red-200 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors"
              onClick={() => handleOpenConflict(conflict.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", getSeverityColor(conflict.severity))}
                  >
                    {conflict.severity}
                  </Badge>
                  
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      {getConflictTitle(conflict)}
                    </p>
                    <p className="text-xs text-red-600">
                      {getConflictDescription(conflict)}
                    </p>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-600 hover:bg-red-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenConflict(conflict.id)
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </Alert>
          ))}
          
          {highPriorityConflicts.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenConflictPanel}
              className="w-full text-red-600 hover:bg-red-100"
            >
              查看剩余 {highPriorityConflicts.length - 3} 个高优先级冲突
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// 辅助函数
function getConflictTitle(conflict: any): string {
  switch (conflict.type) {
    case 'card_content':
      return '卡片内容冲突'
    case 'card_style':
      return '卡片样式冲突'
    case 'card_tags':
      return '卡片标签冲突'
    case 'card_folder':
      return '卡片文件夹冲突'
    case 'folder_name':
      return '文件夹名称冲突'
    case 'folder_structure':
      return '文件夹结构冲突'
    case 'tag_rename':
      return '标签重命名冲突'
    case 'tag_delete':
      return '标签删除冲突'
    case 'tag_color':
      return '标签颜色冲突'
    default:
      return '数据冲突'
  }
}

function getConflictDescription(conflict: any): string {
  switch (conflict.type) {
    case 'card_content':
      return `卡片 "${conflict.localVersion.content.frontContent.title}" 在多设备上被同时编辑`
    case 'folder_name':
      return `文件夹 "${conflict.localVersion.name}" 与远程版本名称不一致`
    case 'tag_rename':
      return `标签 "${conflict.localVersion.name}" 重命名冲突`
    default:
      return '数据版本不一致，需要手动解决'
  }
}