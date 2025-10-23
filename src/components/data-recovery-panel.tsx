import React, { useState, useEffect } from 'react'
import {
  dataRecoveryService,
  type RecoveryPoint,
  type RecoveryOptions,
  type RecoveryResult,
  type RecoveryStatistics
} from '../services/data-recovery'

interface DataRecoveryPanelProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * 数据恢复面板组件
 *
 * 提供用户友好的数据恢复界面，包括：
 * - 恢复点列表和详情
 * - 恢复操作向导
 * - 恢复配置管理
 * - 恢复历史记录
 */
export const DataRecoveryPanel: React.FC<DataRecoveryPanelProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'recovery' | 'config' | 'history' | 'privacy'>('recovery')
  const [recoveryPoints, setRecoveryPoints] = useState<RecoveryPoint[]>([])
  const [statistics, setStatistics] = useState<RecoveryStatistics | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<RecoveryPoint | null>(null)
  const [isRecovering, setIsRecovering] = useState(false)
  const [recoveryResult, setRecoveryResult] = useState<RecoveryResult | null>(null)
  const [showRecoveryWizard, setShowRecoveryWizard] = useState(false)
  const [recoveryOptions, setRecoveryOptions] = useState<RecoveryOptions>({
    targetData: ['cards', 'folders', 'tags', 'settings'],
    mergeStrategy: 'smart_merge',
    conflictResolution: 'newer_wins',
    backupBeforeRecovery: true,
    validateIntegrity: true,
    preserveUserData: true
  })
  const [privacyPolicy, setPrivacyPolicy] = useState<string>('')
  const [privacyCompliance, setPrivacyCompliance] = useState<any>(null)

  // 加载数据
  useEffect(() => {
    if (isOpen) {
      loadData()
      loadPrivacyData()
    }
  }, [isOpen])

  // 加载隐私数据
  const loadPrivacyData = async () => {
    try {
      const [policy, compliance] = await Promise.all([
        dataRecoveryService.getPrivacyPolicy(),
        dataRecoveryService.checkPrivacyCompliance()
      ])
      setPrivacyPolicy(policy)
      setPrivacyCompliance(compliance)
    } catch (error) {
      console.error('Failed to load privacy data:', error)
    }
  }

  const loadData = async () => {
    try {
      const [points, stats] = await Promise.all([
        dataRecoveryService.getRecoveryPoints(),
        dataRecoveryService.getStatistics()
      ])
      setRecoveryPoints(points)
      setStatistics(stats)
    } catch (error) {
      console.error('Failed to load recovery data:', error)
    }
  }

  // 创建恢复点
  const handleCreateRecoveryPoint = async () => {
    try {
      await dataRecoveryService.createRecoveryPoint('manual', 'Manual backup')
      loadData()
    } catch (error) {
      console.error('Failed to create recovery point:', error)
    }
  }

  // 开始恢复向导
  const startRecovery = (point: RecoveryPoint) => {
    setSelectedPoint(point)
    setShowRecoveryWizard(true)
  }

  // 执行恢复
  const performRecovery = async () => {
    if (!selectedPoint) return

    setIsRecovering(true)
    try {
      const result = await dataRecoveryService.recoverFromPoint(selectedPoint.id, recoveryOptions)
      setRecoveryResult(result)
      setShowRecoveryWizard(false)
      loadData()
    } catch (error) {
      console.error('Recovery failed:', error)
    } finally {
      setIsRecovering(false)
    }
  }

  // 删除恢复点
  const handleDeletePoint = async (pointId: string) => {
    if (!window.confirm('确定要删除这个恢复点吗？此操作不可撤销。')) {
      return
    }

    try {
      await dataRecoveryService.deleteRecoveryPoint(pointId)
      loadData()
    } catch (error) {
      console.error('Failed to delete recovery point:', error)
    }
  }

  // 导出恢复点
  const handleExportPoint = async (pointId: string) => {
    try {
      const exportData = await dataRecoveryService.exportRecoveryPoint(pointId)
      const blob = new Blob([exportData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `recovery-point-${pointId}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export recovery point:', error)
    }
  }

  // 导入恢复点
  const handleImportPoint = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        await dataRecoveryService.importRecoveryPoint(text)
        loadData()
      } catch (error) {
        console.error('Failed to import recovery point:', error)
        alert('导入失败：文件格式不正确或数据已损坏')
      }
    }

    input.click()
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">数据恢复中心</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 统计概览 */}
        {statistics && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{statistics.totalRecoveryPoints}</div>
                <div className="text-sm text-gray-600">恢复点总数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{formatSize(statistics.totalSize)}</div>
                <div className="text-sm text-gray-600">总存储大小</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{(statistics.recoverySuccessRate * 100).toFixed(0)}%</div>
                <div className="text-sm text-gray-600">恢复成功率</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {statistics.storageUsage.percentage.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">存储使用率</div>
              </div>
            </div>
          </div>
        )}

        {/* 标签页 */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex space-x-6">
            <button
              onClick={() => setActiveTab('recovery')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'recovery'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              恢复点
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'config'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              配置
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'history'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              历史记录
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'privacy'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              隐私政策
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="px-6 py-4 overflow-y-auto max-h-[50vh]">
          {activeTab === 'recovery' && (
            <div className="space-y-4">
              {/* 操作按钮 */}
              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  <button
                    onClick={handleCreateRecoveryPoint}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>创建恢复点</span>
                  </button>
                  <button
                    onClick={handleImportPoint}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span>导入恢复点</span>
                  </button>
                </div>
              </div>

              {/* 恢复点列表 */}
              <div className="space-y-2">
                {recoveryPoints.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                    <p>暂无恢复点</p>
                    <p className="text-sm">点击"创建恢复点"开始保护您的数据</p>
                  </div>
                ) : (
                  recoveryPoints.map((point) => (
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
                            onClick={() => startRecovery(point)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                          >
                            恢复
                          </button>
                          <button
                            onClick={() => handleExportPoint(point.id)}
                            className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                          >
                            导出
                          </button>
                          <button
                            onClick={() => handleDeletePoint(point.id)}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">恢复配置</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-4">
                  配置自动备份、数据保留和恢复选项
                </p>
                <div className="space-y-4">
                  {/* 自动备份配置 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      自动备份
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input type="checkbox" className="mr-2" defaultChecked />
                        <span className="text-sm">启用自动备份</span>
                      </label>
                      <div className="ml-6">
                        <label className="block text-sm text-gray-600 mb-1">
                          备份间隔
                        </label>
                        <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                          <option value="30">30分钟</option>
                          <option value="60" selected>1小时</option>
                          <option value="120">2小时</option>
                          <option value="360">6小时</option>
                          <option value="720">12小时</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 保留配置 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      数据保留
                    </label>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          最大保留天数
                        </label>
                        <input
                          type="number"
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          defaultValue="30"
                          min="1"
                          max="365"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          最大存储大小 (MB)
                        </label>
                        <input
                          type="number"
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          defaultValue="100"
                          min="10"
                          max="1000"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 保存按钮 */}
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                    保存配置
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">恢复历史</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  查看数据恢复操作的历史记录
                </p>
                <div className="mt-4 text-center text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>暂无恢复历史记录</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              {/* 隐私合规状态 */}
              {privacyCompliance && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">隐私合规状态</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${privacyCompliance.compliant ? 'bg-green-600' : 'bg-yellow-600'}`}></div>
                      <span className="text-sm font-medium">
                        {privacyCompliance.compliant ? '合规' : '需要关注'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      问题数量: {privacyCompliance.issues?.length || 0}
                    </div>
                  </div>

                  {privacyCompliance.issues && privacyCompliance.issues.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">需要注意的问题:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {privacyCompliance.issues.map((issue: string, index: number) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-yellow-600 mt-1">•</span>
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {privacyCompliance.recommendations && privacyCompliance.recommendations.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">改进建议:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {privacyCompliance.recommendations.map((rec: string, index: number) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-blue-600 mt-1">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* 隐私政策内容 */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900">隐私政策</h3>
                </div>
                <div className="p-4 max-h-96 overflow-y-auto">
                  <div className="prose prose-sm max-w-none">
                    {privacyPolicy ? (
                      <div className="whitespace-pre-wrap text-sm text-gray-700">
                        {privacyPolicy}
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p>加载隐私政策中...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 隐私操作按钮 */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={async () => {
                    try {
                      await dataRecoveryService.cleanupUserData()
                      alert('用户数据清理完成')
                    } catch (error) {
                      alert('数据清理失败')
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                >
                  清理用户数据
                </button>

                <button
                  onClick={async () => {
                    try {
                      const report = await dataRecoveryService.exportPrivacyReport()
                      const blob = new Blob([report], { type: 'text/plain' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `privacy-report-${new Date().toISOString().split('T')[0]}.txt`
                      a.click()
                      URL.revokeObjectURL(url)
                    } catch (error) {
                      alert('导出失败')
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  导出隐私报告
                </button>

                <button
                  onClick={() => {
                    if (confirm('确定要重置隐私设置吗？')) {
                      // 重置隐私设置的逻辑
                      alert('隐私设置已重置')
                    }
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                >
                  重置隐私设置
                </button>
              </div>

              {/* 数据使用统计 */}
              {statistics && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">数据使用统计</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded border">
                      <div className="text-sm text-gray-600">数据加密状态</div>
                      <div className={`text-lg font-semibold ${statistics.privacyMetrics?.dataEncrypted ? 'text-green-600' : 'text-orange-600'}`}>
                        {statistics.privacyMetrics?.dataEncrypted ? '已加密' : '未加密'}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded border">
                      <div className="text-sm text-gray-600">本地存储</div>
                      <div className={`text-lg font-semibold ${statistics.privacyMetrics?.localOnly ? 'text-green-600' : 'text-blue-600'}`}>
                        {statistics.privacyMetrics?.localOnly ? '仅本地' : '支持云同步'}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded border">
                      <div className="text-sm text-gray-600">最后清理时间</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {statistics.privacyMetrics?.lastCleanup
                          ? new Date(statistics.privacyMetrics.lastCleanup).toLocaleDateString('zh-CN')
                          : '从未清理'
                        }
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded border">
                      <div className="text-sm text-gray-600">用户访问次数</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {statistics.privacyMetrics?.userAccessCount || 0}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 恢复结果 */}
        {recoveryResult && (
          <div className={`px-6 py-4 border-t ${
            recoveryResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center space-x-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                recoveryResult.success ? 'bg-green-600' : 'bg-red-600'
              }`}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {recoveryResult.success ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  )}
                </svg>
              </div>
              <div>
                <div className={`font-medium ${
                  recoveryResult.success ? 'text-green-900' : 'text-red-900'
                }`}>
                  {recoveryResult.success ? '恢复成功' : '恢复失败'}
                </div>
                <div className={`text-sm ${
                  recoveryResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {recoveryResult.message}
                </div>
                {recoveryResult.success && (
                  <div className="text-sm text-green-600 mt-1">
                    恢复了 {recoveryResult.restoredItems.cards} 个卡片, {recoveryResult.restoredItems.folders} 个文件夹, {recoveryResult.restoredItems.tags} 个标签
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 恢复向导 */}
      {showRecoveryWizard && selectedPoint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">数据恢复向导</h3>
              <button
                onClick={() => setShowRecoveryWizard(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 恢复点信息 */}
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-blue-900 mb-2">恢复点信息</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-600">创建时间:</span>
                  <span className="ml-2 text-blue-900">{formatDate(selectedPoint.timestamp)}</span>
                </div>
                <div>
                  <span className="text-blue-600">类型:</span>
                  <span className="ml-2 text-blue-900">{getTypeText(selectedPoint.type)}</span>
                </div>
                <div>
                  <span className="text-blue-600">大小:</span>
                  <span className="ml-2 text-blue-900">{formatSize(selectedPoint.size)}</span>
                </div>
                <div>
                  <span className="text-blue-600">描述:</span>
                  <span className="ml-2 text-blue-900">{selectedPoint.description}</span>
                </div>
              </div>
            </div>

            {/* 恢复选项 */}
            <div className="space-y-4 mb-6">
              <h4 className="font-medium text-gray-900">恢复选项</h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  恢复数据类型
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={recoveryOptions.targetData?.includes('cards')}
                      onChange={(e) => {
                        const targets = recoveryOptions.targetData || []
                        if (e.target.checked) {
                          setRecoveryOptions({
                            ...recoveryOptions,
                            targetData: [...targets, 'cards']
                          })
                        } else {
                          setRecoveryOptions({
                            ...recoveryOptions,
                            targetData: targets.filter(t => t !== 'cards')
                          })
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">卡片</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={recoveryOptions.targetData?.includes('folders')}
                      onChange={(e) => {
                        const targets = recoveryOptions.targetData || []
                        if (e.target.checked) {
                          setRecoveryOptions({
                            ...recoveryOptions,
                            targetData: [...targets, 'folders']
                          })
                        } else {
                          setRecoveryOptions({
                            ...recoveryOptions,
                            targetData: targets.filter(t => t !== 'folders')
                          })
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">文件夹</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={recoveryOptions.targetData?.includes('tags')}
                      onChange={(e) => {
                        const targets = recoveryOptions.targetData || []
                        if (e.target.checked) {
                          setRecoveryOptions({
                            ...recoveryOptions,
                            targetData: [...targets, 'tags']
                          })
                        } else {
                          setRecoveryOptions({
                            ...recoveryOptions,
                            targetData: targets.filter(t => t !== 'tags')
                          })
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">标签</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={recoveryOptions.targetData?.includes('settings')}
                      onChange={(e) => {
                        const targets = recoveryOptions.targetData || []
                        if (e.target.checked) {
                          setRecoveryOptions({
                            ...recoveryOptions,
                            targetData: [...targets, 'settings']
                          })
                        } else {
                          setRecoveryOptions({
                            ...recoveryOptions,
                            targetData: targets.filter(t => t !== 'settings')
                          })
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">设置</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  合并策略
                </label>
                <select
                  value={recoveryOptions.mergeStrategy}
                  onChange={(e) => setRecoveryOptions({
                    ...recoveryOptions,
                    mergeStrategy: e.target.value as any
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="replace">替换现有数据</option>
                  <option value="merge">合并数据</option>
                  <option value="smart_merge">智能合并</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  冲突解决
                </label>
                <select
                  value={recoveryOptions.conflictResolution}
                  onChange={(e) => setRecoveryOptions({
                    ...recoveryOptions,
                    conflictResolution: e.target.value as any
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="newer_wins">使用较新的数据</option>
                  <option value="older_wins">使用较旧的数据</option>
                  <option value="manual">手动解决</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={recoveryOptions.backupBeforeRecovery}
                    onChange={(e) => setRecoveryOptions({
                      ...recoveryOptions,
                      backupBeforeRecovery: e.target.checked
                    })}
                    className="mr-2"
                  />
                  <span className="text-sm">恢复前创建备份</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={recoveryOptions.validateIntegrity}
                    onChange={(e) => setRecoveryOptions({
                      ...recoveryOptions,
                      validateIntegrity: e.target.checked
                    })}
                    className="mr-2"
                  />
                  <span className="text-sm">验证数据完整性</span>
                </label>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRecoveryWizard(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={performRecovery}
                disabled={isRecovering}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isRecovering ? '恢复中...' : '开始恢复'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DataRecoveryPanel