/**
 * 备份功能集成示例
 * 
 * 展示如何在应用中集成和使用备份功能
 */

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  BackupManager, 
  BackupStatusIndicator,
  enhancedLocalBackupService,
  initializeEnhancedBackup
} from '@/components/backup'
import { 
  Database, 
  Shield, 
  Settings, 
  CheckCircle,
  Info
} from 'lucide-react'

/**
 * 备份功能集成示例组件
 */
export function BackupIntegrationExample() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [showBackupManager, setShowBackupManager] = useState(false)

  useEffect(() => {
    // 初始化增强备份服务
    const initializeBackup = async () => {
      try {
        await initializeEnhancedBackup({
          autoBackupEnabled: true,
          autoBackupInterval: 24 * 60 * 60 * 1000, // 24小时
          maxAutoBackups: 7,
          integrityCheckEnabled: true,
          integrityCheckInterval: 12 * 60 * 60 * 1000, // 12小时
          autoFixIntegrityIssues: false,
          cleanupOldBackups: true,
          backupRetentionDays: 30
        })
        setIsInitialized(true)
        console.log('Enhanced backup service initialized successfully')
      } catch (error) {
        console.error('Failed to initialize enhanced backup service:', error)
      }
    }

    initializeBackup()
  }, [])

  const handleQuickBackup = async () => {
    try {
      const backupId = await enhancedLocalBackupService.createManualBackup({
        name: `QuickBackup_${new Date().toISOString().split('T')[0]}`,
        description: '快速手动备份',
        tags: ['quick-backup']
      })
      console.log(`Quick backup created: ${backupId}`)
      
      // 显示成功消息
      alert('快速备份创建成功！')
    } catch (error) {
      console.error('Quick backup failed:', error)
      alert('备份创建失败，请检查控制台错误信息。')
    }
  }

  const handleQuickIntegrityCheck = async () => {
    try {
      const result = await enhancedLocalBackupService.runIntegrityCheck()
      console.log('Integrity check result:', result)
      
      if (result.summary.totalIssues === 0) {
        alert('数据完整性检查通过，未发现问题！')
      } else {
        alert(`发现 ${result.summary.totalIssues} 个问题，请查看详细报告。`)
      }
    } catch (error) {
      console.error('Integrity check failed:', error)
      alert('完整性检查失败，请检查控制台错误信息。')
    }
  }

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <h3 className="text-lg font-medium mb-2">正在初始化备份服务...</h3>
          <p className="text-muted-foreground">请稍候，正在设置数据保护和备份功能</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 标题和状态指示器 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">数据备份与保护</h2>
          <p className="text-muted-foreground">自动备份、数据导入导出和完整性检查</p>
        </div>
        <BackupStatusIndicator />
      </div>

      {/* 快速操作卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              快速备份
            </CardTitle>
            <CardDescription>
              立即创建数据备份，保护您的信息安全
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleQuickBackup} className="w-full">
              <Database className="h-4 w-4 mr-2" />
              创建备份
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              完整性检查
            </CardTitle>
            <CardDescription>
              检查数据一致性，确保数据完整性
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleQuickIntegrityCheck} className="w-full">
              <Shield className="h-4 w-4 mr-2" />
              运行检查
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              备份管理
            </CardTitle>
            <CardDescription>
              管理所有备份、导入导出数据和配置
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              onClick={() => setShowBackupManager(!showBackupManager)} 
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              {showBackupManager ? '收起管理' : '打开管理'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 功能特性说明 */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>备份功能特性</AlertTitle>
        <AlertDescription>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">自动备份：每24小时自动创建备份，保留最近7个备份</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">数据导入导出：支持JSON格式的数据导入导出</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">完整性检查：每12小时自动检查数据完整性</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">智能清理：自动清理超过30天的旧备份</span>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* 备份管理器 */}
      {showBackupManager && (
        <Card>
          <CardHeader>
            <CardTitle>备份管理器</CardTitle>
            <CardDescription>
              完整的备份管理界面，包含所有备份功能
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BackupManager />
          </CardContent>
        </Card>
      )}

      {/* 使用指南 */}
      <Card>
        <CardHeader>
          <CardTitle>使用指南</CardTitle>
          <CardDescription>
            如何使用备份功能保护您的数据
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">自动备份</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 系统每24小时自动创建备份</li>
                <li>• 保留最近7个自动备份</li>
                <li>• 自动清理超过30天的旧备份</li>
                <li>• 可在设置中调整备份间隔和数量</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">数据导入导出</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 支持导出为JSON格式文件</li>
                <li>• 可选择导出的数据类型</li>
                <li>• 导入时支持多种合并策略</li>
                <li>• 导入前自动创建备份保护</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">完整性检查</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 每12小时自动检查数据完整性</li>
                <li>• 检测数据一致性和引用完整性</li>
                <li>• 提供自动修复功能</li>
                <li>• 生成详细的检查报告</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">备份恢复</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 支持从任意备份恢复数据</li>
                <li>• 恢复前自动创建当前数据备份</li>
                <li>• 支持选择性数据恢复</li>
                <li>• 恢复操作有确认提示</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 状态栏备份指示器集成示例
 */
export function StatusBarBackupIndicator() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">数据状态:</span>
      <BackupStatusIndicator />
    </div>
  )
}

/**
 * 头部备份快捷操作集成示例
 */
export function HeaderBackupQuickActions() {
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)

  const handleQuickBackup = async () => {
    setIsCreatingBackup(true)
    try {
      await enhancedLocalBackupService.createManualBackup({
        name: `HeaderQuickBackup_${new Date().toISOString().split('T')[0]}`,
        description: '从头部快速操作创建的备份'
      })
    } catch (error) {
      console.error('Quick backup failed:', error)
    } finally {
      setIsCreatingBackup(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleQuickBackup}
        disabled={isCreatingBackup}
      >
        <Database className="h-3 w-3 mr-1" />
        {isCreatingBackup ? '备份中...' : '快速备份'}
      </Button>
      
      <BackupStatusIndicator showDetails={false} />
    </div>
  )
}

/**
 * 设置页面备份集成示例
 */
export function SettingsBackupIntegration() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">数据备份与保护</h3>
        <div className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>自动数据保护</AlertTitle>
            <AlertDescription>
              系统已启用自动备份和完整性检查功能，您的数据得到全面保护。
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">备份统计</CardTitle>
              </CardHeader>
              <CardContent>
                <BackupStatusIndicator showDetails={true} />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">快速操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button size="sm" className="w-full">
                  <Database className="h-3 w-3 mr-1" />
                  立即备份
                </Button>
                <Button size="sm" variant="outline" className="w-full">
                  <Shield className="h-3 w-3 mr-1" />
                  检查完整性
                </Button>
                <Button size="sm" variant="outline" className="w-full">
                  <Settings className="h-3 w-3 mr-1" />
                  管理备份
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}