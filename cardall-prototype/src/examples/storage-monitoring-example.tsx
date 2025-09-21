import React, { useEffect, useState } from 'react'
import {
  storageMonitorService,
  startStorageMonitoring,
  stopStorageMonitoring,
  recordStorageOperation,
  getStorageHealth,
  runStorageDiagnostics,
  getStorageStatistics,
  type StorageHealthStatus,
  type StorageStatistics,
  type DiagnosticReport
} from '../services/storage-monitor'
import StorageDiagnosticsPanel from '../components/storage-diagnostics-panel'
import StorageDiagnosticsToolbar from '../components/storage-diagnostics-toolbar'

/**
 * 存储监控功能使用示例
 *
 * 这个示例展示了如何在应用中集成和使用存储监控功能：
 * 1. 启动/停止监控
 * 2. 记录存储操作
 * 3. 获取健康状态
 * 4. 运行诊断
 * 5. 使用UI组件
 */

interface StorageMonitoringExampleProps {
  // 示例配置
  autoStartMonitoring?: boolean
  showToolbar?: boolean
  enableDetailedMetrics?: boolean
}

export const StorageMonitoringExample: React.FC<StorageMonitoringExampleProps> = ({
  autoStartMonitoring = true,
  showToolbar = true,
  enableDetailedMetrics = false
}) => {
  const [healthStatus, setHealthStatus] = useState<StorageHealthStatus | null>(null)
  const [statistics, setStatistics] = useState<StorageStatistics | null>(null)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false)
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null)
  const [isRunningTest, setIsRunningTest] = useState(false)

  // 初始化监控
  useEffect(() => {
    if (autoStartMonitoring) {
      startStorageMonitoring()
      setIsMonitoring(true)
    }

    // 初始数据加载
    refreshData()

    // 定期刷新数据
    const interval = setInterval(refreshData, 10000)

    return () => {
      clearInterval(interval)
      if (autoStartMonitoring) {
        stopStorageMonitoring()
      }
    }
  }, [autoStartMonitoring])

  // 刷新数据
  const refreshData = () => {
    try {
      setHealthStatus(getStorageHealth())
      setStatistics(getStorageStatistics())
    } catch (error) {
      console.error('Failed to refresh monitoring data:', error)
    }
  }

  // 切换监控状态
  const toggleMonitoring = () => {
    try {
      if (isMonitoring) {
        stopStorageMonitoring()
        setIsMonitoring(false)
      } else {
        startStorageMonitoring()
        setIsMonitoring(true)
      }
    } catch (error) {
      console.error('Failed to toggle monitoring:', error)
    }
  }

  // 运行诊断
  const runDiagnostics = async () => {
    try {
      setIsDiagnosticsOpen(true)
      const report = await runStorageDiagnostics()
      setDiagnosticReport(report)
      refreshData()
    } catch (error) {
      console.error('Failed to run diagnostics:', error)
    }
  }

  // 模拟存储操作
  const simulateStorageOperations = async () => {
    setIsRunningTest(true)
    try {
      console.log('Starting storage operation simulation...')

      // 模拟读取操作
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now()
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50))
        const duration = performance.now() - startTime

        recordStorageOperation(
          'read',
          'simulate_read_card',
          duration,
          true,
          Math.floor(Math.random() * 1000) + 100
        )
      }

      // 模拟写入操作
      for (let i = 0; i < 3; i++) {
        const startTime = performance.now()
        await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100))
        const duration = performance.now() - startTime

        recordStorageOperation(
          'write',
          'simulate_write_card',
          duration,
          true,
          Math.floor(Math.random() * 2000) + 500
        )
      }

      // 模拟一个错误操作
      recordStorageOperation(
        'write',
        'simulate_failed_write',
        150,
        false,
        500,
        'Simulated write error',
        { retryCount: 2 }
      )

      console.log('Storage operation simulation completed')
      refreshData()
    } catch (error) {
      console.error('Failed to simulate storage operations:', error)
    } finally {
      setIsRunningTest(false)
    }
  }

  // 获取健康状态颜色
  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-green-600 bg-green-100'
      case 'good': return 'text-blue-600 bg-blue-100'
      case 'fair': return 'text-yellow-600 bg-yellow-100'
      case 'poor': return 'text-orange-600 bg-orange-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className=\"space-y-6 p-6 max-w-6xl mx-auto\">
      {/* 头部 */}
      <div className=\"text-center mb-8\">
        <h1 className=\"text-3xl font-bold text-gray-900 mb-2\">存储监控功能示例</h1>
        <p className=\"text-gray-600\">演示存储监控、诊断和性能分析功能</p>
      </div>

      {/* 工具栏 */}
      {showToolbar && (
        <div className=\"flex justify-between items-center mb-6 p-4 bg-gray-50 rounded-lg\">
          <StorageDiagnosticsToolbar />

          <div className=\"flex space-x-2\">
            <button
              onClick={toggleMonitoring}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                isMonitoring
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {isMonitoring ? '停止监控' : '启动监控'}
            </button>

            <button
              onClick={runDiagnostics}
              className=\"px-4 py-2 bg-blue-100 text-blue-700 rounded-md font-medium hover:bg-blue-200 transition-colors\"
            >
              运行诊断
            </button>

            <button
              onClick={simulateStorageOperations}
              disabled={isRunningTest}
              className=\"px-4 py-2 bg-purple-100 text-purple-700 rounded-md font-medium hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors\"
            >
              {isRunningTest ? '模拟中...' : '模拟操作'}
            </button>

            <button
              onClick={refreshData}
              className=\"px-4 py-2 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 transition-colors\"
            >
              刷新数据
            </button>
          </div>
        </div>
      )}

      {/* 健康状态概览 */}
      {healthStatus && (
        <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6\">
          <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
            <div className=\"flex items-center justify-between mb-2\">
              <h3 className=\"text-lg font-semibold text-gray-900\">整体健康</h3>
              <div className={`w-3 h-3 rounded-full ${getHealthColor(healthStatus.overall).split(' ')[1]}`}></div>
            </div>
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getHealthColor(healthStatus.overall)}`}>
              {healthStatus.overall === 'excellent' ? '优秀' :
               healthStatus.overall === 'good' ? '良好' :
               healthStatus.overall === 'fair' ? '一般' :
               healthStatus.overall === 'poor' ? '较差' : '严重'}
            </div>
            <div className=\"mt-2\">
              <div className=\"w-full bg-gray-200 rounded-full h-2\">
                <div
                  className=\"bg-blue-600 h-2 rounded-full transition-all duration-300\"
                  style={{ width: `${healthStatus.score}%` }}
                ></div>
              </div>
              <p className=\"text-xs text-gray-500 mt-1\">评分: {healthStatus.score.toFixed(0)}/100</p>
            </div>
          </div>

          <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
            <h3 className=\"text-lg font-semibold text-gray-900 mb-2\">性能指标</h3>
            <div className=\"space-y-1\">
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">性能</span>
                <span className=\"font-medium\">{healthStatus.performance.toFixed(0)}/100</span>
              </div>
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">可靠性</span>
                <span className=\"font-medium\">{healthStatus.reliability.toFixed(0)}/100</span>
              </div>
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">可用性</span>
                <span className=\"font-medium\">{healthStatus.availability.toFixed(0)}/100</span>
              </div>
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">效率</span>
                <span className=\"font-medium\">{healthStatus.efficiency.toFixed(0)}/100</span>
              </div>
            </div>
          </div>

          <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
            <h3 className=\"text-lg font-semibold text-gray-900 mb-2\">问题统计</h3>
            <div className=\"space-y-1\">
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">严重问题</span>
                <span className=\"font-medium text-red-600\">{healthStatus.issues.critical}</span>
              </div>
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">警告问题</span>
                <span className=\"font-medium text-orange-600\">{healthStatus.issues.warning}</span>
              </div>
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">信息问题</span>
                <span className=\"font-medium text-yellow-600\">{healthStatus.issues.info}</span>
              </div>
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">总计</span>
                <span className=\"font-medium\">{healthStatus.issues.critical + healthStatus.issues.warning + healthStatus.issues.info}</span>
              </div>
            </div>
          </div>

          <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
            <h3 className=\"text-lg font-semibold text-gray-900 mb-2\">系统建议</h3>
            <div className=\"space-y-1 max-h-20 overflow-y-auto\">
              {healthStatus.recommendations.slice(0, 3).map((recommendation, index) => (
                <div key={index} className=\"text-xs text-gray-600 flex items-start\">
                  <svg className=\"w-3 h-3 text-blue-600 mr-1 mt-0.5 flex-shrink-0\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">
                    <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M9 5l7 7-7 7\" />
                  </svg>
                  <span className=\"line-clamp-2\">{recommendation}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 统计信息 */}
      {statistics && (
        <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6\">
          <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
            <h3 className=\"text-lg font-semibold text-gray-900 mb-3\">数据统计</h3>
            <div className=\"space-y-2\">
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">卡片数量</span>
                <span className=\"font-medium\">{statistics.totalCards}</span>
              </div>
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">文件夹数量</span>
                <span className=\"font-medium\">{statistics.totalFolders}</span>
              </div>
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">标签数量</span>
                <span className=\"font-medium\">{statistics.totalTags}</span>
              </div>
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">存储大小</span>
                <span className=\"font-medium\">{(statistics.totalStorageSize / 1024).toFixed(1)} KB</span>
              </div>
            </div>
          </div>

          <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
            <h3 className=\"text-lg font-semibold text-gray-900 mb-3\">操作统计</h3>
            <div className=\"space-y-2\">
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">今日操作</span>
                <span className=\"font-medium\">{statistics.operationsToday}</span>
              </div>
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">本周操作</span>
                <span className=\"font-medium\">{statistics.operationsThisWeek}</span>
              </div>
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">平均响应时间</span>
                <span className=\"font-medium\">{statistics.averageResponseTime.toFixed(0)}ms</span>
              </div>
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">峰值操作时间</span>
                <span className=\"font-medium\">{statistics.peakOperationTime.toFixed(0)}ms</span>
              </div>
            </div>
          </div>

          <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
            <h3 className=\"text-lg font-semibold text-gray-900 mb-3\">趋势分析</h3>
            <div className=\"space-y-2\">
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">存储增长率</span>
                <span className=\"font-medium\">{(statistics.storageGrowthRate * 100).toFixed(1)}%</span>
              </div>
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">错误趋势</span>
                <span className={`font-medium ${
                  statistics.errorTrend === 'improving' ? 'text-green-600' :
                  statistics.errorTrend === 'declining' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {statistics.errorTrend === 'improving' ? '改善' :
                   statistics.errorTrend === 'declining' ? '恶化' : '稳定'}
                </span>
              </div>
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">性能趋势</span>
                <span className={`font-medium ${
                  statistics.performanceTrend === 'improving' ? 'text-green-600' :
                  statistics.performanceTrend === 'declining' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {statistics.performanceTrend === 'improving' ? '改善' :
                   statistics.performanceTrend === 'declining' ? '恶化' : '稳定'}
                </span>
              </div>
              <div className=\"flex justify-between text-sm\">
                <span className=\"text-gray-600\">今日错误</span>
                <span className=\"font-medium text-red-600\">{statistics.errorsToday}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 详细指标（可选） */}
      {enableDetailedMetrics && (
        <div className=\"bg-white border border-gray-200 rounded-lg p-6 mb-6\">
          <h3 className=\"text-lg font-semibold text-gray-900 mb-4\">详细监控指标</h3>
          <div className=\"text-sm text-gray-600 space-y-2\">
            <p><strong>监控状态:</strong> {isMonitoring ? '运行中' : '已停止'}</p>
            <p><strong>详细指标:</strong> 已启用</p>
            <p><strong>数据收集:</strong> 实时</p>
            <p><strong>诊断间隔:</strong> 30分钟</p>
            <p><strong>报告生成:</strong> 每小时</p>
          </div>
        </div>
      )}

      {/* 使用说明 */}
      <div className=\"bg-blue-50 border border-blue-200 rounded-lg p-6\">
        <h3 className=\"text-lg font-semibold text-blue-900 mb-3\">使用说明</h3>
        <div className=\"space-y-3 text-sm text-blue-800\">
          <div>
            <h4 className=\"font-medium mb-1\">基本功能：</h4>
            <ul className=\"list-disc list-inside space-y-1 ml-4\">
              <li>启动/停止监控：实时跟踪存储操作和性能</li>
              <li>健康状态检查：评估存储系统的整体健康状况</li>
              <li>运行诊断：深度分析存储问题和优化建议</li>
              <li>模拟操作：测试监控系统的数据收集功能</li>
            </ul>
          </div>

          <div>
            <h4 className=\"font-medium mb-1\">集成方法：</h4>
            <ul className=\"list-disc list-inside space-y-1 ml-4\">
              <li>在组件中导入 StorageDiagnosticsToolbar 组件</li>
              <li>使用 storageMonitorService 记录存储操作</li>
              <li>调用 getStorageHealth() 获取健康状态</li>
              <li>使用 StorageDiagnosticsPanel 显示详细信息</li>
            </ul>
          </div>

          <div>
            <h4 className=\"font-medium mb-1\">API 示例：</h4>
            <div className=\"bg-blue-100 p-3 rounded font-mono text-xs overflow-x-auto\">
              <pre>{`// 启动监控
import { startStorageMonitoring } from './services/storage-monitor'
startStorageMonitoring()

// 记录操作
import { recordStorageOperation } from './services/storage-monitor'
recordStorageOperation('write', 'save_card', duration, success, dataSize)

// 获取健康状态
import { getStorageHealth } from './services/storage-monitor'
const health = getStorageHealth()

// 运行诊断
import { runStorageDiagnostics } from './services/storage-monitor'
const report = await runStorageDiagnostics()`}</pre>
            </div>
          </div>
        </div>
      </div>

      {/* 诊断面板 */}
      <StorageDiagnosticsPanel
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />
    </div>
  )
}

export default StorageMonitoringExample