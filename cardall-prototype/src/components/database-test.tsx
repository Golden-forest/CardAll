import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Database, HardDrive, Cloud, RefreshCw } from 'lucide-react'
import { db } from '@/services/database'
import { cloudSyncService } from '@/services/cloud-sync'
import { fileSystemService } from '@/services/file-system'
import { migrationService } from '@/services/migration'

export function DatabaseTest() {
  const [stats, setStats] = useState<any>(null)
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [storageStats, setStorageStats] = useState<any>(null)
  const [migrationStatus, setMigrationStatus] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadStats = async () => {
    setIsLoading(true)
    try {
      const [dbStats, syncStat, storageStat, migrationStat] = await Promise.all([
        db.getStats(),
        cloudSyncService.getCurrentStatus(),
        fileSystemService.getStorageStats(),
        migrationService.getMigrationStatus()
      ])

      setStats(dbStats)
      setSyncStatus(syncStat)
      setStorageStats(storageStat)
      setMigrationStatus(migrationStat)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const testMigration = async () => {
    try {
      const result = await migrationService.migrateFromLocalStorage()
      console.log('Migration result:', result)
      await loadStats()
    } catch (error) {
      console.error('Migration test failed:', error)
    }
  }

  const testSync = async () => {
    try {
      await cloudSyncService.performFullSync()
      await loadStats()
    } catch (error) {
      console.error('Sync test failed:', error)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">数据库测试面板</h1>
        <Button onClick={loadStats} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 数据库统计 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              数据库统计
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats ? (
              <>
                <div className="flex justify-between">
                  <span>卡片数量:</span>
                  <Badge variant="secondary">{stats.cards}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>文件夹数量:</span>
                  <Badge variant="secondary">{stats.folders}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>标签数量:</span>
                  <Badge variant="secondary">{stats.tags}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>图片数量:</span>
                  <Badge variant="secondary">{stats.images}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>待同步项目:</span>
                  <Badge variant="outline">{stats.pendingSync}</Badge>
                </div>
              </>
            ) : (
              <div>加载中...</div>
            )}
          </CardContent>
        </Card>

        {/* 同步状态 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              同步状态
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {syncStatus ? (
              <>
                <div className="flex justify-between">
                  <span>网络状态:</span>
                  <Badge variant={syncStatus.isOnline ? "default" : "destructive"}>
                    {syncStatus.isOnline ? '在线' : '离线'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>同步状态:</span>
                  <Badge variant={syncStatus.isSyncing ? "default" : "secondary"}>
                    {syncStatus.isSyncing ? '同步中' : '空闲'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>待同步操作:</span>
                  <Badge variant="outline">{syncStatus.pendingOperations}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>失败操作:</span>
                  <Badge variant="destructive">{syncStatus.failedOperations}</Badge>
                </div>
                {syncStatus.lastSyncAt && (
                  <div className="text-xs text-muted-foreground">
                    上次同步: {new Date(syncStatus.lastSyncAt).toLocaleString()}
                  </div>
                )}
                <Button onClick={testSync} size="sm" className="w-full">
                  测试同步
                </Button>
              </>
            ) : (
              <div>加载中...</div>
            )}
          </CardContent>
        </Card>

        {/* 存储统计 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              存储统计
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {storageStats ? (
              <>
                <div className="flex justify-between">
                  <span>图片总数:</span>
                  <Badge variant="secondary">{storageStats.totalImages}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>总大小:</span>
                  <Badge variant="secondary">
                    {(storageStats.totalSize / 1024 / 1024).toFixed(2)} MB
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>存储模式:</span>
                  <Badge variant={storageStats.storageMode === 'filesystem' ? "default" : "outline"}>
                    {storageStats.storageMode === 'filesystem' ? '文件系统' : 'IndexedDB'}
                  </Badge>
                </div>
              </>
            ) : (
              <div>加载中...</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 迁移状态 */}
      {migrationStatus && (
        <Card>
          <CardHeader>
            <CardTitle>数据迁移状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {migrationStatus.hasLegacyData ? '是' : '否'}
                </div>
                <div className="text-sm text-muted-foreground">有旧数据</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {migrationStatus.hasMigratedData ? '是' : '否'}
                </div>
                <div className="text-sm text-muted-foreground">已迁移数据</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {migrationStatus.migrationNeeded ? '是' : '否'}
                </div>
                <div className="text-sm text-muted-foreground">需要迁移</div>
              </div>
              <div className="text-center">
                <Button onClick={testMigration} size="sm">
                  测试迁移
                </Button>
              </div>
            </div>

            {migrationStatus.migrationNeeded && (
              <Alert>
                <AlertDescription>
                  检测到需要迁移的数据，建议执行数据迁移以使用新的存储系统。
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}