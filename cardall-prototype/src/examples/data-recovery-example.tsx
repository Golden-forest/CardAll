import React, { useEffect, useState } from 'react'
import {
  dataRecoveryService,
  createRecoveryPoint,
  recoverFromPoint,
  getRecoveryPoints,
  getRecoveryStatistics,
  type RecoveryPoint,
  type RecoveryOptions,
  type RecoveryResult,
  type RecoveryStatistics
} from '../services/data-recovery'
import DataRecoveryPanel from '../components/data-recovery-panel'
import DataRecoveryToolbar from '../components/data-recovery-toolbar'

/**
 * 数据恢复功能使用示例
 *
 * 这个示例展示了如何在应用中集成和使用数据恢复功能：
 * 1. 创建和管理恢复点
 * 2. 执行数据恢复操作
 * 3. 配置恢复选项
 * 4. 使用UI组件
 */

interface DataRecoveryExampleProps {
  // 示例配置
  autoInitialize?: boolean
  showAdvancedOptions?: boolean
  enableDemoData?: boolean
}

export const DataRecoveryExample: React.FC<DataRecoveryExampleProps> = ({
  autoInitialize = true,
  showAdvancedOptions = false,
  enableDemoData = false
}) => {
  const [statistics, setStatistics] = useState<RecoveryStatistics | null>(null)
  const [recoveryPoints, setRecoveryPoints] = useState<RecoveryPoint[]>([])
  const [selectedPoint, setSelectedPoint] = useState<RecoveryPoint | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false)
  const [lastResult, setLastResult] = useState<RecoveryResult | null>(null)
  const [isWorking, setIsWorking] = useState(false)

  // 初始化服务
  useEffect(() => {
    if (autoInitialize) {
      initializeService()
    }
  }, [autoInitialize])

  // 初始化恢复服务
  const initializeService = async () => {
    try {
      setIsWorking(true)
      await dataRecoveryService.initialize()
      setIsInitialized(true)
      await loadData()

      // 如果启用了演示数据，创建一些示例恢复点
      if (enableDemoData) {
        await createDemoData()
      }

      console.log('Data recovery service initialized successfully')
    } catch (error) {
      console.error('Failed to initialize data recovery service:', error)
    } finally {
      setIsWorking(false)
    }
  }

  // 加载数据
  const loadData = async () => {
    try {
      const [stats, points] = await Promise.all([
        getRecoveryStatistics(),
        getRecoveryPoints()
      ])
      setStatistics(stats)
      setRecoveryPoints(points)
    } catch (error) {
      console.error('Failed to load recovery data:', error)
    }
  }

  // 创建演示数据
  const createDemoData = async () => {
    try {
      // 创建不同类型的演示恢复点
      await createRecoveryPoint('manual', 'Demo: Manual backup point')
      await createRecoveryPoint('auto', 'Demo: Automatic backup point')
      await createRecoveryPoint('migration', 'Demo: Pre-migration backup')
      await createRecoveryPoint('integrity_check', 'Demo: Pre-integrity check backup')

      await loadData()
    } catch (error) {
      console.error('Failed to create demo data:', error)
    }
  }

  // 创建恢复点
  const handleCreateRecoveryPoint = async (type: RecoveryPoint['type'] = 'manual', description?: string) => {
    try {
      setIsWorking(true)
      const point = await createRecoveryPoint(type, description)
      await loadData()
      console.log('Recovery point created:', point.id)
      return point
    } catch (error) {
      console.error('Failed to create recovery point:', error)
      throw error
    } finally {
      setIsWorking(false)
    }
  }

  // 执行恢复
  const handleRecoverFromPoint = async (pointId: string, options?: RecoveryOptions) => {
    try {
      setIsWorking(true)
      const result = await recoverFromPoint(pointId, options)
      setLastResult(result)
      await loadData()
      console.log('Recovery result:', result)
      return result
    } catch (error) {
      console.error('Recovery failed:', error)
      throw error
    } finally {
      setIsWorking(false)
    }
  }

  // 获取恢复选项
  const getRecoveryOptions = (): RecoveryOptions => {
    return {
      targetData: ['cards', 'folders', 'tags', 'settings'],
      mergeStrategy: 'smart_merge',
      conflictResolution: 'newer_wins',
      backupBeforeRecovery: true,
      validateIntegrity: true,
      preserveUserData: true
    }
  }

  // 格式化时间
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  // 格式化大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // 获取类型颜色
  const getTypeColor = (type: RecoveryPoint['type']) => {
    const colors = {
      manual: 'bg-blue-100 text-blue-800',
      auto: 'bg-green-100 text-green-800',
      migration: 'bg-purple-100 text-purple-800',
      integrity_check: 'bg-yellow-100 text-yellow-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  // 获取类型文本
  const getTypeText = (type: RecoveryPoint['type']) => {
    const texts = {
      manual: '手动',
      auto: '自动',
      migration: '迁移前',
      integrity_check: '完整性检查前'
    }
    return texts[type] || '未知'
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* 头部 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">数据恢复功能示例</h1>
        <p className="text-gray-600">演示智能数据恢复系统的核心功能</p>
      </div>

      {/* 工具栏演示 */}
      <div className="bg-gray-50 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">工具栏组件演示</h2>
        <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">这是实际的数据恢复工具栏：</div>
          <DataRecoveryToolbar />
        </div>
      </div>

      {/* 初始化状态 */}
      {!isInitialized && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-lg font-medium text-yellow-900">服务未初始化</h3>
              <p className="text-yellow-700">请先初始化数据恢复服务以使用全部功能</p>
            </div>
          </div>
          <button
            onClick={initializeService}
            disabled={isWorking}
            className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 transition-colors"
          >
            {isWorking ? '初始化中...' : '初始化服务'}
          </button>
        </div>
      )}

      {/* 统计概览 */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">恢复点统计</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">总恢复点</span>
                <span className="font-medium">{statistics.totalRecoveryPoints}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">总大小</span>
                <span className="font-medium">{formatSize(statistics.totalSize)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">成功率</span>
                <span className="font-medium text-green-600">
                  {(statistics.recoverySuccessRate * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">平均恢复时间</span>
                <span className="font-medium">{statistics.averageRecoveryTime.toFixed(0)}ms</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">存储使用</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">已使用</span>
                <span className="font-medium">{formatSize(statistics.storageUsage.used)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">总计</span>
                <span className="font-medium">{formatSize(statistics.storageUsage.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">使用率</span>
                <span className="font-medium">
                  {statistics.storageUsage.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(statistics.storageUsage.percentage, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">时间信息</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">最早恢复点</span>
                <span className="font-medium">
                  {statistics.oldestRecoveryPoint
                    ? formatDate(statistics.oldestRecoveryPoint.getTime())
                    : '无'
                  }
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">最新恢复点</span>
                <span className="font-medium">
                  {statistics.newestRecoveryPoint
                    ? formatDate(statistics.newestRecoveryPoint.getTime())
                    : '无'
                  }
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">最后恢复</span>
                <span className="font-medium">
                  {statistics.lastRecoveryDate
                    ? formatDate(statistics.lastRecoveryDate.getTime())
                    : '无'
                  }
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">快速操作</h3>
            <div className="space-y-2">
              <button
                onClick={() => handleCreateRecoveryPoint('manual', 'Example manual backup')}
                disabled={isWorking || !isInitialized}
                className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                创建手动备份
              </button>
              <button
                onClick={() => setIsRecoveryOpen(true)}
                disabled={!isInitialized}
                className="w-full px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                打开恢复面板
              </button>
              <button
                onClick={loadData}
                disabled={isWorking || !isInitialized}
                className="w-full px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                刷新数据
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 恢复点列表 */}
      {recoveryPoints.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">恢复点列表</h3>
          <div className="space-y-3">
            {recoveryPoints.map((point) => (
              <div key={point.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(point.type)}`}>
                        {getTypeText(point.type)}
                      </span>
                      <span className="text-sm text-gray-600">{formatDate(point.timestamp)}</span>
                      <span className="text-sm text-gray-500">{formatSize(point.size)}</span>
                    </div>
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {point.description}
                    </div>
                    <div className="text-xs text-gray-500">
                      数据: {point.data.cards.length} 卡片, {point.data.folders.length} 文件夹, {point.data.tags.length} 标签
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSelectedPoint(point)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      选择
                    </button>
                    <button
                      onClick={() => handleRecoverFromPoint(point.id, getRecoveryOptions())}
                      disabled={isWorking}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      恢复
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 选中的恢复点详情 */}
      {selectedPoint && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">选中的恢复点</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-blue-900 mb-2">基本信息</h4>
              <div className="space-y-1 text-sm">
                <div><span className="text-blue-600">ID:</span> {selectedPoint.id}</div>
                <div><span className="text-blue-600">类型:</span> {getTypeText(selectedPoint.type)}</div>
                <div><span className="text-blue-600">时间:</span> {formatDate(selectedPoint.timestamp)}</div>
                <div><span className="text-blue-600">大小:</span> {formatSize(selectedPoint.size)}</div>
                <div><span className="text-blue-600">描述:</span> {selectedPoint.description}</div>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-blue-900 mb-2">数据内容</h4>
              <div className="space-y-1 text-sm">
                <div><span className="text-blue-600">卡片:</span> {selectedPoint.data.cards.length} 个</div>
                <div><span className="text-blue-600">文件夹:</span> {selectedPoint.data.folders.length} 个</div>
                <div><span className="text-blue-600">标签:</span> {selectedPoint.data.tags.length} 个</div>
                <div><span className="text-blue-600">设置:</span> {Object.keys(selectedPoint.data.settings).length} 项</div>
                <div><span className="text-blue-600">版本:</span> {selectedPoint.data.version}</div>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-blue-200">
            <button
              onClick={() => handleRecoverFromPoint(selectedPoint.id, getRecoveryOptions())}
              disabled={isWorking}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isWorking ? '恢复中...' : '从此恢复点恢复数据'}
            </button>
          </div>
        </div>
      )}

      {/* 最后的恢复结果 */}
      {lastResult && (
        <div className={`rounded-lg p-6 mb-6 ${
          lastResult.success
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          <h3 className="text-lg font-semibold mb-4">
            {lastResult.success ? '恢复成功' : '恢复失败'}
          </h3>
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">消息:</span> {lastResult.message}
            </div>
            {lastResult.success && (
              <div className="text-sm">
                <span className="font-medium">恢复项目:</span>
                <ul className="list-disc list-inside mt-1">
                  <li>卡片: {lastResult.restoredItems.cards} 个</li>
                  <li>文件夹: {lastResult.restoredItems.folders} 个</li>
                  <li>标签: {lastResult.restoredItems.tags} 个</li>
                  <li>设置: {lastResult.restoredItems.settings ? '已恢复' : '未恢复'}</li>
                </ul>
              </div>
            )}
            <div className="text-sm">
              <span className="font-medium">耗时:</span> {lastResult.duration.toFixed(2)}ms
            </div>
            {lastResult.conflicts.length > 0 && (
              <div className="text-sm">
                <span className="font-medium">冲突:</span> {lastResult.conflicts.length} 个
              </div>
            )}
          </div>
        </div>
      )}

      {/* 高级选项 */}
      {showAdvancedOptions && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">高级选项</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">编程接口示例</h4>
              <div className="bg-gray-100 p-4 rounded font-mono text-sm overflow-x-auto">
                <pre>{`// 创建恢复点
const point = await createRecoveryPoint('manual', 'My backup')

// 从恢复点恢复
const result = await recoverFromPoint(point.id, {
  targetData: ['cards', 'folders'],
  mergeStrategy: 'smart_merge',
  conflictResolution: 'newer_wins'
})

// 获取恢复统计
const stats = await getRecoveryStatistics()`}</pre>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">组件集成</h4>
              <div className="bg-gray-100 p-4 rounded font-mono text-sm overflow-x-auto">
                <pre>{`// 工具栏组件
import DataRecoveryToolbar from './components/data-recovery-toolbar'

function App() {
  return (
    <div>
      <header>
        <DataRecoveryToolbar />
      </header>
      {/* 应用内容 */}
    </div>
  )
}

// 恢复面板组件
import DataRecoveryPanel from './components/data-recovery-panel'

function SettingsPage() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div>
      <button onClick={() => setIsOpen(true)}>
        数据恢复
      </button>
      <DataRecoveryPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </div>
  )
}`}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 使用说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">使用说明</h3>
        <div className="space-y-3 text-sm text-blue-800">
          <div>
            <h4 className="font-medium mb-1">基本功能：</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>自动备份：定时创建数据恢复点</li>
              <li>手动备份：用户手动创建恢复点</li>
              <li>智能恢复：支持多种合并策略和冲突解决</li>
              <li>数据验证：恢复前验证数据完整性</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-1">恢复策略：</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>替换：完全替换现有数据</li>
              <li>合并：智能合并新旧数据</li>
              <li>智能合并：基于时间戳的智能冲突解决</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-1">冲突解决：</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>新数据优先：使用较新的数据版本</li>
              <li>旧数据优先：使用较旧的数据版本</li>
              <li>手动解决：用户手动选择保留的数据</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-1">安全特性：</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>恢复前自动创建备份</li>
              <li>数据完整性验证</li>
              <li>校验和验证</li>
              <li>架构验证</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 恢复面板 */}
      <DataRecoveryPanel
        isOpen={isRecoveryOpen}
        onClose={() => setIsRecoveryOpen(false)}
      />
    </div>
  )
}

export default DataRecoveryExample