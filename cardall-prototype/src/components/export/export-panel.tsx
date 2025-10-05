import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Download,
  FileText,
  Database,
  Calendar,
  Filter,
  AlertCircle,
  CheckCircle,
  Folder,
  Tag,
  Image as ImageIcon,
  Search,
  Eye
} from 'lucide-react'
import { exportService, ExportProgress, FilterOptions } from '@/services/export-service'

export const ExportPanel: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null)
  const [exportResult, setExportResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // 导出选项
  const [exportOptions, setExportOptions] = useState<FilterOptions>({
    includeImages: true,
    includeSettings: true
  })

  // 过滤选项
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFolders, setSelectedFolders] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  })

  // 数据列表
  const [folders, setFolders] = useState<Array<{ id: string; name: string; cardCount: number }>>([])
  const [tags, setTags] = useState<Array<{ id: string; name: string; cardCount: number }>>([])
  const [previewData, setPreviewData] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [folderList, tagList] = await Promise.all([
        exportService.getExportableFolders(),
        exportService.getExportableTags()
      ])

      setFolders(folderList)
      setTags(tagList)
    } catch (error) {
      console.error('加载数据失败:', error)
      setError('加载数据失败，请重试')
    }
  }

  const updatePreview = async () => {
    try {
      const options: FilterOptions = {
        ...exportOptions,
        searchQuery: searchQuery || undefined,
        folderIds: selectedFolders.length > 0 ? selectedFolders : undefined,
        tagIds: selectedTags.length > 0 ? selectedTags : undefined,
        dateRange: dateRange.start && dateRange.end ? {
          start: new Date(dateRange.start),
          end: new Date(dateRange.end)
        } : undefined
      }

      const preview = await exportService.previewExport(options)
      setPreviewData(preview)
    } catch (error) {
      console.error('预览数据失败:', error)
    }
  }

  useEffect(() => {
    updatePreview()
  }, [exportOptions, searchQuery, selectedFolders, selectedTags, dateRange])

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      setIsExporting(true)
      setError(null)
      setExportResult(null)

      const options: FilterOptions = {
        ...exportOptions,
        searchQuery: searchQuery || undefined,
        folderIds: selectedFolders.length > 0 ? selectedFolders : undefined,
        tagIds: selectedTags.length > 0 ? selectedTags : undefined,
        dateRange: dateRange.start && dateRange.end ? {
          start: new Date(dateRange.start),
          end: new Date(dateRange.end)
        } : undefined
      }

      let result
      if (format === 'json') {
        result = await exportService.exportData(options, (progress) => {
          setExportProgress(progress)
        })
      } else {
        result = await exportService.exportToCSV(options, (progress) => {
          setExportProgress(progress)
        })
      }

      setExportResult(result)
    } catch (error) {
      console.error('导出失败:', error)
      setError('导出失败，请重试')
    } finally {
      setIsExporting(false)
      setExportProgress(null)
    }
  }

  const formatDate = (dateString: string): string => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('zh-CN')
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}秒`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}分${seconds % 60}秒`
  }

  const toggleFolder = (folderId: string) => {
    setSelectedFolders(prev =>
      prev.includes(folderId)
        ? prev.filter(id => id !== folderId)
        : [...prev, folderId]
    )
  }

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  return (
    <div className="space-y-6">
      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 导出进度 */}
      {exportProgress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              正在导出数据
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Progress value={exportProgress.progress} className="h-2" />
              <div className="flex justify-between text-sm text-gray-600">
                <span>{exportProgress.message}</span>
                <span>{exportProgress.progress}%</span>
              </div>
              {exportProgress.estimatedTimeRemaining !== undefined && (
                <div className="text-sm text-gray-500">
                  预计剩余时间: {exportProgress.estimatedTimeRemaining}秒
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 导出结果 */}
      {exportResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              导出完成
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">文件名:</span>
                <span className="font-medium">{exportResult.filename}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">文件大小:</span>
                <span className="font-medium">{formatFileSize(exportResult.size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">导出时间:</span>
                <span className="font-medium">{formatDuration(exportResult.duration)}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 pt-3 border-t">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{exportResult.itemCount.cards}</div>
                  <div className="text-sm text-gray-500">卡片</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{exportResult.itemCount.folders}</div>
                  <div className="text-sm text-gray-500">文件夹</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">{exportResult.itemCount.tags}</div>
                  <div className="text-sm text-gray-500">标签</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600">{exportResult.itemCount.images}</div>
                  <div className="text-sm text-gray-500">图片</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 导出选项 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            数据导出
          </CardTitle>
          <CardDescription>
            选择要导出的数据类型和格式
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 基本选项 */}
          <div className="space-y-4">
            <h4 className="font-semibold">基本选项</h4>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeImages"
                checked={exportOptions.includeImages}
                onCheckedChange={(checked) =>
                  setExportOptions(prev => ({ ...prev, includeImages: checked as boolean }))
                }
              />
              <Label htmlFor="includeImages" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                包含图片数据
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeSettings"
                checked={exportOptions.includeSettings}
                onCheckedChange={(checked) =>
                  setExportOptions(prev => ({ ...prev, includeSettings: checked as boolean }))
                }
              />
              <Label htmlFor="includeSettings" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                包含应用设置
              </Label>
            </div>
          </div>

          <Separator />

          {/* 搜索过滤 */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Search className="h-4 w-4" />
              搜索过滤
            </h4>
            <div className="flex items-center space-x-2">
              <Input
                placeholder="搜索卡片内容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          <Separator />

          {/* 文件夹过滤 */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Folder className="h-4 w-4" />
              文件夹过滤
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {folders.map((folder) => (
                <div key={folder.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`folder-${folder.id}`}
                    checked={selectedFolders.includes(folder.id)}
                    onCheckedChange={() => toggleFolder(folder.id)}
                  />
                  <Label
                    htmlFor={`folder-${folder.id}`}
                    className="flex-1 cursor-pointer flex items-center justify-between"
                  >
                    <span>{folder.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {folder.cardCount}
                    </Badge>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* 标签过滤 */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Tag className="h-4 w-4" />
              标签过滤
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`tag-${tag.id}`}
                    checked={selectedTags.includes(tag.id)}
                    onCheckedChange={() => toggleTag(tag.id)}
                  />
                  <Label
                    htmlFor={`tag-${tag.id}`}
                    className="flex-1 cursor-pointer flex items-center justify-between"
                  >
                    <span>{tag.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {tag.cardCount}
                    </Badge>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* 日期范围 */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              日期范围
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">开始日期</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="endDate">结束日期</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* 数据预览 */}
          {previewData && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  数据预览
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? '隐藏预览' : '显示预览'}
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{previewData.itemCount.cards}</div>
                  <div className="text-sm text-gray-500">卡片</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{previewData.itemCount.folders}</div>
                  <div className="text-sm text-gray-500">文件夹</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{previewData.itemCount.tags}</div>
                  <div className="text-sm text-gray-500">标签</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{previewData.itemCount.images}</div>
                  <div className="text-sm text-gray-500">图片</div>
                </div>
              </div>

              {showPreview && (
                <div className="space-y-3 mt-4">
                  <div>
                    <h5 className="font-medium mb-2">卡片示例</h5>
                    <div className="space-y-2">
                      {previewData.sampleData.cards.map((card: any, index: number) => (
                        <div key={index} className="p-3 border rounded-lg text-sm">
                          <div className="font-medium">{card.frontContent.title}</div>
                          <div className="text-gray-500 truncate">{card.frontContent.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* 导出按钮 */}
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => handleExport('csv')}
              disabled={isExporting || previewData?.itemCount.cards === 0}
              variant="outline"
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              导出为CSV
            </Button>
            <Button
              onClick={() => handleExport('json')}
              disabled={isExporting || previewData?.itemCount.cards === 0}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              导出为JSON
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}