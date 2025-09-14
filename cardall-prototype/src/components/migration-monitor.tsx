import React, { useState, useEffect, useCallback } from 'react'
import {
  DataMigrationTool,
  MigrationProgress,
  MigrationResult,
  MigrationPlan,
  ValidationReport
} from '@/services/data-migration-tool'
import {
  BackupService,
  BackupConfig,
  BackupResult,
  RestoreResult
} from '@/services/backup-service'
import { DataValidatorService, ValidationResult } from '@/services/data-validator'

// ============================================================================
// 迁移监控组件 - 实时监控和状态报告
// ============================================================================

interface MigrationMonitorProps {
  onMigrationComplete?: (result: MigrationResult) => void
  onMigrationError?: (error: string) => void
}

interface MigrationStatus {
  planId?: string
  status: 'idle' | 'analyzing' | 'ready' | 'running' | 'paused' | 'completed' | 'failed' | 'rolled_back'
  progress: number
  currentStep: string
  currentStepProgress: number
  startTime?: Date
  estimatedEndTime?: Date
  speed: number
  remainingTime?: number
}

interface MigrationMetrics {
  totalCards: number
  migratedCards: number
  totalFolders: number
  migratedFolders: number
  totalTags: number
  migratedTags: number
  totalImages: number
  migratedImages: number
  dataSize: number
  compressedSize: number
  throughput: number // MB/s
}

interface SystemHealth {
  databaseHealthy: boolean
  storageAvailable: boolean
  memoryUsage: number
  lastValidation?: ValidationResult
  backupStatus: {
    lastBackup?: Date
    backupCount: number
    totalSize: number
  }
}

