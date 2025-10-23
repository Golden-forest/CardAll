import React, { useState, useEffect } from 'react'
import { DataIntegrityService, IntegrityCheckConfig } from '@/services/data-integrity-service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Shield,
  Settings,
  Save,
  RefreshCw,
  Clock,
  Database,
  Bell,
  Tool,
  CheckCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface DataIntegritySettingsProps {
  onClose?: () => void
}

export function DataIntegritySettings({ onClose }: DataIntegritySettingsProps) {
  const [service] = useState(() => new DataIntegrityService())
  const [configs, setConfigs] = useState<IntegrityCheckConfig[]>([])
  const [activeConfig, setActiveConfig] = useState<IntegrityCheckConfig | null>(null)
  const [serviceStatus, setServiceStatus] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadConfigs()
    loadServiceStatus()
  }, [])

  const loadConfigs = async () => {
    try {
      setIsLoading(true)
      // 加载所有配置
      const defaultConfig = service.getConfig('default')
      const quickConfig = service.getConfig('quick')

      const allConfigs = []
      if (defaultConfig) allConfigs.push(defaultConfig)
      if (quickConfig) allConfigs.push(quickConfig)

      setConfigs(allConfigs)
      setActiveConfig(allConfigs[0] || null)
    } catch (error) {
      console.error('加载配置失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadServiceStatus = async () => {
    try {
      const status = await service.getServiceStatus()
      setServiceStatus(status)
    } catch (error) {
      console.error('加载服务状态失败:', error)
    }
  }

  const saveConfig = async () => {
    if (!activeConfig) return

    setIsSaving(true)
    try {
      await service.updateConfig(activeConfig.id, activeConfig)
      await loadConfigs()

      toast({
        title: "配置已保存",
        description: "数据完整性检查配置已成功保存。",
      })
    } catch (error) {
      toast({
        title: "保存失败",
        description: "无法保存配置，请稍后重试。",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const updateConfigField = (field: string, value: any) => {
    if (!activeConfig) return

    setActiveConfig(prev => {
      if (!prev) return null

      const keys = field.split('.')
      const newConfig = { ...prev }
      let current = newConfig

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] }
        current = current[keys[i]]
      }

      current[keys[keys.length - 1]] = value
      return newConfig
    })
  }

  const runCheckWithConfig = async (configId: string) => {
    try {
      const result = await service.runManualCheckWithConfig(configId, false)

      toast({
        title: "检查完成",
        description: `使用配置 "${configId}" 的检查已完成。`,
      })

      await loadServiceStatus()
    } catch (error) {
      toast({
        title: "检查失败",
        description: "无法完成数据完整性检查。",
        variant: "destructive",
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Shield className="h-4 w-4 text-gray-400" />
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">加载中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 服务状态 */}
      {serviceStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              服务状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{serviceStatus.totalChecks || 0}</div>
                <div className="text-xs text-muted-foreground">总检查次数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{serviceStatus.passedChecks || 0}</div>
                <div className="text-xs text-muted-foreground">通过检查</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{serviceStatus.warningChecks || 0}</div>
                <div className="text-xs text-muted-foreground">警告次数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{serviceStatus.failedChecks || 0}</div>
                <div className="text-xs text-muted-foreground">失败次数</div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">后台检查</span>
                <Badge variant={serviceStatus.backgroundValidationEnabled ? "default" : "secondary"}>
                  {serviceStatus.backgroundValidationEnabled ? "已启用" : "已禁用"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">检查间隔</span>
                <span className="text-sm font-medium">
                  {Math.round((serviceStatus.backgroundCheckInterval || 0) / 60000)} 分钟
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">最后检查</span>
                <span className="text-sm font-medium">
                  {serviceStatus.lastCheckTime
                    ? new Date(serviceStatus.lastCheckTime).toLocaleString()
                    : '从未检查'
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="configs" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="configs">检查配置</TabsTrigger>
          <TabsTrigger value="schedule">调度设置</TabsTrigger>
          <TabsTrigger value="notifications">通知设置</TabsTrigger>
          <TabsTrigger value="advanced">高级设置</TabsTrigger>
        </TabsList>

        <TabsContent value="configs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>检查配置</CardTitle>
              <CardDescription>
                选择和管理数据完整性检查的配置文件
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 配置选择 */}
              <div className="space-y-2">
                <Label>当前配置</Label>
                <Select
                  value={activeConfig?.id || ''}
                  onValueChange={(value) => {
                    const config = configs.find(c => c.id === value)
                    setActiveConfig(config || null)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择配置" />
                  </SelectTrigger>
                  <SelectContent>
                    {configs.map(config => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {activeConfig && (
                <>
                  {/* 检查项目 */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">检查项目</Label>
                    {Object.entries(activeConfig.checks).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <Label className="text-sm capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </Label>
                        <Switch
                          checked={value}
                          onCheckedChange={(checked) =>
                            updateConfigField(`checks.${key}`, checked)
                          }
                        />
                      </div>
                    ))}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2">
                    <Button onClick={saveConfig} disabled={isSaving}>
                      {isSaving ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      保存配置
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => runCheckWithConfig(activeConfig.id)}
                    >
                      <Tool className="h-4 w-4 mr-2" />
                      运行检查
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                调度设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeConfig && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>启用调度</Label>
                      <p className="text-sm text-muted-foreground">
                        定期自动运行数据完整性检查
                      </p>
                    </div>
                    <Switch
                      checked={activeConfig.schedule.enabled}
                      onCheckedChange={(checked) =>
                        updateConfigField('schedule.enabled', checked)
                      }
                    />
                  </div>

                  {activeConfig.schedule.enabled && (
                    <div className="space-y-2">
                      <Label>检查间隔（分钟）</Label>
                      <Input
                        type="number"
                        value={Math.round(activeConfig.schedule.interval / 60000)}
                        onChange={(e) =>
                          updateConfigField('schedule.interval', parseInt(e.target.value) * 60000)
                        }
                        min={1}
                        max={1440}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>空闲时间检查</Label>
                      <p className="text-sm text-muted-foreground">
                        在用户不活跃时进行检查
                      </p>
                    </div>
                    <Switch
                      checked={activeConfig.schedule.idleTime || false}
                      onCheckedChange={(checked) =>
                        updateConfigField('schedule.idleTime', checked)
                      }
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                通知设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeConfig && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>启用通知</Label>
                      <p className="text-sm text-muted-foreground">
                        发送检查结果通知
                      </p>
                    </div>
                    <Switch
                      checked={activeConfig.notifications.enabled}
                      onCheckedChange={(checked) =>
                        updateConfigField('notifications.enabled', checked)
                      }
                    />
                  </div>

                  {activeConfig.notifications.enabled && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>严重问题通知</Label>
                        <Switch
                          checked={activeConfig.notifications.onCritical}
                          onCheckedChange={(checked) =>
                            updateConfigField('notifications.onCritical', checked)
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>警告通知</Label>
                        <Switch
                          checked={activeConfig.notifications.onWarning}
                          onCheckedChange={(checked) =>
                            updateConfigField('notifications.onWarning', checked)
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>完成通知</Label>
                        <Switch
                          checked={activeConfig.notifications.onCompletion}
                          onCheckedChange={(checked) =>
                            updateConfigField('notifications.onCompletion', checked)
                          }
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                高级设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeConfig && (
                <>
                  {/* 自动修复 */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">自动修复</Label>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>启用自动修复</Label>
                        <p className="text-sm text-muted-foreground">
                          自动修复检测到的问题
                        </p>
                      </div>
                      <Switch
                        checked={activeConfig.autoRepair.enabled}
                        onCheckedChange={(checked) =>
                          updateConfigField('autoRepair.enabled', checked)
                        }
                      />
                    </div>

                    {activeConfig.autoRepair.enabled && (
                      <>
                        <div className="space-y-2">
                          <Label>最大重试次数</Label>
                          <Input
                            type="number"
                            value={activeConfig.autoRepair.maxRetries}
                            onChange={(e) =>
                              updateConfigField('autoRepair.maxRetries', parseInt(e.target.value))
                            }
                            min={0}
                            max={10}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* 备份设置 */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">备份设置</Label>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>启用备份</Label>
                        <p className="text-sm text-muted-foreground">
                          修复前创建数据备份
                        </p>
                      </div>
                      <Switch
                        checked={activeConfig.backup.enabled}
                        onCheckedChange={(checked) =>
                          updateConfigField('backup.enabled', checked)
                        }
                      />
                    </div>

                    {activeConfig.backup.enabled && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>修复前备份</Label>
                          <Switch
                            checked={activeConfig.backup.beforeRepair || false}
                            onCheckedChange={(checked) =>
                              updateConfigField('backup.beforeRepair', checked)
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>修复后备份</Label>
                          <Switch
                            checked={activeConfig.backup.afterRepair || false}
                            onCheckedChange={(checked) =>
                              updateConfigField('backup.afterRepair', checked)
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 性能设置 */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">性能设置</Label>
                    <Alert>
                      <Database className="h-4 w-4" />
                      <AlertDescription>
                        检查将在后台进行，不会影响应用性能。系统会根据设备性能自动调整检查频率。
                      </AlertDescription>
                    </Alert>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 保存按钮 */}
      <div className="flex justify-end gap-2">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
        )}
        <Button onClick={saveConfig} disabled={isSaving}>
          {isSaving ? (
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          保存设置
        </Button>
      </div>
    </div>
  )
}