import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  GitMerge,
  GitCommit,
  GitPullRequest,
  Eye,
  EyeOff,
  Copy,
  Download
} from 'lucide-react'
import { useConflicts } from '@/hooks/use-conflicts'
import { cn } from '@/lib/utils'
import type { ConflictBase, ConflictResolution } from '@/types/conflict'

interface ConflictDetailProps {
  conflictId: string
  onClose: () => void
  className?: string
}

export function ConflictDetail({ conflictId, onClose, className }: ConflictDetailProps) {
  const {
    getConflictById,
    resolveConflict,
    ignoreConflict,
    getSuggestions,
    isResolving
  } = useConflicts()

  const [activeTab, setActiveTab] = useState('compare')
  const [selectedResolution, setSelectedResolution] = useState<'local' | 'remote' | 'merge' | 'manual'>('local')
  const [manualEdits, setManualEdits] = useState<Record<string, any>>({})
  const [showDiff, setShowDiff] = useState(true)

  const conflict = getConflictById(conflictId)
  const suggestions = getSuggestions(conflictId)

  if (!conflict) {
    return (
      <Card className={cn("w-full max-w-6xl max-h-[90vh]", className)}>
        <CardContent className="p-8 text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">冲突不存在</h3>
          <p className="text-muted-foreground mb-4">指定的冲突ID未找到或已被解决</p>
          <Button onClick={onClose}>关闭</Button>
        </CardContent>
      </Card>
    )
  }

  const handleResolve = async () => {
    let resolution: ConflictResolution

    switch (selectedResolution) {
      case 'local':
        resolution = {
          type: 'keep_local',
          reason: '用户选择保留本地版本'
        }
        break
      case 'remote':
        resolution = {
          type: 'keep_remote',
          reason: '用户选择保留远程版本'
        }
        break
      case 'merge':
        resolution = {
          type: 'merge',
          reason: '用户选择智能合并',
          mergedData: getMergedData()
        }
        break
      case 'manual':
        resolution = {
          type: 'manual',
          reason: '用户手动编辑',
          mergedData: manualEdits,
          manualChanges: Object.entries(manualEdits).map(([field, value]) => ({
            field,
            value,
            source: 'custom'
          }))
        }
        break
    }

    const success = await resolveConflict(conflictId, resolution)
    if (success) {
      onClose()
    }
  }

  const getMergedData = () => {
    // 根据冲突类型生成合并数据
    if (conflict.entityType === 'card') {
      return {
        content: {
          frontContent: mergeCardContent(conflict.localVersion.content.frontContent, conflict.remoteVersion.content.frontContent),
          backContent: mergeCardContent(conflict.localVersion.content.backContent, conflict.remoteVersion.content.backContent)
        },
        style: conflict.localVersion.style
      }
    }
    return conflict.localVersion
  }

  const mergeCardContent = (local: any, remote: any) => {
    return {
      title: local.title.length > remote.title.length ? local.title : remote.title,
      text: `${local.text  }\n\n${  remote.text}`,
      tags: [...new Set([...local.tags, ...remote.tags])],
      lastModified: new Date()
    }
  }

  const getConflictingFields = () => {
    if (conflict.type === 'card_content') {
      return [
        { field: 'title', label: '标题', local: conflict.localVersion.content.frontContent.title, remote: conflict.remoteVersion.content.frontContent.title },
        { field: 'frontText', label: '正面内容', local: conflict.localVersion.content.frontContent.text, remote: conflict.remoteVersion.content.frontContent.text },
        { field: 'backText', label: '背面内容', local: conflict.localVersion.content.backContent.text, remote: conflict.remoteVersion.content.backContent.text },
        { field: 'tags', label: '标签', local: conflict.localVersion.content.frontContent.tags, remote: conflict.remoteVersion.content.frontContent.tags }
      ]
    }
    return []
  }

  const conflictingFields = getConflictingFields()

  return (
    <Card className={cn("w-full max-w-6xl max-h-[90vh] flex flex-col", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className={cn("h-5 w-5", getSeverityColorClass(conflict.severity))} />
            <div>
              <CardTitle className="text-xl">
                {getConflictTitle(conflict)}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {getConflictDescription(conflict)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>

        {/* 冲突信息 */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>类型: {getConflictTypeLabel(conflict.type)}</span>
          <span>优先级: {conflict.severity}</span>
          <span>来源: {conflict.sourceDevice}</span>
          <span>时间: {formatTime(conflict.timestamp)}</span>
          <Badge variant="outline">
            {conflict.status === 'pending' ? '待解决' : conflict.status === 'resolved' ? '已解决' : '已忽略'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="compare">对比视图</TabsTrigger>
            <TabsTrigger value="suggestions">智能建议</TabsTrigger>
            <TabsTrigger value="history">历史记录</TabsTrigger>
            <TabsTrigger value="manual">手动合并</TabsTrigger>
          </TabsList>

          <div className="flex-1 mt-4">
            {/* 对比视图 */}
            <TabsContent value="compare" className="h-full">
              <div className="grid grid-cols-2 gap-4 h-full">
                {/* 本地版本 */}
                <Card className="border-green-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <GitCommit className="h-4 w-4 text-green-600" />
                        本地版本
                      </CardTitle>
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        本地设备
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      更新时间: {formatTime(conflict.localVersion.updatedAt)}
                    </p>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ScrollArea className="h-96">
                      {renderContentPreview(conflict, 'local')}
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* 远程版本 */}
                <Card className="border-blue-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <GitPullRequest className="h-4 w-4 text-blue-600" />
                        远程版本
                      </CardTitle>
                      <Badge variant="outline" className="text-blue-600 border-blue-200">
                        {conflict.sourceDevice}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      更新时间: {formatTime(conflict.remoteVersion.updatedAt)}
                    </p>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ScrollArea className="h-96">
                      {renderContentPreview(conflict, 'remote')}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* 智能建议 */}
            <TabsContent value="suggestions" className="h-full">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <GitMerge className="h-5 w-5 text-blue-500" />
                  <h3 className="text-lg font-semibold">智能解决建议</h3>
                </div>
                
                {suggestions.length > 0 ? (
                  <div className="grid gap-3">
                    {suggestions.map((suggestion, index) => (
                      <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={suggestion.type === 'merge' ? 'default' : 'secondary'}>
                                  {getSuggestionTypeLabel(suggestion.type)}
                                </Badge>
                                <Badge variant="outline">
                                  置信度: {Math.round(suggestion.confidence * 100)}%
                                </Badge>
                              </div>
                              <p className="text-sm mb-2">{suggestion.reason}</p>
                              {suggestion.preview && (
                                <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                                  预览: {JSON.stringify(suggestion.preview)}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedResolution(suggestion.type)}
                            >
                              应用建议
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-muted-foreground">暂无智能建议，请手动选择解决方案</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* 历史记录 */}
            <TabsContent value="history" className="h-full">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <h3 className="text-lg font-semibold">冲突历史</h3>
                </div>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-red-50 rounded">
                        <div>
                          <p className="font-medium">冲突检测</p>
                          <p className="text-sm text-muted-foreground">
                            {formatTime(conflict.timestamp)}
                          </p>
                        </div>
                        <Badge variant="destructive">冲突</Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                        <div>
                          <p className="font-medium">本地版本更新</p>
                          <p className="text-sm text-muted-foreground">
                            {formatTime(conflict.localVersion.updatedAt)}
                          </p>
                        </div>
                        <Badge variant="outline">本地</Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                        <div>
                          <p className="font-medium">远程版本更新</p>
                          <p className="text-sm text-muted-foreground">
                            {formatTime(conflict.remoteVersion.updatedAt)}
                          </p>
                        </div>
                        <Badge variant="outline">远程</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* 手动合并 */}
            <TabsContent value="manual" className="h-full">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-blue-500" />
                  <h3 className="text-lg font-semibold">手动合并</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDiff(!showDiff)}
                  >
                    {showDiff ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                    {showDiff ? '隐藏差异' : '显示差异'}
                  </Button>
                </div>
                
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {conflictingFields.map((field) => (
                      <Card key={field.field}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">{field.label}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {showDiff && (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-2 bg-green-50 rounded text-sm">
                                <p className="font-medium text-green-700 mb-1">本地:</p>
                                <p>{field.local}</p>
                              </div>
                              <div className="p-2 bg-blue-50 rounded text-sm">
                                <p className="font-medium text-blue-700 mb-1">远程:</p>
                                <p>{field.remote}</p>
                              </div>
                            </div>
                          )}
                          
                          <div>
                            <label className="text-sm font-medium mb-1 block">
                              合并结果:
                            </label>
                            {field.field === 'tags' ? (
                              <div className="flex flex-wrap gap-2">
                                {Array.isArray(field.local) && field.local.map((tag: string) => (
                                  <Badge key={tag} variant="secondary">{tag}</Badge>
                                ))}
                                {Array.isArray(field.remote) && field.remote.map((tag: string) => (
                                  <Badge key={tag} variant="outline">{tag}</Badge>
                                ))}
                              </div>
                            ) : (
                              <Textarea
                                value={manualEdits[field.field] || field.local}
                                onChange={(e) => setManualEdits(prev => ({
                                  ...prev,
                                  [field.field]: e.target.value
                                }))}
                                className="min-h-[100px]"
                              />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* 解决方案选择 */}
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">解决方案:</span>
              <div className="flex gap-2">
                {['local', 'remote', 'merge', 'manual'].map((type) => (
                  <Button
                    key={type}
                    variant={selectedResolution === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedResolution(type as any)}
                  >
                    {getResolutionLabel(type)}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button
                variant="ghost"
                onClick={() => ignoreConflict(conflictId)}
              >
                忽略冲突
              </Button>
              <Button
                onClick={handleResolve}
                disabled={isResolving}
              >
                {isResolving ? '解决中...' : '应用解决方案'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// 辅助函数
function renderContentPreview(conflict: any, version: 'local' | 'remote') {
  const data = version === 'local' ? conflict.localVersion : conflict.remoteVersion
  
  if (conflict.entityType === 'card') {
    return (
      <div className="space-y-4">
        <div>
          <h4 className="font-medium mb-2">正面内容</h4>
          <div className="bg-gray-50 p-3 rounded">
            <h5 className="font-semibold mb-2">{data.content.frontContent.title}</h5>
            <p className="text-sm text-gray-600">{data.content.frontContent.text}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {data.content.frontContent.tags.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
        
        <div>
          <h4 className="font-medium mb-2">背面内容</h4>
          <div className="bg-gray-50 p-3 rounded">
            <h5 className="font-semibold mb-2">{data.content.backContent.title}</h5>
            <p className="text-sm text-gray-600">{data.content.backContent.text}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {data.content.backContent.tags.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  return <pre className="text-sm">{JSON.stringify(data, null, 2)}</pre>
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
      return '卡片内容在多设备上被同时编辑，需要选择保留的版本'
    case 'folder_name':
      return '文件夹名称与远程版本不一致'
    case 'tag_rename':
      return '标签重命名冲突'
    default:
      return '数据版本不一致，需要手动解决'
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

function getSeverityColorClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'text-red-600'
    case 'high':
      return 'text-orange-600'
    case 'medium':
      return 'text-yellow-600'
    case 'low':
      return 'text-blue-600'
    default:
      return 'text-gray-600'
  }
}

function getSuggestionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'keep_local': '保留本地',
    'keep_remote': '保留远程',
    'merge': '智能合并',
    'manual': '手动处理'
  }
  return labels[type] || type
}

function getResolutionLabel(type: string): string {
  const labels: Record<string, string> = {
    'local': '保留本地',
    'remote': '保留远程',
    'merge': '智能合并',
    'manual': '手动合并'
  }
  return labels[type] || type
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