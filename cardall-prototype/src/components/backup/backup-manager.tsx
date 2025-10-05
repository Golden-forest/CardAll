/**
 * 备份管理器组件 (Backup Manager)
 * 
 * 提供完整的本地备份管理功能界面
 * - 自动备份配置
 * - 数据导入导出
 * - 备份列表管理
 * - 数据完整性检查
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  enhancedLocalBackupService,
  type BackupStatistics,
  type BackupMetadata,
  type ImportResult,
  type IntegrityCheckResult
} from '@/services/enhanced-local-backup-service'
import { 
  Download, 
  Upload, 
  Settings, 
  RefreshCw, 
  Trash2, 
  Shield, 
  Clock,
  Database,
  CheckCircle,
  AlertCircle,
  FileText,
  Save,
  Play,
  Pause
} from 'lucide-react'

interface BackupManagerProps {
  className?: string
}

export function BackupManager({ className }: BackupManagerProps) {
  // 状态管理
  const [statistics, setStatistics] = useState<BackupStatistics | null>(null)
  const [backupList, setBackupList] = useState<BackupMetadata[]>([])
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [backupProgress, setBackupProgress] = useState(0)
  const [isRunningIntegrityCheck, setIsRunningIntegrityCheck] = useState(false)
  const [integrityResult, setIntegrityResult] = useState<IntegrityCheckResult | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [config, setConfig] = useState<any>(null)
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false)

  // 文件上传相关
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      const [stats, backups, backupConfig] = await Promise.all([
        enhancedLocalBackupService.getBackupStatistics(),
        enhancedLocalBackupService.getBackupList(),
        enhancedLocalBackupService.getConfig()
      ])

      setStatistics(stats)
      setBackupList(backups)
      setConfig(backupConfig)
    } catch (error) {
      console.error('Failed to load backup data:', error)
    }
  }, [])

  // 组件初始化
  useEffect(() => {
    loadData()
  }, [loadData])

  // 创建手动备份
  const handleCreateManualBackup = async () => {
    setIsCreatingBackup(true)
    setBackupProgress(0)

    try {
      const backupId = await enhancedLocalBackupService.createManualBackup({
        name: `ManualBackup_${new Date().toISOString().split('T')[0]}`,
        description: '手动创建的备份'
      })

      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setBackupProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 100
          }
          return prev + 10
        })
      }, 200)

      setTimeout(() => {
        clearInterval(progressInterval)
        setBackupProgress(100)
        setIsCreatingBackup(false)
        loadData()
      }, 2000)

    } catch (error) {
      console.error('Failed to create backup:', error)
      setIsCreatingBackup(false)
      setBackupProgress(0)
    }
  }

  // 运行数据完整性检查
  const handleRunIntegrityCheck = async () => {
    setIsRunningIntegrityCheck(true)

    try {
      const result = await enhancedLocalBackupService.runIntegrityCheck()
      setIntegrityResult(result)
      loadData()
    } catch (error) {
      console.error('Integrity check failed:', error)
    } finally {
      setIsRunningIntegrityCheck(false)
    }
  }

  // 导出数据
  const handleExportData = async (options: any = {}) => {
    try {
      await enhancedLocalBackupService.exportDataAsJSON(options)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  // 文件导入
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const result = await enhancedLocalBackupService.importDataFromJSON(file, {
        strategy: 'merge',
        importImages: true,
        importSettings: true,
        preserveIds: false,
        validateData: true,
        createBackup: true,
        selectedTypes: ['cards', 'folders', 'tags', 'images', 'settings']
      })

      setImportResult(result)
      loadData()

      // 清空文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

    } catch (error) {
      console.error('Import failed:', error)
      setImportResult({
        success: false,
        totalItems: 0,
        importedItems: { cards: 0, folders: 0, tags: 0, images: 0, settings: 0 },
        skippedItems: { cards: 0, folders: 0, tags: 0, images: 0 },
        errors: [error instanceof Error ? error.message : '导入失败'],
        warnings: [],
        duration: 0
      })
    }
  }

  // 删除备份
  const handleDeleteBackup = async (backupId: string) => {
    if (!confirm('确定要删除这个备份吗？此操作无法撤销。')) {
      return
    }

    try {
      await enhancedLocalBackupService.deleteBackup(backupId)
      loadData()
    } catch (error) {
      console.error('Failed to delete backup:', error)
    }
  }

  // 恢复备份
  const handleRestoreBackup = async (backupId: string) => {
    if (!confirm('确定要恢复这个备份吗？这将替换当前所有数据。建议先创建当前数据的备份。')) {
      return
    }

    try {
      await enhancedLocalBackupService.restoreBackup(backupId)
      loadData()
      alert('备份恢复成功！')
    } catch (error) {
      console.error('Failed to restore backup:', error)
      alert('备份恢复失败，请检查控制台错误信息。')
    }
  }

  // 导出备份文件
  const handleExportBackup = async (backupId: string) => {
    try {
      await enhancedLocalBackupService.exportBackup(backupId)
    } catch (error) {
      console.error('Failed to export backup:', error)
    }
  }

  // 更新配置
  const handleUpdateConfig = async (newConfig: any) => {
    try {
      await enhancedLocalBackupService.updateConfig(newConfig)
      setConfig(newConfig)
      setIsConfigDialogOpen(false)
      loadData()
    } catch (error) {
      console.error('Failed to update config:', error)
    }
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 格式化日期
  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString('zh-CN')
  }

  // 获取严重程度颜色
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50'
      case 'error': return 'text-red-500 bg-red-50'
      case 'warning': return 'text-yellow-600 bg-yellow-50'
      case 'info': return 'text-blue-600 bg-blue-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 统计信息卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总备份数</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.totalBackups || 0}</div>
            <p className="text-xs text-muted-foreground">
              自动备份: {statistics?.autoBackups || 0} | 手动备份: {statistics?.manualBackups || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">存储使用量</CardTitle>
            <Save className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatFileSize(statistics?.storageUsage || 0)}</div>
            <p className="text-xs text-muted-foreground">
              总计: {formatFileSize(statistics?.storageQuota || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">完整性问题</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.integrityIssues || 0}</div>
            <p className="text-xs text-muted-foreground">
              最后检查: {statistics?.lastIntegrityCheck ? formatDate(statistics.lastIntegrityCheck) : '从未'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">最后备份</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics?.lastBackupTime ? formatDate(statistics.lastBackupTime) : '无'}
            </div>
            <p className="text-xs text-muted-foreground">
              系统状态: 正常
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 主要功能区域 */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="backups">备份管理</TabsTrigger>
          <TabsTrigger value="import-export">导入导出</TabsTrigger>
          <TabsTrigger value="integrity">完整性检查</TabsTrigger>
          <TabsTrigger value="settings">设置</TabsTrigger>
        </TabsList>

        {/* 概览页面 */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 快速操作 */}
            <Card>
              <CardHeader>
                <CardTitle>快速操作</CardTitle>
                <CardDescription>常用的备份和数据管理操作</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button 
                    onClick={handleCreateManualBackup}
                    disabled={isCreatingBackup}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {isCreatingBackup ? '创建中...' : '创建备份'}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    导入数据
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => handleExportData()}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    导出数据
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={handleRunIntegrityCheck}
                    disabled={isRunningIntegrityCheck}
                    className="flex items-center gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    {isRunningIntegrityCheck ? '检查中...' : '完整性检查'}
                  </Button>
                </div>

                {isCreatingBackup && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>备份进度</span>
                      <span>{backupProgress}%</span>
                    </div>
                    <Progress value={backupProgress} className="w-full" />
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </CardContent>
            </Card>

            {/* 最近活动 */}
            <Card>
              <CardHeader>
                <CardTitle>最近活动</CardTitle>
                <CardDescription>系统最近的备份和检查活动</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {statistics?.lastBackupTime && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          最后备份
                        </span>
                        <span className="text-muted-foreground">
                          {formatDate(statistics.lastBackupTime)}
                        </span>
                      </div>
                    )}
                    
                    {statistics?.lastIntegrityCheck && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-500" />
                          完整性检查
                        </span>
                        <span className="text-muted-foreground">
                          {formatDate(statistics.lastIntegrityCheck)}
                        </span>
                      </div>
                    )}
                    
                    {integrityResult && (
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <div className="text-sm font-medium mb-2">最后检查结果</div>
                        <div className="text-xs space-y-1">
                          <div>总问题数: {integrityResult.summary.totalIssues}</div>
                          <div>严重问题: {integrityResult.summary.criticalIssues}</div>
                          <div>自动修复: {integrityResult.autoFixed}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* 导入结果 */}
          {importResult && (
            <Alert className={importResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertTitle className="flex items-center gap-2">
                {importResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                {importResult.success ? '导入成功' : '导入失败'}
              </AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-2">
                  <div className="text-sm">
                    总计: {importResult.totalItems} 项，导入: {
                      Object.values(importResult.importedItems).reduce((a, b) => a + b, 0)
                    } 项，跳过: {
                      Object.values(importResult.skippedItems).reduce((a, b) => a + b, 0)
                    } 项
                  </div>
                  
                  {importResult.errors.length > 0 && (
                    <div className="mt-2">
                      <div className="font-medium text-red-600">错误:</div>
                      <ul className="text-sm text-red-600 list-disc list-inside">
                        {importResult.errors.slice(0, 3).map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                        {importResult.errors.length > 3 && (
                          <li>... 还有 {importResult.errors.length - 3} 个错误</li>
                        )}
                      </ul>
                    </div>
                  )}
                  
                  {importResult.warnings.length > 0 && (
                    <div className="mt-2">
                      <div className="font-medium text-yellow-600">警告:</div>
                      <ul className="text-sm text-yellow-600 list-disc list-inside">
                        {importResult.warnings.slice(0, 3).map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                        {importResult.warnings.length > 3 && (
                          <li>... 还有 {importResult.warnings.length - 3} 个警告</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* 备份管理页面 */}
        <TabsContent value="backups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>备份列表</CardTitle>
              <CardDescription>管理所有本地备份文件</CardDescription>
            </CardHeader>
            <CardContent>
              {backupList.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">暂无备份</h3>
                  <p className="text-muted-foreground">创建您的第一个备份来保护数据安全</p>
                  <Button onClick={handleCreateManualBackup} className="mt-4">
                    创建备份
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名称</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>大小</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backupList.map((backup) => (
                      <TableRow key={backup.id}>
                        <TableCell className="font-medium">
                          <div>
                            <div>{backup.name}</div>
                            {backup.description && (
                              <div className="text-sm text-muted-foreground">
                                {backup.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(backup.createdAt)}</TableCell>
                        <TableCell>{formatFileSize(backup.size)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {backup.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            正常
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleExportBackup(backup.id)}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestoreBackup(backup.id)}
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteBackup(backup.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 导入导出页面 */}
        <TabsContent value="import-export" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 数据导出 */}
            <Card>
              <CardHeader>
                <CardTitle>数据导出</CardTitle>
                <CardDescription>将数据导出为 JSON 文件</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label>导出选项</Label>
                    <div className="mt-2 space-y-2">
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked />
                        <span className="text-sm">包含卡片</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked />
                        <span className="text-sm">包含文件夹</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked />
                        <span className="text-sm">包含标签</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked />
                        <span className="text-sm">包含图片</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked />
                        <span className="text-sm">包含设置</span>
                      </label>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="export-filename">文件名（可选）</Label>
                    <Input
                      id="export-filename"
                      placeholder="CardAll_Export"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={() => handleExportData()}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  导出数据
                </Button>
              </CardContent>
            </Card>

            {/* 数据导入 */}
            <Card>
              <CardHeader>
                <CardTitle>数据导入</CardTitle>
                <CardDescription>从 JSON 文件导入数据</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label>导入策略</Label>
                    <Select defaultValue="merge">
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="replace">替换现有数据</SelectItem>
                        <SelectItem value="merge">合并到现有数据</SelectItem>
                        <SelectItem value="skip-existing">跳过已存在项目</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">导入图片</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">导入设置</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">验证数据完整性</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">导入前创建备份</span>
                    </label>
                  </div>
                </div>
                
                <Button 
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  选择文件导入
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  支持 JSON 格式的数据文件，建议使用 CardAll 导出的文件格式
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 完整性检查页面 */}
        <TabsContent value="integrity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>数据完整性检查</CardTitle>
              <CardDescription>检查本地数据的一致性和完整性</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">完整性检查状态</h3>
                  <p className="text-sm text-muted-foreground">
                    {statistics?.lastIntegrityCheck 
                      ? `最后检查: ${formatDate(statistics.lastIntegrityCheck)}`
                      : '从未运行检查'
                    }
                  </p>
                </div>
                <Button 
                  onClick={handleRunIntegrityCheck}
                  disabled={isRunningIntegrityCheck}
                >
                  {isRunningIntegrityCheck ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      检查中...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      运行检查
                    </>
                  )}
                </Button>
              </div>

              {integrityResult && (
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{integrityResult.summary.totalIssues}</div>
                      <div className="text-sm text-muted-foreground">总问题数</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{integrityResult.summary.criticalIssues}</div>
                      <div className="text-sm text-red-600">严重问题</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">{integrityResult.summary.errorIssues}</div>
                      <div className="text-sm text-yellow-600">错误问题</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{integrityResult.autoFixed}</div>
                      <div className="text-sm text-green-600">自动修复</div>
                    </div>
                  </div>

                  {integrityResult.issues.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">发现的问题</h4>
                      <ScrollArea className="h-48">
                        <div className="space-y-2">
                          {integrityResult.issues.slice(0, 10).map((issue) => (
                            <div key={issue.id} className="p-3 bg-muted rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge className={getSeverityColor(issue.severity)}>
                                    {issue.severity}
                                  </Badge>
                                  <span className="font-medium">{issue.title}</span>
                                </div>
                                {issue.autoFixable && (
                                  <Badge variant="outline" className="text-green-600">
                                    可自动修复
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {issue.description}
                              </p>
                            </div>
                          ))}
                          {integrityResult.issues.length > 10 && (
                            <p className="text-sm text-muted-foreground text-center">
                              还有 {integrityResult.issues.length - 10} 个问题未显示
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {integrityResult.recommendations.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">改进建议</h4>
                      <ul className="space-y-1">
                        {integrityResult.recommendations.map((recommendation, index) => (
                          <li key={index} className="text-sm flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <span>{recommendation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 设置页面 */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>备份设置</CardTitle>
              <CardDescription>配置自动备份和完整性检查选项</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {config && (
                <>
                  {/* 自动备份设置 */}
                  <div className="space-y-4">
                    <h3 className="font-medium">自动备份</h3>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-backup">启用自动备份</Label>
                      <Switch
                        id="auto-backup"
                        checked={config.autoBackupEnabled}
                        onCheckedChange={(checked) => 
                          handleUpdateConfig({ ...config, autoBackupEnabled: checked })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="backup-interval">备份间隔（小时）</Label>
                        <Input
                          id="backup-interval"
                          type="number"
                          value={config.autoBackupInterval / (60 * 60 * 1000)}
                          onChange={(e) => 
                            handleUpdateConfig({ 
                              ...config, 
                              autoBackupInterval: parseInt(e.target.value) * 60 * 60 * 1000 
                            })
                          }
                          min="1"
                          max="168"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="max-backups">最大备份数量</Label>
                        <Input
                          id="max-backups"
                          type="number"
                          value={config.maxAutoBackups}
                          onChange={(e) => 
                            handleUpdateConfig({ ...config, maxAutoBackups: parseInt(e.target.value) })
                          }
                          min="1"
                          max="30"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 完整性检查设置 */}
                  <div className="space-y-4">
                    <h3 className="font-medium">完整性检查</h3>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="integrity-check">启用完整性检查</Label>
                      <Switch
                        id="integrity-check"
                        checked={config.integrityCheckEnabled}
                        onCheckedChange={(checked) => 
                          handleUpdateConfig({ ...config, integrityCheckEnabled: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-fix">自动修复问题</Label>
                      <Switch
                        id="auto-fix"
                        checked={config.autoFixIntegrityIssues}
                        onCheckedChange={(checked) => 
                          handleUpdateConfig({ ...config, autoFixIntegrityIssues: checked })
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="check-interval">检查间隔（小时）</Label>
                      <Input
                        id="check-interval"
                        type="number"
                        value={config.integrityCheckInterval / (60 * 60 * 1000)}
                        onChange={(e) => 
                          handleUpdateConfig({ 
                            ...config, 
                            integrityCheckInterval: parseInt(e.target.value) * 60 * 60 * 1000 
                          })
                        }
                        min="1"
                        max="168"
                      />
                    </div>
                  </div>

                  {/* 存储设置 */}
                  <div className="space-y-4">
                    <h3 className="font-medium">存储管理</h3>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="cleanup-old">清理旧备份</Label>
                      <Switch
                        id="cleanup-old"
                        checked={config.cleanupOldBackups}
                        onCheckedChange={(checked) => 
                          handleUpdateConfig({ ...config, cleanupOldBackups: checked })
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="retention-days">保留天数</Label>
                      <Input
                        id="retention-days"
                        type="number"
                        value={config.backupRetentionDays}
                        onChange={(e) => 
                          handleUpdateConfig({ ...config, backupRetentionDays: parseInt(e.target.value) })
                        }
                        min="1"
                        max="365"
                      />
                    </div>

                    <div>
                      <Label htmlFor="storage-limit">存储限制（MB）</Label>
                      <Input
                        id="storage-limit"
                        type="number"
                        value={config.maxBackupStorageSize / (1024 * 1024)}
                        onChange={(e) => 
                          handleUpdateConfig({ 
                            ...config, 
                            maxBackupStorageSize: parseInt(e.target.value) * 1024 * 1024 
                          })
                        }
                        min="10"
                        max="1000"
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}