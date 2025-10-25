import React, { useState, useEffect } from 'react'
import {
  storageMonitorService,
  type StorageHealthStatus
} from '../services/storage-monitor'
import StorageDiagnosticsPanel from './storage-diagnostics-panel'

interface HealthIndicatorProps {
  healthStatus: StorageHealthStatus | null
  onClick: () => void
}

const HealthIndicator: React.FC<HealthIndicatorProps> = ({ healthStatus, onClick }) => {
  if (!healthStatus) {
    return (
      <button
        onClick={onClick}
        className=\"flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors\"
        title=\"存储诊断\"
      >
        <svg className=\"w-5 h-5\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">
          <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z\" />
        </svg>
      </button>
    )
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-green-600'
      case 'good': return 'text-blue-600'
      case 'fair': return 'text-yellow-600'
      case 'poor': return 'text-orange-600'
      case 'critical': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getHealthBgColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'bg-green-100'
      case 'good': return 'bg-blue-100'
      case 'fair': return 'bg-yellow-100'
      case 'poor': return 'bg-orange-100'
      case 'critical': return 'bg-red-100'
      default: return 'bg-gray-100'
    }
  }

  const getHealthText = (health: string) => {
    switch (health) {
      case 'excellent': return '优秀'
      case 'good': return '良好'
      case 'fair': return '一般'
      case 'poor': return '较差'
      case 'critical': return '严重'
      default: return '未知'
    }
  }

  return (
    <div className=\"relative group\">
      <button
        onClick={onClick}
        className={`flex items-center space-x-2 px-3 py-2 text-sm ${getHealthColor(healthStatus.overall)} hover:opacity-80 transition-opacity`}
        title=\"存储诊断\"
      >
        <svg className=\"w-5 h-5\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">
          <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z\" />
        </svg>
        <span className=\"hidden sm:inline\">存储</span>
        {healthStatus.issues.critical > 0 && (
          <span className=\"absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full\"></span>
        )}
      </button>

      {/* 悬停提示 */}
      <div className=\"absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50\">
        <div className=\"space-y-2\">
          <div className=\"flex items-center justify-between\">
            <span className=\"text-sm font-medium text-gray-900\">存储健康状态</span>
            <span className={`text-xs px-2 py-1 rounded-full ${getHealthBgColor(healthStatus.overall)} ${getHealthColor(healthStatus.overall)}`}>
              {getHealthText(healthStatus.overall)}
            </span>
          </div>

          <div className=\"grid grid-cols-2 gap-2 text-xs\">
            <div className=\"flex justify-between\">
              <span className=\"text-gray-600\">性能</span>
              <span className=\"font-medium\">{healthStatus.performance.toFixed(0)}/100</span>
            </div>
            <div className=\"flex justify-between\">
              <span className=\"text-gray-600\">可靠性</span>
              <span className=\"font-medium\">{healthStatus.reliability.toFixed(0)}/100</span>
            </div>
            <div className=\"flex justify-between\">
              <span className=\"text-gray-600\">可用性</span>
              <span className=\"font-medium\">{healthStatus.availability.toFixed(0)}/100</span>
            </div>
            <div className=\"flex justify-between\">
              <span className=\"text-gray-600\">问题</span>
              <span className=\"font-medium text-red-600\">{healthStatus.issues.critical + healthStatus.issues.warning}</span>
            </div>
          </div>

          {healthStatus.recommendations.length > 0 && (
            <div className=\"pt-2 border-t border-gray-200\">
              <p className=\"text-xs text-gray-600 mb-1\">建议:</p>
              <p className=\"text-xs text-gray-800 line-clamp-2\">{healthStatus.recommendations[0]}</p>
            </div>
          )}

          <div className=\"pt-2 border-t border-gray-200 text-xs text-gray-500\">
            点击查看详细诊断信息
          </div>
        </div>
      </div>
    </div>
  )
}

interface StorageDiagnosticsToolbarProps {
  className?: string
}

export const StorageDiagnosticsToolbar: React.FC<StorageDiagnosticsToolbarProps> = ({
  className = ''
}) => {
  const [healthStatus, setHealthStatus] = useState<StorageHealthStatus | null>(null)
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false)
  const [isMonitoring, setIsMonitoring] = useState(false)

  // 刷新健康状态
  const refreshHealthStatus = () => {
    try {
      setHealthStatus(storageMonitorService.getStorageHealth())
    } catch (error) {
      console.error('Failed to refresh storage health status:', error)
    }
  }

  // 启动/停止监控
  const toggleMonitoring = () => {
    try {
      if (isMonitoring) {
        storageMonitorService.stopMonitoring()
        setIsMonitoring(false)
      } else {
        storageMonitorService.startMonitoring()
        setIsMonitoring(true)
      }
    } catch (error) {
      console.error('Failed to toggle monitoring:', error)
    }
  }

  // 快速诊断
  const quickDiagnostics = async () => {
    try {
      await storageMonitorService.runDiagnostics()
      refreshHealthStatus()
    } catch (error) {
      console.error('Failed to run quick diagnostics:', error)
    }
  }

  // 初始化
  useEffect(() => {
    refreshHealthStatus()

    // 每30秒刷新一次健康状态
    const interval = setInterval(refreshHealthStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <div className={`flex items-center space-x-2 ${className}`}>
        <HealthIndicator
          healthStatus={healthStatus}
          onClick={() => setIsDiagnosticsOpen(true)}
        />

        <button
          onClick={toggleMonitoring}
          className={`flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors ${
            isMonitoring
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title={isMonitoring ? '停止监控' : '启动监控'}
        >
          <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-600 animate-pulse' : 'bg-gray-400'}`}></div>
          <span>{isMonitoring ? '监控中' : '监控'}</span>
        </button>

        <button
          onClick={quickDiagnostics}
          className=\"flex items-center space-x-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors\"
          title=\"快速诊断\"
        >
          <svg className=\"w-3 h-3\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">
            <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z\" />
          </svg>
          <span>诊断</span>
        </button>
      </div>

      <StorageDiagnosticsPanel
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />
    </>
  )
}

export default StorageDiagnosticsToolbar