export const MigrationMonitor: React.FC<MigrationMonitorProps> = ({
  onMigrationComplete,
  onMigrationError
}) => {
  // 状态管理
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>({
    status: 'idle',
    progress: 0,
    currentStep: '',
    currentStepProgress: 0,
    speed: 0
  })

  const [metrics, setMetrics] = useState<MigrationMetrics>({
    totalCards: 0,
    migratedCards: 0,
    totalFolders: 0,
    migratedFolders: 0,
    totalTags: 0,
    migratedTags: 0,
    totalImages: 0,
    migratedImages: 0,
    dataSize: 0,
    compressedSize: 0,
    throughput: 0
  })

  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    databaseHealthy: true,
    storageAvailable: true,
    memoryUsage: 0,
    backupStatus: {
      lastBackup: undefined,
      backupCount: 0,
      totalSize: 0
    }
  })

  const [activePlan, setActivePlan] = useState<MigrationPlan | null>(null)
  const [migrationResults, setMigrationResults] = useState<MigrationResult[]>([])
  const [showDetails, setShowDetails] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // 服务实例
  const migrationTool = new DataMigrationTool()
  const backupService = new BackupService()
  const dataValidator = new DataValidatorService()

  // 进度监听器
  useEffect(() => {
    const unsubscribe = migrationTool.onProgress((progress: MigrationProgress) => {
      updateMigrationStatus(progress)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // 自动刷新状态
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(async () => {
      await refreshSystemStatus()
    }, 5000) // 5秒刷新一次

    return () => clearInterval(interval)
  }, [autoRefresh])

  // 初始化
  useEffect(() => {
    initializeMonitor()
  }, [])

  /**
   * 初始化监控器
   */
  const initializeMonitor = async () => {
    try {
      await refreshSystemStatus()

      // 加载迁移历史
      const history = await migrationTool.getMigrationHistory()
      setMigrationResults(history)

      // 检查是否有正在运行的迁移
      const systemStatus = await migrationTool.getSystemStatus()
      if (systemStatus.isMigrating && systemStatus.activeMigrations.length > 0) {
        const activeMigrationId = systemStatus.activeMigrations[0]
        const progress = migrationTool.getMigrationProgress(activeMigrationId)
        if (progress) {
          updateMigrationStatus(progress)
        }
      }
    } catch (error) {
      console.error('Failed to initialize migration monitor:', error)
    }
  }

  /**
   * 刷新系统状态
   */
  const refreshSystemStatus = async () => {
    try {
      const [systemStatus, validation, backupStats] = await Promise.all([
        migrationTool.getSystemStatus(),
        dataValidator.validateAllData(),
        backupService.getBackupStats()
      ])

      setSystemHealth({
        databaseHealthy: systemStatus.databaseHealthy,
        storageAvailable: systemStatus.storageQuota.total > 0,
        memoryUsage: (systemStatus.storageQuota.used / systemStatus.storageQuota.total) * 100,
        lastValidation: validation,
        backupStatus: {
          lastBackup: backupStats.lastBackup,
          backupCount: backupStats.totalBackups,
          totalSize: backupStats.totalSize
        }
      })

      // 更新存储使用情况
      if (migrationStatus.planId) {
        const currentProgress = migrationTool.getMigrationProgress(migrationStatus.planId)
        if (currentProgress) {
          updateMigrationStatus(currentProgress)
        }
      }
    } catch (error) {
      console.error('Failed to refresh system status:', error)
    }
  }

  /**
   * 更新迁移状态
   */
  const updateMigrationStatus = useCallback((progress: MigrationProgress) => {
    const statusMap = {
      'pending': 'ready',
      'running': 'running',
      'paused': 'paused',
      'completed': 'completed',
      'failed': 'failed',
      'rolled_back': 'rolled_back'
    }

    setMigrationStatus(prev => ({
      ...prev,
      planId: progress.planId,
      status: statusMap[progress.status] as MigrationStatus['status'],
      progress: progress.progress,
      currentStep: progress.currentStep,
      currentStepProgress: progress.currentStepProgress,
      startTime: progress.startTime,
      estimatedEndTime: progress.estimatedEndTime,
      speed: progress.speed,
      remainingTime: progress.remainingTime
    }))

    // 计算吞吐量
    if (progress.startTime && progress.progress > 0) {
      const elapsed = Date.now() - progress.startTime.getTime()
      const throughput = (metrics.dataSize / (elapsed / 1000)) / 1024 / 1024 // MB/s
      setMetrics(prev => ({ ...prev, throughput }))
    }
  }, [metrics.dataSize])

  /**
   * 开始迁移分析
   */
  const startAnalysis = async (sourceType: 'localStorage' | 'database-simple' | 'database-full') => {
    try {
      setMigrationStatus(prev => ({
        ...prev,
        status: 'analyzing',
        currentStep: '分析数据源...',
        currentStepProgress: 0
      }))

      const source = { type: sourceType }
      const plan = await migrationTool.analyzeAndCreatePlan(source)

      setActivePlan(plan)
      setMigrationStatus(prev => ({
        ...prev,
        status: 'ready',
        currentStep: '准备迁移',
        currentStepProgress: 100
      }))

      // 更新预估指标
      setMetrics(prev => ({
        ...prev,
        totalCards: plan.steps.find(s => s.id.includes('cards'))?.estimatedTime || 0,
        totalFolders: plan.steps.find(s => s.id.includes('folders'))?.estimatedTime || 0,
        totalTags: plan.steps.find(s => s.id.includes('tags'))?.estimatedTime || 0,
        totalImages: plan.steps.find(s => s.id.includes('images'))?.estimatedTime || 0
      }))

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setMigrationStatus(prev => ({
        ...prev,
        status: 'failed',
        currentStep: '分析失败'
      }))
      onMigrationError?.(errorMessage)
    }
  }

  /**
   * 开始迁移
   */
  const startMigration = async () => {
    if (!activePlan) {
      onMigrationError?.('没有可用的迁移计划')
      return
    }

    try {
      setMigrationStatus(prev => ({
        ...prev,
        status: 'running',
        currentStep: '开始迁移...',
        currentStepProgress: 0,
        startTime: new Date()
      }))

      const result = await migrationTool.executeMigration(activePlan)

      setMigrationResults(prev => [result, ...prev])

      if (result.success) {
        setMigrationStatus(prev => ({
          ...prev,
          status: 'completed',
          progress: 100,
          currentStep: '迁移完成',
          currentStepProgress: 100
        }))

        // 更新最终指标
        setMetrics(prev => ({
          ...prev,
          migratedCards: result.migratedCards,
          migratedFolders: result.migratedFolders,
          migratedTags: result.migratedTags,
          migratedImages: result.migratedImages,
          dataSize: result.dataSize,
          compressedSize: result.dataSize * 0.7 // 估算压缩率
        }))

        onMigrationComplete?.(result)
      } else {
        setMigrationStatus(prev => ({
          ...prev,
          status: 'failed',
          currentStep: '迁移失败'
        }))

        onMigrationError?.(result.errors.join(', '))
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setMigrationStatus(prev => ({
        ...prev,
        status: 'failed',
        currentStep: '迁移失败'
      }))
      onMigrationError?.(errorMessage)
    }
  }

  /**
   * 暂停迁移
   */
  const pauseMigration = async () => {
    if (!migrationStatus.planId) return

    try {
      const success = await migrationTool.cancelMigration(migrationStatus.planId)
      if (success) {
        setMigrationStatus(prev => ({
          ...prev,
          status: 'paused',
          currentStep: '迁移已暂停'
        }))
      }
    } catch (error) {
      console.error('Failed to pause migration:', error)
    }
  }

  /**
   * 创建备份
   */
  const createBackup = async () => {
    try {
      const result = await backupService.createBackup()
      if (result.success) {
        await refreshSystemStatus()
        return result
      } else {
        throw new Error(result.warnings.join(', '))
      }
    } catch (error) {
      console.error('Failed to create backup:', error)
      throw error
    }
  }

  /**
   * 执行数据验证
   */
  const runValidation = async () => {
    try {
      const result = await dataValidator.validateAllData()
      setSystemHealth(prev => ({
        ...prev,
        lastValidation: result
      }))
      return result
    } catch (error) {
      console.error('Validation failed:', error)
      throw error
    }
  }

  /**
   * 格式化时间
   */
  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}min`
    return `${(ms / 3600000).toFixed(1)}h`
  }

  /**
   * 格式化文件大小
   */
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`
  }

  /**
   * 获取状态颜色
   */
  const getStatusColor = (status: MigrationStatus['status']): string => {
    const colors = {
      idle: 'gray',
      analyzing: 'blue',
      ready: 'green',
      running: 'blue',
      paused: 'yellow',
      completed: 'green',
      failed: 'red',
      rolled_back: 'orange'
    }
    return colors[status] || 'gray'
  }

  /**
   * 获取健康状态
   */
  const getHealthStatus = (): 'healthy' | 'warning' | 'critical' => {
    if (!systemHealth.databaseHealthy || !systemHealth.storageAvailable) {
      return 'critical'
    }
    if (systemHealth.memoryUsage > 90 || (systemHealth.lastValidation?.score || 100) < 80) {
      return 'warning'
    }
    return 'healthy'
  }

  return (
    <div className="migration-monitor bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      {/* 标题和控制区域 */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">数据迁移监控</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1 rounded text-sm ${
              autoRefresh ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-700'
            }`}
          >
            自动刷新 {autoRefresh ? '开启' : '关闭'}
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
          >
            {showDetails ? '隐藏详情' : '显示详情'}
          </button>
          <button
            onClick={refreshSystemStatus}
            className="px-3 py-1 bg-gray-500 text-white rounded text-sm"
          >
            刷新
          </button>
        </div>
      </div>

      {/* 系统健康状态 */}
      <div className="mb-6 p-4 rounded-lg border">
        <h3 className="text-lg font-semibold mb-3">系统健康状态</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-3 rounded ${
            getHealthStatus() === 'healthy' ? 'bg-green-100 border-green-300' :
            getHealthStatus() === 'warning' ? 'bg-yellow-100 border-yellow-300' :
            'bg-red-100 border-red-300'
          } border`}>
            <div className="flex justify-between items-center">
              <span className="font-medium">数据库</span>
              <span className={`w-2 h-2 rounded-full ${
                systemHealth.databaseHealthy ? 'bg-green-500' : 'bg-red-500'
              }`}></span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {systemHealth.databaseHealthy ? '正常' : '异常'}
            </p>
          </div>

          <div className={`p-3 rounded ${
            systemHealth.storageAvailable ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'
          } border`}>
            <div className="flex justify-between items-center">
              <span className="font-medium">存储</span>
              <span className={`w-2 h-2 rounded-full ${
                systemHealth.storageAvailable ? 'bg-green-500' : 'bg-red-500'
              }`}></span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {systemHealth.storageAvailable ? '可用' : '不可用'}
            </p>
          </div>

          <div className="p-3 rounded bg-blue-100 border border-blue-300">
            <div className="flex justify-between items-center">
              <span className="font-medium">数据质量</span>
              <span className="text-sm font-medium">
                {systemHealth.lastValidation?.score || 'N/A'}/100
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {systemHealth.lastValidation?.isValid ? '验证通过' : '发现问题'}
            </p>
          </div>
        </div>
      </div>

      {/* 迁移状态 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">迁移状态</h3>
          <span className={`px-2 py-1 rounded text-sm text-white ${
            getStatusColor(migrationStatus.status)
          }`}>
            {migrationStatus.status === 'idle' && '空闲'}
            {migrationStatus.status === 'analyzing' && '分析中'}
            {migrationStatus.status === 'ready' && '准备就绪'}
            {migrationStatus.status === 'running' && '运行中'}
            {migrationStatus.status === 'paused' && '已暂停'}
            {migrationStatus.status === 'completed' && '已完成'}
            {migrationStatus.status === 'failed' && '失败'}
            {migrationStatus.status === 'rolled_back' && '已回滚'}
          </span>
        </div>

        {/* 进度条 */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${
              getStatusColor(migrationStatus.status) === 'green' ? 'bg-green-500' :
              getStatusColor(migrationStatus.status) === 'blue' ? 'bg-blue-500' :
              getStatusColor(migrationStatus.status) === 'red' ? 'bg-red-500' :
              getStatusColor(migrationStatus.status) === 'yellow' ? 'bg-yellow-500' :
              'bg-gray-500'
            }`}
            style={{ width: `${migrationStatus.progress}%` }}
          ></div>
        </div>

        <div className="flex justify-between text-sm text-gray-600">
          <span>{migrationStatus.currentStep}</span>
          <span>{migrationStatus.progress.toFixed(1)}%</span>
        </div>

        {migrationStatus.remainingTime && (
          <div className="text-sm text-gray-500 mt-1">
            预计剩余时间: {formatTime(migrationStatus.remainingTime)}
          </div>
        )}
      </div>

      {/* 迁移指标 */}
      {showDetails && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">迁移指标</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">卡片</div>
              <div className="font-semibold">
                {metrics.migratedCards}/{metrics.totalCards}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">文件夹</div>
              <div className="font-semibold">
                {metrics.migratedFolders}/{metrics.totalFolders}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">标签</div>
              <div className="font-semibold">
                {metrics.migratedTags}/{metrics.totalTags}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">图片</div>
              <div className="font-semibold">
                {metrics.migratedImages}/{metrics.totalImages}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">数据大小</div>
              <div className="font-semibold">
                {formatSize(metrics.dataSize)}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">压缩后</div>
              <div className="font-semibold">
                {formatSize(metrics.compressedSize)}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">吞吐量</div>
              <div className="font-semibold">
                {metrics.throughput.toFixed(2)} MB/s
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">压缩率</div>
              <div className="font-semibold">
                {metrics.dataSize > 0 ? ((1 - metrics.compressedSize / metrics.dataSize) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 控制按钮 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {migrationStatus.status === 'idle' && (
          <>
            <button
              onClick={() => startAnalysis('localStorage')}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              分析 localStorage
            </button>
            <button
              onClick={() => startAnalysis('database-simple')}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              分析旧数据库
            </button>
            <button
              onClick={() => startAnalysis('database-full')}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              分析数据库升级
            </button>
          </>
        )}

        {migrationStatus.status === 'ready' && (
          <button
            onClick={startMigration}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            开始迁移
          </button>
        )}

        {migrationStatus.status === 'running' && (
          <button
            onClick={pauseMigration}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            暂停迁移
          </button>
        )}

        <button
          onClick={createBackup}
          className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
        >
          创建备份
        </button>

        <button
          onClick={runValidation}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          数据验证
        </button>
      </div>

      {/* 迁移历史 */}
      {showDetails && migrationResults.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">迁移历史</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {migrationResults.slice(0, 10).map((result, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded border">
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {result.source.type} → {result.target.version}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs text-white ${
                    result.success ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    {result.success ? '成功' : '失败'}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {formatTime(result.duration)} | {result.migratedCards} 卡片, {result.migratedFolders} 文件夹
                </div>
                {result.errors.length > 0 && (
                  <div className="text-sm text-red-600 mt-1">
                    错误: {result.errors[0]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 当前计划详情 */}
      {showDetails && activePlan && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-3">迁移计划详情</h3>
          <div className="p-4 bg-gray-50 rounded">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <strong>数据源:</strong> {activePlan.source.type}
              </div>
              <div>
                <strong>目标版本:</strong> {activePlan.target.version}
              </div>
              <div>
                <strong>预计时间:</strong> {formatTime(activePlan.estimatedTime)}
              </div>
              <div>
                <strong>步骤数量:</strong> {activePlan.steps.length}
              </div>
            </div>

            <div className="mb-4">
              <strong>迁移步骤:</strong>
              <div className="mt-2 space-y-1">
                {activePlan.steps.map((step, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{step.name}</span>
                    <span className="text-gray-600">
                      {formatTime(step.estimatedTime)} | {step.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <strong>安全设置:</strong>
              <div className="flex gap-4 mt-2 text-sm">
                <span>备份: {activePlan.backupRequired ? '是' : '否'}</span>
                <span>回滚: {activePlan.rollbackEnabled ? '是' : '否'}</span>
                <span>验证级别: {activePlan.validationLevel}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MigrationMonitor