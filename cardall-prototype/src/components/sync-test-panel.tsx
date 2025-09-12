import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Database, Cloud, RefreshCw, Play, Stop } from 'lucide-react'
import { cloudSyncService } from '@/services/cloud-sync'
import { authService } from '@/services/auth'
import { db } from '@/services/database'
import { runAllTests, testSupabaseConnection, testAuthStatus } from '@/services/supabase-test'

export function SyncTestPanel() {
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [authState, setAuthState] = useState<any>(null)
  const [localCards, setLocalCards] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  // 添加日志
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  // 监听同步状态
  useEffect(() => {
    const unsubscribe = cloudSyncService.onStatusChange((status) => {
      setSyncStatus(status)
      addLog(`Sync status changed: ${JSON.stringify(status)}`)
    })

    return unsubscribe
  }, [])

  // 监听认证状态
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((state) => {
      setAuthState(state)
      addLog(`Auth state changed: ${state.user ? 'Logged in' : 'Logged out'}`)
    })

    return unsubscribe
  }, [])

  // 加载本地卡片
  const loadLocalCards = async () => {
    setIsLoading(true)
    try {
      const cards = await db.cards.toArray()
      setLocalCards(cards)
      addLog(`Loaded ${cards.length} local cards`)
    } catch (error) {
      addLog(`Error loading local cards: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 手动触发同步
  const triggerSync = async () => {
    addLog('🔄 Manual sync triggered')
    try {
      await cloudSyncService.performFullSync()
      addLog('✅ Manual sync completed')
    } catch (error) {
      addLog(`❌ Manual sync failed: ${error}`)
    }
  }

  // 创建测试卡片
  const createTestCard = async () => {
    addLog('📝 Creating test card...')
    try {
      const testCard = {
        frontContent: {
          title: 'Test Card',
          text: 'This is a test card for sync validation',
          images: [],
          tags: ['test', 'sync'],
          lastModified: new Date()
        },
        backContent: {
          title: 'Test Card Back',
          text: 'Back content for testing',
          images: [],
          tags: [],
          lastModified: new Date()
        },
        style: {
          type: 'solid' as const,
          backgroundColor: '#3b82f6',
          textColor: '#ffffff'
        },
        isFlipped: false
      }

      // 使用dispatch来创建卡片，确保同步被触发
      // 这里直接调用数据库操作来模拟
      const newCard = {
        ...testCard,
        id: `test_${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncVersion: 1,
        pendingSync: true
      }

      await db.cards.add(newCard)
      addLog('📝 Test card created locally')
      
      // 手动触发同步操作
      await cloudSyncService.queueOperation({
        type: 'create',
        table: 'cards',
        data: newCard,
        localId: newCard.id
      })
      
      addLog('🔄 Sync operation queued')
      await loadLocalCards()
    } catch (error) {
      addLog(`❌ Error creating test card: ${error}`)
    }
  }

  // 检查云端数据
  const checkCloudData = async () => {
    addLog('☁️ Checking cloud data...')
    try {
      const user = authService.getCurrentUser()
      if (!user) {
        addLog('❌ No authenticated user')
        return
      }

      const { data, error } = await cloudSyncService['supabase']
        .from('cards')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)

      if (error) {
        addLog(`❌ Error fetching cloud data: ${error.message}`)
        return
      }

      addLog(`☁️ Found ${data?.length || 0} cards in cloud`)
      if (data && data.length > 0) {
        data.forEach((card, index) => {
          addLog(`☁️ Cloud card ${index + 1}: ${card.front_content?.title || 'No title'}`)
        })
      }
    } catch (error) {
      addLog(`❌ Error checking cloud data: ${error}`)
    }
  }

  // 清除日志
  const clearLogs = () => {
    setLogs([])
  }

  // 测试Supabase连接
  const testSupabase = async () => {
    addLog('🧪 Testing Supabase connection...')
    try {
      const results = await runAllTests()
      addLog(`📊 Connection test: ${results.connection ? '✅' : '❌'}`)
      addLog(`📊 Auth test: ${results.auth ? '✅' : '❌'}`)
      addLog(`📊 Schema test: ${results.schema ? '✅' : '❌'}`)
      
      if (results.auth && results.auth.user) {
        addLog(`👤 Current user: ${results.auth.user.email}`)
      }
    } catch (error) {
      addLog(`❌ Supabase test failed: ${error}`)
    }
  }

  // 检查认证状态
  const checkAuthStatus = async () => {
    addLog('🔍 Checking authentication status...')
    try {
      const session = await testAuthStatus()
      if (session) {
        addLog(`✅ User authenticated: ${session.user?.email}`)
      } else {
        addLog('❌ No active session')
      }
    } catch (error) {
      addLog(`❌ Auth check failed: ${error}`)
    }
  }

  // 初始化时加载数据
  useEffect(() => {
    loadLocalCards()
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">同步测试面板</h1>
        <div className="flex gap-2">
          <Button onClick={loadLocalCards} disabled={isLoading} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新本地数据
          </Button>
          <Button onClick={clearLogs} size="sm" variant="outline">
            清除日志
          </Button>
        </div>
      </div>

      {/* 状态概览 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 认证状态 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              认证状态
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>登录状态:</span>
              <Badge variant={authState?.user ? "default" : "destructive"}>
                {authState?.user ? '已登录' : '未登录'}
              </Badge>
            </div>
            {authState?.user && (
              <>
                <div className="text-sm text-muted-foreground">
                  用户: {authState.user.username || authState.user.email}
                </div>
                <div className="text-sm text-muted-foreground">
                  ID: {authState.user.id}
                </div>
              </>
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
                  <Badge variant={syncStatus.syncInProgress ? "default" : "secondary"}>
                    {syncStatus.syncInProgress ? '同步中' : '空闲'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>待同步操作:</span>
                  <Badge variant="outline">{syncStatus.pendingOperations}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>本地卡片:</span>
                  <Badge variant="secondary">{localCards.length}</Badge>
                </div>
              </>
            ) : (
              <div>加载中...</div>
            )}
          </CardContent>
        </Card>

        {/* 测试操作 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              测试操作
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={createTestCard} className="w-full" size="sm">
              创建测试卡片
            </Button>
            <Button onClick={triggerSync} className="w-full" size="sm">
              手动同步
            </Button>
            <Button onClick={checkCloudData} className="w-full" size="sm" variant="outline">
              检查云端数据
            </Button>
            <Button onClick={testSupabase} className="w-full" size="sm" variant="outline">
              测试Supabase连接
            </Button>
            <Button onClick={checkAuthStatus} className="w-full" size="sm" variant="outline">
              检查认证状态
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 日志输出 */}
      <Card>
        <CardHeader>
          <CardTitle>同步日志</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">暂无日志...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 本地卡片详情 */}
      {localCards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>本地卡片详情</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {localCards.slice(0, 5).map((card) => (
                <div key={card.id} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <div className="font-medium">{card.frontContent.title}</div>
                    <div className="text-sm text-muted-foreground">
                      ID: {card.id} | 同步版本: {card.syncVersion} | 待同步: {card.pendingSync ? '是' : '否'}
                    </div>
                  </div>
                  <Badge variant={card.pendingSync ? "destructive" : "secondary"}>
                    {card.pendingSync ? '待同步' : '已同步'}
                  </Badge>
                </div>
              ))}
              {localCards.length > 5 && (
                <div className="text-center text-muted-foreground">
                  还有 {localCards.length - 5} 张卡片...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}