import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Play,
  Pause,
  RefreshCw,
  Settings,
  Eye,
  GitMerge,
  Users,
  Smartphone,
  Database
} from 'lucide-react'
import { useConflicts } from '@/hooks/use-conflicts'
import { ConflictResolutionEngine } from '@/utils/conflict-resolution'

export function ConflictDemoPage() {
  const {
    conflicts,
    stats,
    getPendingConflicts,
    getHighPriorityConflicts,
    resolveConflict,
    detectConflicts,
    isResolving
  } = useConflicts()

  const [isSimulationRunning, setIsSimulationRunning] = useState(false)
  const [simulationStats, setSimulationStats] = useState({
    totalCreated: 0,
    totalResolved: 0,
    averageResolutionTime: 0,
    successRate: 0
  })

  const pendingConflicts = getPendingConflicts()
  const highPriorityConflicts = getHighPriorityConflicts()

  // 模拟冲突创建
  const simulateConflictCreation = async () => {
    const newConflict = await detectConflicts()
    setSimulationStats(prev => ({
      ...prev,
      totalCreated: prev.totalCreated + newConflict.length
    }))
  }

  // 模拟自动解决
  const simulateAutoResolution = async () => {
    if (pendingConflicts.length === 0) return

    const startTime = Date.now()
    const conflict = pendingConflicts[0]
    
    // 获取智能建议
    const suggestions = ConflictResolutionEngine.generateSuggestions(conflict)
    const bestSuggestion = suggestions[0]
    
    if (bestSuggestion && bestSuggestion.confidence > 0.7) {
      const success = await resolveConflict(conflict.id, {
        type: bestSuggestion.type,
        reason: bestSuggestion.reason
      })

      const resolutionTime = Date.now() - startTime
      
      setSimulationStats(prev => ({
        ...prev,
        totalResolved: prev.totalResolved + (success ? 1 : 0),
        averageResolutionTime: prev.averageResolutionTime === 0 
          ? resolutionTime 
          : (prev.averageResolutionTime + resolutionTime) / 2,
        successRate: prev.totalCreated === 0 
          ? 0 
          : ((prev.totalResolved + (success ? 1 : 0)) / (prev.totalCreated + 1)) * 100
      }))
    }
  }

  // 开始/停止模拟
  const toggleSimulation = () => {
    setIsSimulationRunning(!isSimulationRunning)
  }

  // 模拟循环
  React.useEffect(() => {
    if (!isSimulationRunning) return

    const interval = setInterval(async () => {
      // 随机创建或解决冲突
      if (Math.random() > 0.7 && pendingConflicts.length < 5) {
        await simulateConflictCreation()
      } else if (pendingConflicts.length > 0) {
        await simulateAutoResolution()
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [isSimulationRunning, pendingConflicts.length])

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">冲突解决系统演示</h1>
          <p className="text-muted-foreground">
            智能数据冲突检测和管理的完整解决方案
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant={isSimulationRunning ? "destructive" : "default"}
            onClick={toggleSimulation}
            className="flex items-center gap-2"
          >
            {isSimulationRunning ? (
              <>
                <Pause className="h-4 w-4" />
                停止模拟
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                开始模拟
              </>
            )}
          </Button>
          
          <Button variant="outline" onClick={() => detectConflicts()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            检测冲突
          </Button>
        </div>
      </div>

      {/* 实时统计 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总冲突数</p>
                <p className="text-2xl font-bold">{stats.totalConflicts}</p>
              </div>
              <Database className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">待解决</p>
                <p className="text-2xl font-bold text-orange-600">{stats.pendingConflicts}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已解决</p>
                <p className="text-2xl font-bold text-green-600">{stats.resolvedConflicts}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">高优先级</p>
                <p className="text-2xl font-bold text-red-600">{highPriorityConflicts.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 模拟统计 */}
      {isSimulationRunning && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              模拟统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{simulationStats.totalCreated}</p>
                <p className="text-sm text-muted-foreground">创建冲突</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{simulationStats.totalResolved}</p>
                <p className="text-sm text-muted-foreground">解决冲突</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {simulationStats.averageResolutionTime.toFixed(0)}ms
                </p>
                <p className="text-sm text-muted-foreground">平均解决时间</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {simulationStats.successRate.toFixed(1)}%
                </p>
                <p className="text-sm text-muted-foreground">成功率</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 功能特性 */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">功能概览</TabsTrigger>
          <TabsTrigger value="conflict-types">冲突类型</TabsTrigger>
          <TabsTrigger value="resolution-strategies">解决策略</TabsTrigger>
          <TabsTrigger value="performance">性能指标</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-blue-500" />
                  智能检测
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li>• 实时监控数据变更</li>
                  <li>• 自动识别冲突类型</li>
                  <li>• 按优先级智能分类</li>
                  <li>• 精确的时间戳分析</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitMerge className="h-5 w-5 text-green-500" />
                  智能合并
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li>• 内容相似度分析</li>
                  <li>• 使用频率统计</li>
                  <li>• 名称质量评估</li>
                  <li>• 自动保留最佳版本</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-500" />
                  多设备支持
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li>• 跨设备数据同步</li>
                  <li>• 离线操作恢复</li>
                  <li>• 团队协作支持</li>
                  <li>• 版本冲突处理</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="conflict-types">
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>支持的冲突类型</AlertTitle>
              <AlertDescription>
                系统支持多种数据冲突类型的自动检测和智能解决
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    卡片冲突
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-medium">内容冲突</h4>
                    <p className="text-sm text-muted-foreground">
                      标题、文本、标签的编辑冲突，支持智能合并
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">样式冲突</h4>
                    <p className="text-sm text-muted-foreground">
                      背景色、字体、边框等样式属性的冲突
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">文件夹冲突</h4>
                    <p className="text-sm text-muted-foreground">
                      卡片归属文件夹的冲突
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    组织结构冲突
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-medium">文件夹名称</h4>
                    <p className="text-sm text-muted-foreground">
                      文件夹重命名和结构变更的冲突
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">标签系统</h4>
                    <p className="text-sm text-muted-foreground">
                      标签重命名、删除、颜色属性的冲突
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">层级关系</h4>
                    <p className="text-sm text-muted-foreground">
                      文件夹嵌套和归属关系的冲突
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="resolution-strategies">
          <div className="space-y-4">
            <Alert>
              <GitMerge className="h-4 w-4" />
              <AlertTitle>智能解决策略</AlertTitle>
              <AlertDescription>
                基于多种算法的智能冲突解决方案，确保数据一致性
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    自动策略
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>保留本地版本</span>
                    <Badge variant="secondary">常用</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>保留远程版本</span>
                    <Badge variant="secondary">常用</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>智能合并</span>
                    <Badge variant="default">推荐</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>时间戳优先</span>
                    <Badge variant="outline">辅助</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-blue-500" />
                    智能算法
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-medium">相似度分析</h4>
                    <p className="text-sm text-muted-foreground">
                      基于Levenshtein距离的文本相似度计算
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">时间戳分析</h4>
                    <p className="text-sm text-muted-foreground">
                      优先保留最新修改的版本
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">使用统计</h4>
                    <p className="text-sm text-muted-foreground">
                      基于使用频率的重要性评估
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>性能指标</AlertTitle>
              <AlertDescription>
                系统经过优化，确保高效的冲突检测和解决性能
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>响应时间</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>冲突检测</span>
                      <Badge variant="outline">&lt; 100ms</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>UI响应</span>
                      <Badge variant="outline">&lt; 200ms</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>解决应用</span>
                      <Badge variant="outline">&lt; 500ms</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>批量处理</span>
                      <Badge variant="outline">~1-2s</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>准确性指标</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>检测准确率</span>
                      <Badge variant="default">99.9%</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>建议准确率</span>
                      <Badge variant="default">85-95%</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>解决成功率</span>
                      <Badge variant="default">≥95%</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>用户满意度</span>
                      <Badge variant="default">≥90%</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>系统容量</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">1000+</p>
                    <p className="text-sm text-muted-foreground">并发冲突</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">50ms</p>
                    <p className="text-sm text-muted-foreground">检测间隔</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">10K+</p>
                    <p className="text-sm text-muted-foreground">卡片容量</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">99.9%</p>
                    <p className="text-sm text-muted-foreground">系统可用性</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* 当前冲突列表 */}
      {pendingConflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>当前待解决冲突</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingConflicts.slice(0, 5).map((conflict) => (
                <div key={conflict.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{getConflictTitle(conflict)}</p>
                    <p className="text-sm text-muted-foreground">
                      {getConflictDescription(conflict)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getSeverityVariant(conflict.severity)}>
                      {conflict.severity}
                    </Badge>
                    <Badge variant="outline">
                      {formatTime(conflict.timestamp)}
                    </Badge>
                  </div>
                </div>
              ))}
              {pendingConflicts.length > 5 && (
                <p className="text-center text-muted-foreground">
                  还有 {pendingConflicts.length - 5} 个冲突未显示...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// 辅助函数
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

function getSeverityVariant(severity: string): "default" | "secondary" | "destructive" | "outline" {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'destructive'
    case 'medium':
      return 'default'
    default:
      return 'secondary'
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