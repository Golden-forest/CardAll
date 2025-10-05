import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Download,
  Upload,
  Trash2,
  Settings,
  Clock,
  Database,
  AlertCircle,
  CheckCircle,
  Calendar,
  HardDrive,
  Shield,
  Plus
} from 'lucide-react'
import { simpleBackupService } from '@/services/simple-backup-service'
import { BackupMetadata, BackupProgress } from '@/types/backup'

export const BackupPanel: React.FC = () => {
  const [backups, setBackups] = useState<BackupMetadata[]>([])
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [backupProgress, setBackupProgress] = useState<BackupProgress | null>(null)
  const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [backupList, backupStats] = await Promise.all([
        simpleBackupService.getBackupList(),
        simpleBackupService.getBackupStorageStats()
      ])

      setBackups(backupList)
      setStats(backupStats)
    } catch (error) {
      console.error('加载数据失败:', error)
      setError('加载数据失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const createBackup = async (options = {
    includeImages: true,
    includeSettings: true,
    compress: false,
    encrypt: false
  }) => {
    try {
      setIsCreatingBackup(true)
      setError(null)

      const backupId = await simpleBackupService.createBackup(options, (progress) => {
        setBackupProgress(progress)
      })

      console.log(`备份创建成功: ${backupId}`)
      await loadData() // 刷新列表
    } catch (error) {
      console.error('创建备份失败:', error)
      setError('创建备份失败，请重试')
    } finally {
      setIsCreatingBackup(false)
      setBackupProgress(null)
    }
  }

  const deleteBackup = async (backupId: string) => {
    if (!confirm('确定要删除这个备份吗？此操作不可恢复。')) {
      return
    }

    try {
      await simpleBackupService.deleteBackup(backupId)
      await loadData()
    } catch (error) {
      console.error('删除备份失败:', error)
      setError('删除备份失败，请重试')
    }
  }

  const exportBackup = async (backupId: string) => {
    try {
      await simpleBackupService.exportBackup(backupId)
    } catch (error) {
      console.error('导出备份失败:', error)
      setError('导出备份失败，请重试')
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date))
  }

  const getStatusBadge = (backup: BackupMetadata) => {
    if (backup.isAutoBackup) {
      return <Badge variant="secondary">自动备份</Badge>
    }
    return <Badge variant="outline">手动备份</Badge>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Database className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
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

      {/* 备份进度 */}
      {backupProgress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              正在创建备份
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Progress value={backupProgress.progress} className="h-2" />
              <div className="flex justify-between text-sm text-gray-600">
                <span>{backupProgress.message}</span>
                <span>{backupProgress.progress}%</span>
              </div>
              {backupProgress.estimatedTimeRemaining !== undefined && (
                <div className="text-sm text-gray-500">
                  预计剩余时间: {backupProgress.estimatedTimeRemaining}秒
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 存储统计 */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              存储统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalBackups}</div>
                <div className="text-sm text-gray-500">总备份数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{formatFileSize(stats.totalSize)}</div>
                <div className="text-sm text-gray-500">总大小</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.manualBackupCount}</div>
                <div className="text-sm text-gray-500">手动备份</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.compressionRatio.toFixed(2)}x</div>
                <div className="text-sm text-gray-500">压缩比</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 备份操作区 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              备份管理
            </span>
            <Button
              onClick={() => createBackup()}
              disabled={isCreatingBackup}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              创建备份
            </Button>
          </CardTitle>
          <CardDescription>
            管理您的数据备份，确保重要信息安全存储
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32">
              <Database className="h-12 w-12 text-gray-400 mb-2" />
              <p className="text-gray-500">暂无备份</p>
              <p className="text-sm text-gray-400">点击"创建备份"开始</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {backups.map((backup) => (
                <Card key={backup.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{backup.name}</CardTitle>
                        {backup.description && (
                          <CardDescription>{backup.description}</CardDescription>
                        )}
                        <div className="flex items-center gap-2">
                          {getStatusBadge(backup)}
                          <span className="text-sm text-gray-500">
                            {formatDate(backup.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {backup.isCompressed && <Shield className="h-4 w-4 text-green-500" />}
                        {backup.encryptionEnabled && <Shield className="h-4 w-4 text-blue-500" />}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">卡片:</span>
                        <span className="ml-1 font-medium">{backup.cardCount}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">文件夹:</span>
                        <span className="ml-1 font-medium">{backup.folderCount}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">标签:</span>
                        <span className="ml-1 font-medium">{backup.tagCount}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">大小:</span>
                        <span className="ml-1 font-medium">{formatFileSize(backup.compressedSize)}</span>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedBackup(backup)}
                          >
                            查看详情
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{backup.name}</DialogTitle>
                          </DialogHeader>
                          {selectedBackup && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-semibold mb-2">基本信息</h4>
                                  <div className="space-y-1 text-sm">
                                    <div><span className="text-gray-500">创建时间:</span> {formatDate(selectedBackup.createdAt)}</div>
                                    <div><span className="text-gray-500">版本:</span> {selectedBackup.version}</div>
                                    <div><span className="text-gray-500">类型:</span> {selectedBackup.isAutoBackup ? '自动备份' : '手动备份'}</div>
                                  </div>
                                </div>
                                <div>
                                  <h4 className="font-semibold mb-2">数据统计</h4>
                                  <div className="space-y-1 text-sm">
                                    <div><span className="text-gray-500">卡片:</span> {selectedBackup.cardCount}</div>
                                    <div><span className="text-gray-500">文件夹:</span> {selectedBackup.folderCount}</div>
                                    <div><span className="text-gray-500">标签:</span> {selectedBackup.tagCount}</div>
                                    <div><span className="text-gray-500">图片:</span> {selectedBackup.imageCount}</div>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <h4 className="font-semibold mb-2">技术信息</h4>
                                <div className="space-y-1 text-sm">
                                  <div><span className="text-gray-500">原始大小:</span> {formatFileSize(selectedBackup.size)}</div>
                                  <div><span className="text-gray-500">压缩后大小:</span> {formatFileSize(selectedBackup.compressedSize)}</div>
                                  <div><span className="text-gray-500">校验和:</span> {selectedBackup.checksum.substring(0, 16)}...</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportBackup(backup.id)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteBackup(backup.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}