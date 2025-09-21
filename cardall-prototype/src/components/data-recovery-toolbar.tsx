import React, { useState, useEffect } from 'react'
import {
  dataRecoveryService,
  type RecoveryStatistics,
  type RecoveryPoint
} from '../services/data-recovery'
import DataRecoveryPanel from './data-recovery-panel'

interface DataRecoveryToolbarProps {
  className?: string
}

/**
 * 数据恢复工具栏组件
 *
 * 提供快速访问数据恢复功能的工具栏，包括：
 * - 恢复状态指示器
 * - 快速备份按钮
 * - 恢复点数量显示
 * - 快速恢复选项
 */
export const DataRecoveryToolbar: React.FC<DataRecoveryToolbarProps> = ({
  className = ''
}) => {
  const [statistics, setStatistics] = useState<RecoveryStatistics | null>(null)
  const [lastRecoveryPoint, setLastRecoveryPoint] = useState<RecoveryPoint | null>(null)
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false)
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)

  // 初始化
  useEffect(() => {
    loadData()

    // 每5分钟刷新一次数据
    const interval = setInterval(loadData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [stats, recoveryPoints] = await Promise.all([
        dataRecoveryService.getStatistics(),
        dataRecoveryService.getRecoveryPoints()
      ])
      setStatistics(stats)
      setLastRecoveryPoint(recoveryPoints[0] || null)
    } catch (error) {
      console.error('Failed to load recovery data:', error)
    }
  }

  // 快速创建备份
  const quickBackup = async () => {
    setIsCreatingBackup(true)
    try {
      await dataRecoveryService.createRecoveryPoint('manual', 'Quick backup')
      loadData()
    } catch (error) {
      console.error('Failed to create quick backup:', error)
    } finally {
      setIsCreatingBackup(false)
    }
  }

  // 获取存储状态颜色
  const getStorageStatusColor = (percentage: number) => {
    if (percentage < 50) return 'text-green-600'
    if (percentage < 80) return 'text-yellow-600'
    return 'text-red-600'
  }

  // 格式化时间
  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / (60 * 1000))
    const hours = Math.floor(diff / (60 * 60 * 1000))
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))

    if (days > 0) return `${days}天前`
    if (hours > 0) return `${hours}小时前`
    if (minutes > 0) return `${minutes}分钟前`
    return '刚刚'
  }

  // 格式化大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <>
      <div className={`flex items-center space-x-2 ${className}`}>
        {/* 恢复状态指示器 */}
        <div className="relative group">
          <button
            onClick={() => setIsRecoveryOpen(true)}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            title="数据恢复"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">恢复</span>
            {statistics && statistics.totalRecoveryPoints > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 rounded-full"></span>
            )}
          </button>

          {/* 悬停提示 */}
          {statistics && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">数据恢复状态</span>
                  <span className="text-xs text-gray-500">
                    {statistics.totalRecoveryPoints} 个恢复点
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">总大小</span>
                    <span className="font-medium">{formatSize(statistics.totalSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">成功率</span>
                    <span className="font-medium text-green-600">
                      {(statistics.recoverySuccessRate * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">存储使用</span>
                    <span className={`font-medium ${getStorageStatusColor(statistics.storageUsage.percentage)}`}>
                      {statistics.storageUsage.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">恢复点</span>
                    <span className="font-medium">{statistics.totalRecoveryPoints}</span>
                  </div>
                </div>

                {lastRecoveryPoint && (
                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">最近备份:</p>
                    <p className="text-xs text-gray-800">
                      {formatRelativeTime(lastRecoveryPoint.timestamp)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {lastRecoveryPoint.description}
                    </p>
                  </div>
                )}

                <div className="pt-2 border-t border-gray-200 text-xs text-gray-500">
                  点击查看详细恢复选项
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 快速备份按钮 */}
        <button
          onClick={quickBackup}
          disabled={isCreatingBackup}
          className={`flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors ${
            isCreatingBackup
              ? 'bg-gray-100 text-gray-400'
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
          title="创建快速备份"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          <span>{isCreatingBackup ? '备份中...' : '备份'}</span>
        </button>

        {/* 恢复点数量指示器 */}
        {statistics && statistics.totalRecoveryPoints > 0 && (
          <div className="flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{statistics.totalRecoveryPoints}</span>
          </div>
        )}

        {/* 存储使用率指示器 */}
        {statistics && statistics.storageUsage.percentage > 70 && (
          <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded text-xs">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{statistics.storageUsage.percentage.toFixed(0)}%</span>
          </div>
        )}
      </div>

      {/* 恢复面板 */}
      <DataRecoveryPanel
        isOpen={isRecoveryOpen}
        onClose={() => setIsRecoveryOpen(false)}
      />
    </>
  )
}

export default DataRecoveryToolbar