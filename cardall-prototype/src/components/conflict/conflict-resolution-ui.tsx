import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  GitMerge,
  Users,
  Brain,
  Activity,
  TrendingUp,
  RefreshCw,
  Settings,
  Eye,
  EyeOff,
  Info,
  Shield,
  Database,
  Network
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ConflictInfo,
  ConflictType,
  ResolutionType,
  ConflictAnalysis,
  ResolutionResult,
  RiskLevel,
  ConflictData
} from '@/services/conflict/conflict-resolution-engine'

interface ConflictResolutionUIProps {
  conflicts: ConflictInfo[]
  onResolveConflict: (conflictId: string, resolutionType: ResolutionType) => Promise<void>
  onAnalyzeConflict: (conflictId: string) => Promise<ConflictAnalysis>
  className?: string
}

/**
 * 冲突解决UI组件
 * 提供冲突检测、分析和解决的完整用户界面
 */
export function ConflictResolutionUI({
  conflicts,
  onResolveConflict,
  onAnalyzeConflict,
  className
}: ConflictResolutionUIProps) {
  const [selectedConflict, setSelectedConflict] = useState<ConflictInfo | null>(null)
  const [analysis, setAnalysis] = useState<ConflictAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [showResolved, setShowResolved] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // 未解决的冲突
  const unresolvedConflicts = conflicts.filter(c => c.status === 'pending')
  // 已解决的冲突
  const resolvedConflicts = conflicts.filter(c => c.status === 'resolved')

  // 显示的冲突列表
  const displayedConflicts = showResolved ? conflicts : unresolvedConflicts

  // 获取冲突类型图标
  const getConflictIcon = (type: ConflictType) => {
    switch (type) {
      case ConflictType.CONCURRENT_MODIFICATION:
        return Zap
      case ConflictType.DATA_INCONSISTENCY:
        return Database
      case ConflictType.NETWORK_CONFLICT:
        return Network
      default:
        return AlertTriangle
    }
  }

  // 获取冲突类型颜色
  const getConflictColor = (type: ConflictType) => {
    switch (type) {
      case ConflictType.CONCURRENT_MODIFICATION:
        return 'text-orange-600'
      case ConflictType.DATA_INCONSISTENCY:
        return 'text-red-600'
      case ConflictType.NETWORK_CONFLICT:
        return 'text-blue-600'
      default:
        return 'text-yellow-600'
    }
  }

  // 获取风险等级颜色
  const getRiskColor = (riskLevel: RiskLevel) => {
    switch (riskLevel) {
      case RiskLevel.LOW:
        return 'text-green-600'
      case RiskLevel.MEDIUM:
        return 'text-yellow-600'
      case RiskLevel.HIGH:
        return 'text-orange-600'
      case RiskLevel.CRITICAL:
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  // 获取解决类型图标
  const getResolutionIcon = (type: ResolutionType) => {
    switch (type) {
      case ResolutionType.ACCEPT_LOCAL:
        return Users
      case ResolutionType.ACCEPT_REMOTE:
        return Network
      case ResolutionType.MERGE:
        return GitMerge
      case ResolutionType.CREATE_NEW:
        return Brain
      case ResolutionType.MANUAL:
      case ResolutionType.MANUAL_INTERVENTION:
        return Settings
      default:
        return AlertTriangle
    }
  }

  // 选择冲突
  const handleSelectConflict = async (conflict: ConflictInfo) => {
    setSelectedConflict(conflict)
    setAnalysis(null)
    setIsAnalyzing(true)

    try {
      const conflictAnalysis = await onAnalyzeConflict(conflict.id)
      setAnalysis(conflictAnalysis)
    } catch (error) {
      console.error('冲突分析失败:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 解决冲突
  const handleResolveConflict = async (resolutionType: ResolutionType) => {
    if (!selectedConflict) return

    setIsResolving(true)
    try {
      await onResolveConflict(selectedConflict.id, resolutionType)
      // 更新冲突状态
      setSelectedConflict(null)
      setAnalysis(null)
    } catch (error) {
      console.error('冲突解决失败:', error)
    } finally {
      setIsResolving(false)
    }
  }

  // 格式化时间
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleString()
  }

  // 计算严重程度百分比
  const getSeverityPercentage = (severity: number) => Math.round(severity * 100)

  return (
    <div className={cn('w-full max-w-6xl mx-auto space-y-6', className)}>
      {/* 头部统计 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>冲突管理中心</span>
              <Badge variant="outline" className="ml-2">
                {unresolvedConflicts.length} 待解决
              </Badge>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResolved(!showResolved)}
              >
                {showResolved ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                {showResolved ? '隐藏已解决' : '显示已解决'}
              </Button>
              <Badge variant={unresolvedConflicts.length > 0 ? 'destructive' : 'default'}>
                {unresolvedConflicts.length === 0 ? '无冲突' : `${unresolvedConflicts.length} 个冲突`}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="总冲突数"
              value={conflicts.length}
              icon={AlertTriangle}
              color="text-yellow-600"
            />
            <StatCard
              title="待解决"
              value={unresolvedConflicts.length}
              icon={Clock}
              color="text-red-600"
            />
            <StatCard
              title="已解决"
              value={resolvedConflicts.length}
              icon={CheckCircle}
              color="text-green-600"
            />
            <StatCard
              title="解决率"
              value={`${conflicts.length > 0 ? Math.round((resolvedConflicts.length / conflicts.length) * 100) : 0}%`}
              icon={TrendingUp}
              color="text-blue-600"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 冲突列表 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-medium">冲突列表</CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto space-y-2">
            {displayedConflicts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{showResolved ? '没有已解决的冲突' : '没有待解决的冲突'}</p>
              </div>
            ) : (
              displayedConflicts.map(conflict => {
                const Icon = getConflictIcon(conflict.type)
                const isSelected = selectedConflict?.id === conflict.id

                return (
                  <div
                    key={conflict.id}
                    className={cn(
                      'p-3 rounded-lg border cursor-pointer transition-colors',
                      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    )}
                    onClick={() => handleSelectConflict(conflict)}
                  >
                    <div className="flex items-start space-x-2">
                      <Icon className={cn('h-4 w-4 mt-0.5', getConflictColor(conflict.type))} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">
                            {conflict.entityType} - {conflict.entityId}
                          </span>
                          <Badge
                            variant={conflict.status === 'pending' ? 'destructive' : 'default'}
                            className="ml-2 flex-shrink-0"
                          >
                            {conflict.status === 'pending' ? '待解决' : '已解决'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(conflict.createdAt)}
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {conflict.type}
                          </Badge>
                          {conflict.severity !== undefined && (
                            <Badge
                              variant={conflict.severity > 0.7 ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              严重: {getSeverityPercentage(conflict.severity)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* 冲突详情 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {selectedConflict ? '冲突详情' : '选择冲突查看详情'}
              </CardTitle>
              {selectedConflict && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedConflict(null)
                    setAnalysis(null)
                  }}
                >
                  清除选择
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedConflict ? (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>请从左侧列表选择一个冲突查看详情</p>
              </div>
            ) : isAnalyzing ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                <span>正在分析冲突...</span>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">详情</TabsTrigger>
                  <TabsTrigger value="analysis">分析</TabsTrigger>
                  <TabsTrigger value="resolution">解决</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard
                      title="基本信息"
                      items={[
                        { label: '冲突ID', value: selectedConflict.id },
                        { label: '实体类型', value: selectedConflict.entityType },
                        { label: '实体ID', value: selectedConflict.entityId },
                        { label: '冲突类型', value: selectedConflict.type },
                        { label: '状态', value: selectedConflict.status },
                        { label: '创建时间', value: formatTime(selectedConflict.createdAt) }
                      ]}
                    />
                    <InfoCard
                      title="冲突指标"
                      items={[
                        { label: '严重程度', value: `${getSeverityPercentage(selectedConflict.severity || 0)}%` },
                        { label: '风险等级', value: selectedConflict.riskLevel || 'medium' },
                        { label: '涉及操作', value: `${selectedConflict.localOperationId && selectedConflict.remoteOperationId ? 2 : 1} 个` }
                      ]}
                    />
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">冲突描述</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {selectedConflict.description || '没有可用的冲突描述'}
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="analysis" className="space-y-4">
                  {!analysis ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>暂无分析结果</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <AnalysisCard
                          title="分析结果"
                          items={[
                            { label: '严重程度', value: `${getSeverityPercentage(analysis.severity)}%` },
                            { label: '置信度', value: `${Math.round(analysis.confidence * 100)}%` },
                            { label: '复杂度', value: `${analysis.complexity}/5` },
                            { label: '风险等级', value: analysis.riskLevel },
                            { label: '预计解决时间', value: `${Math.round(analysis.estimatedResolutionTime / 1000)}秒` }
                          ]}
                        />
                        <AnalysisCard
                          title="冲突原因"
                          items={[
                            { label: '主要原因', value: analysis.cause },
                            { label: '涉及操作数', value: analysis.involvedOperations.length.toString() },
                            { label: '冲突字段数', value: analysis.affectedData.conflictingFields.length.toString() }
                          ]}
                        />
                      </div>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">建议解决方案</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">解决方案</span>
                              <Badge variant="outline">
                                {analysis.suggestedResolution.type}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {analysis.suggestedResolution.explanation}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">成功概率</span>
                              <span className={cn('text-sm font-medium', getRiskColor(analysis.riskLevel))}>
                                {Math.round(analysis.suggestedResolution.successProbability * 100)}%
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {analysis.suggestedResolution.risks.length > 0 && (
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <div className="space-y-1">
                              <strong>潜在风险:</strong>
                              {analysis.suggestedResolution.risks.map((risk, index) => (
                                <div key={index} className="text-sm">• {risk}</div>
                              ))}
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="resolution" className="space-y-4">
                  {selectedConflict.status === 'resolved' ? (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
                      <h3 className="text-lg font-medium text-green-600 mb-2">冲突已解决</h3>
                      <p className="text-sm text-muted-foreground">
                        该冲突已在 {selectedConflict.resolvedAt ? formatTime(selectedConflict.resolvedAt) : '未知时间'} 解决
                      </p>
                    </div>
                  ) : (
                    <>
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          请选择一种解决方案来解决此冲突。系统会根据分析结果推荐最佳方案。
                        </AlertDescription>
                      </Alert>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { type: ResolutionType.ACCEPT_LOCAL, label: '接受本地版本', description: '保留本地修改，丢弃远程修改' },
                          { type: ResolutionType.ACCEPT_REMOTE, label: '接受远程版本', description: '采用远程版本，丢弃本地修改' },
                          { type: ResolutionType.MERGE, label: '智能合并', description: '尝试合并本地和远程的修改' },
                          { type: ResolutionType.CREATE_NEW, label: '创建新版本', description: '创建包含冲突信息的新版本' }
                        ].map(option => {
                          const Icon = getResolutionIcon(option.type)
                          const isRecommended = analysis?.suggestedResolution.type === option.type

                          return (
                            <Card
                              key={option.type}
                              className={cn(
                                'cursor-pointer transition-colors',
                                isRecommended ? 'border-green-500 bg-green-50' : 'hover:border-primary/50'
                              )}
                              onClick={() => handleResolveConflict(option.type)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start space-x-3">
                                  <Icon className="h-5 w-5 text-primary mt-0.5" />
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-medium">{option.label}</h4>
                                      {isRecommended && (
                                        <Badge variant="default" className="text-xs">
                                          推荐
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {option.description}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>

                      {isResolving && (
                        <div className="flex items-center justify-center py-4">
                          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                          <span>正在解决冲突...</span>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * 统计卡片组件
 */
function StatCard({
  title,
  value,
  icon: Icon,
  color
}: {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="text-center">
      <Icon className={cn('h-8 w-8 mx-auto mb-2', color)} />
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{title}</p>
    </div>
  )
}

/**
 * 信息卡片组件
 */
function InfoCard({
  title,
  items
}: {
  title: string
  items: Array<{ label: string; value: string }>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className="text-sm font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 分析卡片组件
 */
function AnalysisCard({
  title,
  items
}: {
  title: string
  items: Array<{ label: string; value: string }>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <Badge variant="outline" className="text-xs">
                {item.value}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}