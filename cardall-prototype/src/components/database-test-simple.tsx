import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Database, RefreshCw } from 'lucide-react'
import { db } from '@/services/database'

export function SimpleDatabaseTest() {
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadStats = async () => {
    setIsLoading(true)
    try {
      const dbStats = await db.getStats()
      setStats(dbStats)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">数据库测试面板 (简化版)</h1>
        <Button onClick={loadStats} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              </>
            ) : (
              <div>加载中...</div>
            )}
          </CardContent>
        </Card>

        {/* 系统状态 */}
        <Card>
          <CardHeader>
            <CardTitle>系统状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>数据库状态:</span>
              <Badge variant="default">正常</Badge>
            </div>
            <div className="flex justify-between">
              <span>存储模式:</span>
              <Badge variant="outline">IndexedDB</Badge>
            </div>
            <div className="flex justify-between">
              <span>版本:</span>
              <Badge variant="secondary">简化版 1.0</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}