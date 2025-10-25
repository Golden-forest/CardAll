import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  GitBranch,
  User,
  Zap,
  Eye,
  Download,
  Upload,
  Merge,
  Info
} from 'lucide-react'
import { useConflicts } from '@/hooks/use-conflicts'
import { conflictUIService } from '@/services/ui/conflict-ui-service'
import { performanceMonitor } from '@/services/ui/performance-monitor'
import { cn } from '@/lib/utils'
import type { ConflictBase, ConflictResolution, ConflictSuggestion } from '@/types/conflict'

interface EnhancedConflictDetailProps {
  conflictId: string
  onClose: () => void
  onResolve: (conflictId: string, resolution: ConflictResolution) => Promise<void>
  className?: string
}

interface ConflictPreview {
  localSummary: string
  remoteSummary: string
  differences: Difference[]
  estimatedResolutionTime: number
}

interface Difference {
  field: string
  localValue: string
  remoteValue: string
  impact: 'high' | 'medium' | 'low'
  suggestedResolution: 'local' | 'remote' | 'merge'
}

export function EnhancedConflictDetail({
  conflictId,
  onClose,
  onResolve,
  className
}: EnhancedConflictDetailProps) {
  const { getConflictById, getSuggestions, isResolving, isLoading } = useConflicts()
  const [conflict, setConflict] = useState<ConflictBase | null>(null)
  const [suggestions, setSuggestions] = useState<ConflictSuggestion[]>([])
  const [preview, setPreview] = useState<ConflictPreview | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState<ConflictSuggestion | null>(null)
  const [isApplyingResolution, setIsApplyingResolution] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    loadConflictDetails()
  }, [conflictId])

  const loadConflictDetails = async () => {
    const conflictData = await getConflictById(conflictId)
    const suggestionsData = await getSuggestions(conflictId)
    const previewData = await conflictUIService.getConflictPreview(conflictId)

    setConflict(conflictData)
    setSuggestions(suggestionsData)
    setPreview(previewData)

    if (suggestionsData.length > 0) {
      setSelectedSuggestion(suggestionsData[0])
    }
  }

  const handleApplyResolution = async () => {
    if (!selectedSuggestion || !conflict) return

    const timer = performanceMonitor.startConflictResolution()
    setIsApplyingResolution(true)

    try {
      const resolution: ConflictResolution = {
        type: selectedSuggestion.type,
        reason: selectedSuggestion.reason,
        mergedData: selectedSuggestion.preview
      }

      await onResolve(conflictId, resolution)
      timer()
      onClose()
    } catch (error) {
      console.error('Failed to apply resolution:', error)
    } finally {
      setIsApplyingResolution(false)
    }
  }

  const getSeverityColor = (severity: string) => {
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

  const getResolutionIcon = (type: string) => {
    switch (type) {
      case 'keep_local':
        return <Download className="h-4 w-4" />
      case 'keep_remote':
        return <Upload className="h-4 w-4" />
      case 'merge':
        return <Merge className="h-4 w-4" />
      case 'manual':
        return <User className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  if (!conflict || isLoading) {
    return (
      <div className={cn("fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4", className)}>
        <Card className="w-full max-w-4xl max-h-[90vh]">
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <span className="ml-3">加载冲突详情...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4", className)}>
      <Card className="w-full max-w-6xl max-h-[90vh] flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitBranch className="h-5 w-5 text-orange-500" />
              <div>
                <CardTitle className="text-xl">冲突解决详情</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {getConflictTitle(conflict)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={getSeverityColor(conflict.severity)}
              >
                {conflict.severity}
              </Badge>
              <Button variant="ghost" size="sm" onClick={onClose}>
                ×
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col space-y-4">
          <Tabs defaultValue="overview" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="comparison">版本对比</TabsTrigger>
              <TabsTrigger value="suggestions">解决方案</TabsTrigger>
              <TabsTrigger value="advanced">高级选项</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-4">
                  {/* 冲突基本信息 */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">冲突信息</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">冲突类型:</span>
                          <span className="ml-2">{getConflictTypeLabel(conflict.type)}</span>
                        </div>
                        <div>
                          <span className="font-medium">影响实体:</span>
                          <span className="ml-2">{conflict.entityType}</span>
                        </div>
                        <div>
                          <span className="font-medium">来源设备:</span>
                          <span className="ml-2">{conflict.sourceDevice}</span>
                        </div>
                        <div>
                          <span className="font-medium">检测时间:</span>
                          <span className="ml-2">{formatTime(conflict.timestamp)}</span>
                        </div>
                      </div>

                      {preview && (
                        <div className="mt-4">
                          <div className="font-medium mb-2">预计解决时间:</div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{preview.estimatedResolutionTime} 秒</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* 冲突预览 */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">冲突预览</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Download className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">本地版本</span>
                          </div>
                          <div className="p-3 bg-blue-50 rounded text-sm">
                            {preview?.localSummary || '加载中...'}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Upload className="h-4 w-4 text-orange-500" />
                            <span className="font-medium">远程版本</span>
                          </div>
                          <div className="p-3 bg-orange-50 rounded text-sm">
                            {preview?.remoteSummary || '加载中...'}
                          </div>
                        </div>
                      </div>

                      {/* 主要差异 */}
                      {preview?.differences && preview.differences.length > 0 && (
                        <div className="mt-4">
                          <div className="font-medium mb-2">主要差异:</div>
                          <div className="space-y-2">
                            {preview.differences.map((diff, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <span className="text-sm font-medium">{diff.field}</span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    diff.suggestedResolution === 'local' ? 'text-blue-600 bg-blue-50' :
                                    diff.suggestedResolution === 'remote' ? 'text-orange-600 bg-orange-50' :
                                    'text-green-600 bg-green-50'
                                  )}
                                >
                                  {diff.suggestedResolution === 'local' ? '本地' :
                                   diff.suggestedResolution === 'remote' ? '远程' : '合并'}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* 建议解决方案 */}
                  {suggestions.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">建议解决方案</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {suggestions.slice(0, 3).map((suggestion, index) => (
                            <div
                              key={index}
                              className={cn(
                                "p-3 border rounded-lg cursor-pointer transition-colors",
                                selectedSuggestion?.type === suggestion.type
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-gray-200 hover:border-gray-300"
                              )}
                              onClick={() => setSelectedSuggestion(suggestion)}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {getResolutionIcon(suggestion.type)}
                                  <span className="font-medium">
                                    {getSuggestionTitle(suggestion.type)}
                                  </span>
                                </div>
                                <Badge variant="outline">
                                  置信度: {Math.round(suggestion.confidence * 100)}%
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {suggestion.reason}
                              </p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="comparison" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* 本地版本详情 */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Download className="h-5 w-5 text-blue-500" />
                          本地版本
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3 text-sm">
                          <VersionDetails version={conflict.localVersion} entityType={conflict.entityType} />
                        </div>
                      </CardContent>
                    </Card>

                    {/* 远程版本详情 */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Upload className="h-5 w-5 text-orange-500" />
                          远程版本
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3 text-sm">
                          <VersionDetails version={conflict.remoteVersion} entityType={conflict.entityType} />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="suggestions" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-4">
                  {suggestions.map((suggestion, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {getResolutionIcon(suggestion.type)}
                            {getSuggestionTitle(suggestion.type)}
                          </CardTitle>
                          <Badge variant="outline">
                            置信度: {Math.round(suggestion.confidence * 100)}%
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="font-medium mb-2">建议理由:</div>
                          <p className="text-sm text-muted-foreground">
                            {suggestion.reason}
                          </p>
                        </div>

                        {suggestion.preview && (
                          <div>
                            <div className="font-medium mb-2">预览结果:</div>
                            <div className="p-3 bg-gray-50 rounded text-sm">
                              <pre className="whitespace-pre-wrap">
                                {JSON.stringify(suggestion.preview, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}

                        <Button
                          className="w-full"
                          onClick={() => {
                            setSelectedSuggestion(suggestion)
                            handleApplyResolution()
                          }}
                          disabled={isApplyingResolution || isResolving}
                        >
                          {isApplyingResolution ? '应用中...' : '应用此解决方案'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="advanced" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      高级选项提供更多控制，但需要谨慎使用。不正确的设置可能导致数据丢失。
                    </AlertDescription>
                  </Alert>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">冲突解决历史</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        暂无解决历史记录
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">手动解决选项</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <Button variant="outline" className="w-full">
                          自定义合并
                        </Button>
                        <Button variant="outline" className="w-full">
                          忽略此冲突
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* 底部操作栏 */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              {selectedSuggestion && (
                <div className="text-sm text-muted-foreground">
                  已选择: {getSuggestionTitle(selectedSuggestion.type)}
                  (置信度: {Math.round(selectedSuggestion.confidence * 100)}%)
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button
                onClick={handleApplyResolution}
                disabled={!selectedSuggestion || isApplyingResolution || isResolving}
              >
                {isApplyingResolution ? '应用中...' : '应用解决方案'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// 版本详情组件
interface VersionDetailsProps {
  version: any
  entityType: string
}

function VersionDetails({ version, entityType }: VersionDetailsProps) {
  switch (entityType) {
    case 'card':
      return (
        <>
          <div>
            <span className="font-medium">标题:</span>
            <span className="ml-2">{version.content.frontContent.title}</span>
          </div>
          <div>
            <span className="font-medium">正面内容:</span>
            <span className="ml-2">{version.content.frontContent.text}</span>
          </div>
          <div>
            <span className="font-medium">背面内容:</span>
            <span className="ml-2">{version.content.backContent.text}</span>
          </div>
          <div>
            <span className="font-medium">标签:</span>
            <span className="ml-2">{version.content.frontContent.tags.join(', ')}</span>
          </div>
          <div>
            <span className="font-medium">更新时间:</span>
            <span className="ml-2">{formatTime(version.updatedAt)}</span>
          </div>
        </>
      )

    case 'folder':
      return (
        <>
          <div>
            <span className="font-medium">名称:</span>
            <span className="ml-2">{version.name}</span>
          </div>
          <div>
            <span className="font-medium">颜色:</span>
            <span className="ml-2">{version.color}</span>
          </div>
          <div>
            <span className="font-medium">卡片数量:</span>
            <span className="ml-2">{version.cardIds.length}</span>
          </div>
          <div>
            <span className="font-medium">更新时间:</span>
            <span className="ml-2">{formatTime(version.updatedAt)}</span>
          </div>
        </>
      )

    case 'tag':
      return (
        <>
          <div>
            <span className="font-medium">名称:</span>
            <span className="ml-2">{version.name}</span>
          </div>
          <div>
            <span className="font-medium">颜色:</span>
            <span className="ml-2">{version.color}</span>
          </div>
          <div>
            <span className="font-medium">使用次数:</span>
            <span className="ml-2">{version.count}</span>
          </div>
          <div>
            <span className="font-medium">更新时间:</span>
            <span className="ml-2">{formatTime(version.updatedAt)}</span>
          </div>
        </>
      )

    default:
      return <div>未知实体类型</div>
  }
}

// 辅助函数
function getConflictTitle(conflict: ConflictBase): string {
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

function getSuggestionTitle(type: string): string {
  const titles: Record<string, string> = {
    'keep_local': '保留本地版本',
    'keep_remote': '保留远程版本',
    'merge': '智能合并',
    'manual': '手动解决'
  }
  return titles[type] || type
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}